import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { createTestDb, seedPlatformAndSpecies } from '../../__tests__/testDb'
import {
  setDatabaseForTests,
  setSqliteForTests,
  resetDatabaseForTests
} from '../../client'
import { runRepository } from '../run'
import type { RunCreate } from '../../../../shared/types/run'

// Plan 14-08 — DB persistence round-trip tests for the three Smoke-3 fields
// that 14-04 carried in TS types + Zod but never in SQLite:
//   - numberOfSetups (Phase 12 inheritance)
//   - oldBeads (Phase 14 SMK3-02)
//   - oldAntibodies (Phase 14 SMK3-03)
//
// Mirrors src/main/db/repositories/__tests__/analyte.test.ts setup pattern.

describe('runRepository — numberOfSetups + oldBeads + oldAntibodies persistence (Plan 14-08)', () => {
  let sqlite: ReturnType<typeof createTestDb>['sqlite']
  let platformId: string
  let speciesId: string
  let operatorId: string

  beforeEach(() => {
    const testDb = createTestDb()
    sqlite = testDb.sqlite
    setDatabaseForTests(testDb.db)
    setSqliteForTests(testDb.sqlite) // runRepository uses getSqlite() for transactions

    const ids = seedPlatformAndSpecies(sqlite)
    platformId = ids.platformId
    speciesId = ids.speciesId

    // Seed a valid operator (runs.operator_id has a NOT NULL FK on operators.id).
    operatorId = crypto.randomUUID()
    const now = new Date().toISOString()
    sqlite
      .prepare(
        `INSERT INTO operators (id, name, active, created_at, updated_at)
         VALUES (?, 'Test Operator', 1, ?, ?)`
      )
      .run(operatorId, now, now)
  })

  afterEach(() => {
    resetDatabaseForTests()
    sqlite.close()
  })

  // Minimal valid RunCreate payload — caller fills in the three new fields per test.
  function basePayload(overrides: Partial<RunCreate> = {}): RunCreate {
    return {
      requestNumber: 1001,
      requestOverrideAdHoc: false,
      userName: 'Tester',
      operatorId,
      runDate: '2026-05-12',
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
      singleAnalyteIds: [],
      ...overrides
    }
  }

  it('T-1: create() persists numberOfSetups when provided', () => {
    const created = runRepository.create(basePayload({ numberOfSetups: 3 }))
    expect(created.numberOfSetups).toBe(3)

    // Round-trip via getById to confirm it landed in SQLite (not just echoed)
    const fetched = runRepository.getById(created.id)
    expect(fetched).not.toBeNull()
    expect(fetched!.numberOfSetups).toBe(3)
  })

  it('T-2: create() persists oldBeads when provided', () => {
    const created = runRepository.create(basePayload({ oldBeads: 1.5 }))
    expect(created.oldBeads).toBe(1.5)

    const fetched = runRepository.getById(created.id)
    expect(fetched).not.toBeNull()
    expect(fetched!.oldBeads).toBe(1.5)
  })

  it('T-3: create() persists oldAntibodies when provided', () => {
    const created = runRepository.create(basePayload({ oldAntibodies: 2.3 }))
    expect(created.oldAntibodies).toBe(2.3)

    const fetched = runRepository.getById(created.id)
    expect(fetched).not.toBeNull()
    expect(fetched!.oldAntibodies).toBe(2.3)
  })

  it('T-4: getById() returns all three fields exactly as written', () => {
    const created = runRepository.create(
      basePayload({ numberOfSetups: 5, oldBeads: 0.7, oldAntibodies: 1.1 })
    )

    const fetched = runRepository.getById(created.id)
    expect(fetched).not.toBeNull()
    expect(fetched!.numberOfSetups).toBe(5)
    expect(fetched!.oldBeads).toBe(0.7)
    expect(fetched!.oldAntibodies).toBe(1.1)
  })

  it('T-5: create() with the three fields omitted defaults numberOfSetups=1, oldBeads=0, oldAntibodies=0 on read', () => {
    // Cast through Partial<RunCreate> to omit the optional fields entirely
    // (NOT the same as setting undefined — Drizzle would still emit NULL for
    // an explicit undefined; the test exercises the genuine "field absent"
    // case that mirrors a pre-Phase-14 RunCreate payload).
    const payload = basePayload()
    delete (payload as Partial<RunCreate>).numberOfSetups
    delete (payload as Partial<RunCreate>).oldBeads
    delete (payload as Partial<RunCreate>).oldAntibodies

    const created = runRepository.create(payload)
    const fetched = runRepository.getById(created.id)
    expect(fetched).not.toBeNull()
    expect(fetched!.numberOfSetups).toBe(1) // DB default
    expect(fetched!.oldBeads).toBe(0) // DB default
    expect(fetched!.oldAntibodies).toBe(0) // DB default
  })

  it('T-6: list() returns the three fields per row', () => {
    runRepository.create(
      basePayload({
        requestNumber: 2001,
        numberOfSetups: 2,
        oldBeads: 0.4,
        oldAntibodies: 0.9
      })
    )
    runRepository.create(
      basePayload({
        requestNumber: 2002,
        numberOfSetups: 4,
        oldBeads: 1.2,
        oldAntibodies: 1.6
      })
    )

    const all = runRepository.getAll()
    expect(all.length).toBe(2)
    // Each row carries the three new fields
    for (const row of all) {
      expect(typeof row.numberOfSetups).toBe('number')
      expect(typeof row.oldBeads).toBe('number')
      expect(typeof row.oldAntibodies).toBe('number')
    }
    // And the specific values round-trip (order is by createdAt desc per getAll)
    const byRequest = new Map(all.map((r) => [r.requestNumber, r]))
    expect(byRequest.get(2001)?.numberOfSetups).toBe(2)
    expect(byRequest.get(2001)?.oldBeads).toBe(0.4)
    expect(byRequest.get(2001)?.oldAntibodies).toBe(0.9)
    expect(byRequest.get(2002)?.numberOfSetups).toBe(4)
    expect(byRequest.get(2002)?.oldBeads).toBe(1.2)
    expect(byRequest.get(2002)?.oldAntibodies).toBe(1.6)
  })

  describe('Phase 15 audit-trail snapshot persistence (SMK3-12/15/16/17)', () => {
    it('T-7: create() persists sapeName when provided', () => {
      const created = runRepository.create(basePayload({ sapeName: 'SAPE-A' }))
      expect(created.sapeName).toBe('SAPE-A')
      expect(runRepository.getById(created.id)!.sapeName).toBe('SAPE-A')
    })

    it('T-8: create() persists sapeConcentration when provided', () => {
      const created = runRepository.create(basePayload({ sapeConcentration: 1.0 }))
      expect(runRepository.getById(created.id)!.sapeConcentration).toBe(1.0)
    })

    it('T-9: create() persists beadsDiluent verbatim (SMK3-DIL-01)', () => {
      const created = runRepository.create(basePayload({ beadsDiluent: 'L-AB' }))
      expect(runRepository.getById(created.id)!.beadsDiluent).toBe('L-AB')
    })

    it('T-10: create() persists antibodiesDiluent verbatim (SMK3-DIL-01)', () => {
      const created = runRepository.create(basePayload({ antibodiesDiluent: 'L-AB' }))
      expect(runRepository.getById(created.id)!.antibodiesDiluent).toBe('L-AB')
    })

    it('T-11: create() persists beadsVolumePerWell when provided', () => {
      const created = runRepository.create(basePayload({ beadsVolumePerWell: 0.05 }))
      expect(runRepository.getById(created.id)!.beadsVolumePerWell).toBe(0.05)
    })

    it('T-12: create() persists antibodiesVolumePerWell when provided', () => {
      const created = runRepository.create(basePayload({ antibodiesVolumePerWell: 0.025 }))
      expect(runRepository.getById(created.id)!.antibodiesVolumePerWell).toBe(0.025)
    })

    it('T-13: create() persists premixConcentration when provided', () => {
      const created = runRepository.create(basePayload({ premixConcentration: 1.0 }))
      expect(runRepository.getById(created.id)!.premixConcentration).toBe(1.0)
    })

    it('T-14: create() persists oldBeadsOverride=true when provided', () => {
      const created = runRepository.create(basePayload({ oldBeadsOverride: true }))
      expect(runRepository.getById(created.id)!.oldBeadsOverride).toBe(true)
    })

    it('T-15: create() persists oldAntibodiesOverride=true when provided', () => {
      const created = runRepository.create(basePayload({ oldAntibodiesOverride: true }))
      expect(runRepository.getById(created.id)!.oldAntibodiesOverride).toBe(true)
    })

    it('T-16: create() persists calculationRulesVersion when provided', () => {
      const created = runRepository.create(basePayload({ calculationRulesVersion: 'smoke3' }))
      expect(runRepository.getById(created.id)!.calculationRulesVersion).toBe('smoke3')
    })

    it('T-17: create() with all 10 audit-trail fields supplied round-trips', () => {
      const payload = basePayload({
        sapeName: 'SAPE-A',
        sapeConcentration: 1.0,
        beadsDiluent: 'L-AB',
        antibodiesDiluent: 'L-AB',
        beadsVolumePerWell: 0.05,
        antibodiesVolumePerWell: 0.025,
        premixConcentration: 1.0,
        oldBeadsOverride: true,
        oldAntibodiesOverride: false,
        calculationRulesVersion: 'smoke3'
      })
      const created = runRepository.create(payload)
      const fetched = runRepository.getById(created.id)!
      expect(fetched.sapeName).toBe('SAPE-A')
      expect(fetched.sapeConcentration).toBe(1.0)
      expect(fetched.beadsDiluent).toBe('L-AB')
      expect(fetched.antibodiesDiluent).toBe('L-AB')
      expect(fetched.beadsVolumePerWell).toBe(0.05)
      expect(fetched.antibodiesVolumePerWell).toBe(0.025)
      expect(fetched.premixConcentration).toBe(1.0)
      expect(fetched.oldBeadsOverride).toBe(true)
      expect(fetched.oldAntibodiesOverride).toBe(false)
      expect(fetched.calculationRulesVersion).toBe('smoke3')
    })

    it('T-18: create() with audit-trail fields omitted defaults to NULL (8) / false (2) on read', () => {
      const created = runRepository.create(basePayload())
      const fetched = runRepository.getById(created.id)!
      expect(fetched.sapeName).toBeNull()
      expect(fetched.sapeConcentration).toBeNull()
      expect(fetched.beadsDiluent).toBeNull()
      expect(fetched.antibodiesDiluent).toBeNull()
      expect(fetched.beadsVolumePerWell).toBeNull()
      expect(fetched.antibodiesVolumePerWell).toBeNull()
      expect(fetched.premixConcentration).toBeNull()
      expect(fetched.calculationRulesVersion).toBeNull()
      expect(fetched.oldBeadsOverride).toBe(false)
      expect(fetched.oldAntibodiesOverride).toBe(false)
    })
  })
})
