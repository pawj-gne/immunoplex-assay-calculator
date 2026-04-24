import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { createTestDb, seedPlatformAndSpecies } from '../../db/__tests__/testDb'
import {
  setLocalDatabaseForTests,
  resetLocalDatabaseForTests
} from '../../db/clientLocal'
import {
  setDatabaseForTests,
  setSqliteForTests,
  resetDatabaseForTests
} from '../../db/client'
import {
  httpTransport,
  flushOfflineQueue,
  setIsOnlineForTests,
  resetHttpTransportForTests
} from '../httpTransport'
import { offlineQueueRepository } from '../../db/repositories/offlineQueue'
import type { RunCreate } from '../../../shared/types/run'

// Phase 6 Plan 03 — httpTransport unit tests covering:
//   - NET-03: enqueue on offline create (no fetch issued)
//   - NET-04: queue dequeue after server confirms (200 / 201 / 409)
//   - NET-04: insertion-order preservation (id ASC)
//   - Pitfall 4: isFlushing mutex (concurrent saves still enqueue)
//
// The integration path (Express server end-to-end) is covered in
// expressServer.test.ts. These tests focus on transport-layer behavior
// with global fetch stubbed.

let operatorId: string
let platformId: string
let speciesId: string

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

beforeEach(() => {
  // Single in-memory DB injected as BOTH the local DB (offlineQueueRepository
  // reads/writes via getLocalDatabase) and the central DB (runRepository reads/
  // writes via getDatabase). In production these are separate files; for the
  // unit test it's safe to share one in-memory DB because both sides only
  // touch tables they own.
  const test = createTestDb()
  setLocalDatabaseForTests(test.db)
  setDatabaseForTests(test.db)
  setSqliteForTests(test.sqlite)

  // Seed FK parents required for runs INSERT.
  const seeded = seedPlatformAndSpecies(test.sqlite)
  platformId = seeded.platformId
  speciesId = seeded.speciesId
  operatorId = crypto.randomUUID()
  const now = new Date().toISOString()
  test.sqlite
    .prepare(
      `INSERT INTO operators (id, name, active, created_at, updated_at)
       VALUES (?, 'Test Op', 1, ?, ?)`
    )
    .run(operatorId, now, now)

  // httpTransport module-level state must be reset between tests to avoid
  // leakage of isOnline / isFlushing / serverUrl from a prior test.
  resetHttpTransportForTests()
  httpTransport.init('http://192.168.1.10:3847')

  vi.stubGlobal('fetch', vi.fn())
})

afterEach(() => {
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
  resetLocalDatabaseForTests()
  resetDatabaseForTests()
  resetHttpTransportForTests()
})

describe('offline queue — NET-03 (enqueue on network failure)', () => {
  it('enqueues a create operation when isOnline is false (no fetch issued)', async () => {
    setIsOnlineForTests(false)
    const fetchSpy = vi.fn()
    vi.stubGlobal('fetch', fetchSpy)

    const payload = buildValidRunPayload()
    const created = await httpTransport.run.create(payload)

    // Fetch must NOT be called on the offline path — straight to local + queue.
    expect(fetchSpy).not.toHaveBeenCalled()

    const queued = offlineQueueRepository.getAll()
    expect(queued).toHaveLength(1)
    expect(queued[0]?.operation).toBe('create')
    expect(queued[0]?.runId).toBe(created.id)

    // The local row must carry provenance (machineName + isOfflineSave=true).
    expect(created.isOfflineSave).toBe(true)
    expect(created.machineName).not.toBeNull()
  })

  it('falls back to local + enqueue when the online POST throws', async () => {
    setIsOnlineForTests(true)
    const fetchSpy = vi.fn().mockRejectedValue(new Error('network error'))
    vi.stubGlobal('fetch', fetchSpy)

    const payload = buildValidRunPayload()
    const created = await httpTransport.run.create(payload)

    // Fetch was attempted exactly once before the catch path fired.
    expect(fetchSpy).toHaveBeenCalledTimes(1)

    const queued = offlineQueueRepository.getAll()
    expect(queued).toHaveLength(1)
    expect(queued[0]?.operation).toBe('create')
    expect(queued[0]?.runId).toBe(created.id)
    expect(created.isOfflineSave).toBe(true)
  })
})

