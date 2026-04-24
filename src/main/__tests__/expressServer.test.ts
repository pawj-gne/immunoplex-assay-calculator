import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest'
import * as http from 'http'
import type Database from 'better-sqlite3'
import { createExpressApp } from '../server/expressServer'
import { createTestDb, seedPlatformAndSpecies } from '../db/__tests__/testDb'
import { setDatabaseForTests, setSqliteForTests, resetDatabaseForTests } from '../db/client'
import type { RunCreate } from '../../shared/types/run'

// Express integration tests for Phase 6 Plan 02 (NET-01 + NET-04).
// Strategy: bind createExpressApp() to a random port on 127.0.0.1 once for the suite,
// inject an in-memory DB via setDatabaseForTests(), and use Node's built-in fetch.
// No supertest dependency required (Node 20+ ships fetch natively).

let server: http.Server
let baseUrl: string
let sqlite: Database.Database
let platformId: string
let speciesId: string
let operatorId: string

beforeAll(async () => {
  const test = createTestDb()
  sqlite = test.sqlite
  setDatabaseForTests(test.db)
  setSqliteForTests(test.sqlite) // runRepository uses getSqlite() for transactions

  const app = createExpressApp()
  await new Promise<void>((resolve) => {
    server = app.listen(0, '127.0.0.1', () => {
      const addr = server.address() as { port: number }
      baseUrl = `http://127.0.0.1:${addr.port}`
      resolve()
    })
  })
})

afterAll(async () => {
  await new Promise<void>((resolve) => server.close(() => resolve()))
  resetDatabaseForTests()
  sqlite.close()
})

beforeEach(() => {
  // Wipe runs/operators/platforms/species between tests so each test sees a clean slate.
  // Order matters: child tables (runs, run_single_analytes, panel_analytes) before parents.
  sqlite.exec('DELETE FROM run_single_analytes')
  sqlite.exec('DELETE FROM runs')
  sqlite.exec('DELETE FROM operators')
  sqlite.exec('DELETE FROM panel_analytes')
  sqlite.exec('DELETE FROM analytes')
  sqlite.exec('DELETE FROM premix_panels')
  sqlite.exec('DELETE FROM master_panels')
  sqlite.exec('DELETE FROM species')
  sqlite.exec('DELETE FROM platforms')

  // Seed platform + species (FK parents for runs).
  const seeded = seedPlatformAndSpecies(sqlite)
  platformId = seeded.platformId
  speciesId = seeded.speciesId

  // Seed a valid operator (operatorId has a NOT NULL FK on operators.id).
  operatorId = crypto.randomUUID()
  const now = new Date().toISOString()
  sqlite
    .prepare(
      `INSERT INTO operators (id, name, active, created_at, updated_at)
       VALUES (?, 'Test Operator', 1, ?, ?)`
    )
    .run(operatorId, now, now)
})

// Helper: minimal valid RunCreate payload that passes runCreateSchema and FK constraints.
function buildValidRunPayload(): RunCreate {
  return {
    requestNumber: 1001,
    requestOverrideAdHoc: false,
    userName: 'Tester',
    operatorId,
    runDate: new Date().toISOString().slice(0, 10),
    sampleType: 'Serum',
    dilutionFactor: 2,
    sampleCount: 10,
    replicateMode: 'singles',
    requestType: 'custom',
    platformId,
    speciesId,
    panelId: null,
    volumePerWell: 25,
    deadVolume: 2000,
    hamilton: 1,
    runPlatePosition: 1,
    standardPosition: 1,
    troughPosition: 1,
    comments: null,
    plex: 0,
    plateCount: 1,
    plates: { 1: ['A1', 'A2', 'A3'] },
    singleAnalyteIds: []
  }
}

describe('express server / GET /api/health (NET-01)', () => {
  it('returns { ok: true } with status 200', async () => {
    const res = await fetch(`${baseUrl}/api/health`)
    expect(res.status).toBe(200)
    const body = (await res.json()) as { ok: boolean }
    expect(body.ok).toBe(true)
  })
})

describe('express server / GET /api/runs (NET-01)', () => {
  it('returns an array (empty on fresh DB)', async () => {
    const res = await fetch(`${baseUrl}/api/runs`)
    expect(res.status).toBe(200)
    const body = (await res.json()) as unknown[]
    expect(Array.isArray(body)).toBe(true)
    expect(body).toHaveLength(0)
  })

  it('returns previously created runs', async () => {
    const payload = buildValidRunPayload()
    const create = await fetch(`${baseUrl}/api/runs`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    })
    expect(create.status).toBe(201)

    const res = await fetch(`${baseUrl}/api/runs`)
    expect(res.status).toBe(200)
    const body = (await res.json()) as Array<{ userName: string }>
    expect(body).toHaveLength(1)
    expect(body[0].userName).toBe('Tester')
  })
})

describe('express server / POST /api/runs (NET-01)', () => {
  it('creates a run and returns 201 with the persisted record', async () => {
    const payload = buildValidRunPayload()
    const res = await fetch(`${baseUrl}/api/runs`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    })
    expect(res.status).toBe(201)
    const body = (await res.json()) as { id: string; userName: string }
    expect(typeof body.id).toBe('string')
    expect(body.id.length).toBeGreaterThan(0)
    expect(body.userName).toBe('Tester')
  })

  it('returns 400 on Zod validation failure (missing required fields)', async () => {
    const res = await fetch(`${baseUrl}/api/runs`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userName: 'test' })
    })
    expect(res.status).toBe(400)
  })

  it('returns 200 on duplicate run id — idempotency for offline queue flush (NET-04 / D-08)', async () => {
    // First POST: 201, server creates the row and assigns an id.
    const create = await fetch(`${baseUrl}/api/runs`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(buildValidRunPayload())
    })
    expect(create.status).toBe(201)
    const created = (await create.json()) as { id: string }

    // Second POST with the SAME id (simulates offline queue flush re-sending a confirmed run).
    // The Express POST route pre-checks req.body.id and short-circuits to 200 if it exists.
    const replay = await fetch(`${baseUrl}/api/runs`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...buildValidRunPayload(), id: created.id })
    })
    expect(replay.status).toBe(200)
    const replayBody = (await replay.json()) as { id: string }
    expect(replayBody.id).toBe(created.id)

    // Confirm only one row was actually persisted (no duplicate created).
    const list = await fetch(`${baseUrl}/api/runs`)
    const listBody = (await list.json()) as Array<{ id: string }>
    expect(listBody).toHaveLength(1)
  })
})

describe('express server / GET /api/operators (NET-01)', () => {
  it('returns an array containing the seeded operator', async () => {
    const res = await fetch(`${baseUrl}/api/operators`)
    expect(res.status).toBe(200)
    const body = (await res.json()) as Array<{ id: string; name: string }>
    expect(Array.isArray(body)).toBe(true)
    // beforeEach seeded one operator
    expect(body.some((o) => o.id === operatorId && o.name === 'Test Operator')).toBe(true)
  })
})