describe('queue flush — NET-04 (dequeue on server confirm)', () => {
  it('removes an item from the queue when fetch returns 200', async () => {
    setIsOnlineForTests(true)
    // Pre-seed one queued create so flush has something to send.
    const payload = buildValidRunPayload()
    offlineQueueRepository.enqueue({
      runId: 'pre-seeded-id',
      operation: 'create',
      payload: JSON.stringify({ ...payload, id: 'pre-seeded-id', isOfflineSave: true })
    })
    expect(offlineQueueRepository.getAll()).toHaveLength(1)

    // Server returns 200 (idempotent — row already exists). Item must dequeue.
    const fetchSpy = vi
      .fn()
      .mockResolvedValue(
        new Response(JSON.stringify({ id: 'pre-seeded-id' }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' }
        })
      )
    vi.stubGlobal('fetch', fetchSpy)

    await flushOfflineQueue()

    expect(fetchSpy).toHaveBeenCalledTimes(1)
    expect(offlineQueueRepository.getAll()).toHaveLength(0)
  })

  it('removes an item from the queue when fetch returns 409 (server already has it)', async () => {
    setIsOnlineForTests(true)
    const payload = buildValidRunPayload()
    offlineQueueRepository.enqueue({
      runId: 'dup-id',
      operation: 'create',
      payload: JSON.stringify({ ...payload, id: 'dup-id', isOfflineSave: true })
    })

    const fetchSpy = vi
      .fn()
      .mockResolvedValue(
        new Response(JSON.stringify({ error: 'duplicate' }), {
          status: 409,
          headers: { 'Content-Type': 'application/json' }
        })
      )
    vi.stubGlobal('fetch', fetchSpy)

    await flushOfflineQueue()

    expect(offlineQueueRepository.getAll()).toHaveLength(0)
  })

  it('keeps the item in the queue and stops on a 500 error', async () => {
    setIsOnlineForTests(true)
    const payload = buildValidRunPayload()
    offlineQueueRepository.enqueue({
      runId: 'fail-1',
      operation: 'create',
      payload: JSON.stringify({ ...payload, id: 'fail-1', isOfflineSave: true })
    })
    offlineQueueRepository.enqueue({
      runId: 'fail-2',
      operation: 'create',
      payload: JSON.stringify({ ...payload, id: 'fail-2', isOfflineSave: true })
    })

    const fetchSpy = vi
      .fn()
      .mockResolvedValue(new Response('server error', { status: 500 }))
    vi.stubGlobal('fetch', fetchSpy)

    await flushOfflineQueue()

    // First item failed → break. Second item never POSTed; both still queued.
    expect(fetchSpy).toHaveBeenCalledTimes(1)
    const remaining = offlineQueueRepository.getAll()
    expect(remaining).toHaveLength(2)
  })

  it('preserves insertion order (id ASC) across flush', () => {
    offlineQueueRepository.enqueue({
      runId: 'run-1',
      operation: 'create',
      payload: '{"seq":1}'
    })
    offlineQueueRepository.enqueue({
      runId: 'run-2',
      operation: 'create',
      payload: '{"seq":2}'
    })
    offlineQueueRepository.enqueue({
      runId: 'run-3',
      operation: 'delete',
      payload: '{"id":"run-3"}'
    })

    const items = offlineQueueRepository.getAll()
    expect(items).toHaveLength(3)
    expect(items[0]?.runId).toBe('run-1')
    expect(items[1]?.runId).toBe('run-2')
    expect(items[2]?.runId).toBe('run-3')
  })
})

describe('isFlushing mutex — Pitfall 4 (concurrent flush + save)', () => {
  it('routes a save to the offline queue while a flush is in progress', async () => {
    setIsOnlineForTests(true)
    // Pre-seed a queued item so flush has work to do.
    const payload = buildValidRunPayload()
    offlineQueueRepository.enqueue({
      runId: 'flush-1',
      operation: 'create',
      payload: JSON.stringify({ ...payload, id: 'flush-1', isOfflineSave: true })
    })

    // Stub fetch so the flush takes a measurable amount of time. While the
    // mocked fetch promise is pending, isFlushing === true and a concurrent
    // create() should fall through to the local + queue path even though
    // isOnline === true.
    let resolveFetch: (v: Response) => void = () => {}
    const fetchSpy = vi.fn().mockImplementation(
      () =>
        new Promise<Response>((resolve) => {
          resolveFetch = resolve
        })
    )
    vi.stubGlobal('fetch', fetchSpy)

    // Start flush but do NOT await it yet.
    const flushPromise = flushOfflineQueue()

    // Allow the microtask queue to advance so flush enters its for-loop and
    // sets isFlushing=true before the next await runs.
    await Promise.resolve()

    // Concurrent save while flush is still pending.
    const concurrentRun = await httpTransport.run.create(buildValidRunPayload())

    // The concurrent save must have gone to the queue (offline path), not
    // issued its own fetch. Fetch was called only by the flush itself.
    expect(fetchSpy).toHaveBeenCalledTimes(1)
    expect(concurrentRun.isOfflineSave).toBe(true)

    // Now let the flush complete with a 200 (idempotent).
    resolveFetch(
      new Response(JSON.stringify({ id: 'flush-1' }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      })
    )
    await flushPromise

    // After flush completes, the pre-seeded row is gone, but the concurrent
    // save remains queued for the next reconnect cycle to pick up.
    const remaining = offlineQueueRepository.getAll()
    expect(remaining).toHaveLength(1)
    expect(remaining[0]?.runId).toBe(concurrentRun.id)
  })
})
