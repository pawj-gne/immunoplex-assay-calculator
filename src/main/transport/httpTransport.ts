// Phase 6 Plan 03 — Client-mode HTTP transport.
//
// Used on machines with config.isServer === false. Wraps fetch() against the
// central server's REST API and falls back to immunoplex-local.db + offline_queue
// when the server is unreachable. A background reconnect poller (5s interval,
// 2s timeout) detects state changes, pushes connection:status IPC events to the
// renderer, and triggers an automatic queue flush on reconnect.
//
// References:
//   - D-07 / NET-03: offline path writes to local DB and enqueues for flush
//   - D-08 / NET-04: queue flush in insertion order; dequeue only after 200/200-idempotent
//   - D-04 / Pattern 7: connection:status IPC push so renderer can show offline banner
//   - RESEARCH Pitfall 4: isFlushing mutex prevents flush ↔ concurrent-save race
//   - RESEARCH §"Don't Hand-Roll": fetchWithTimeout via AbortController + setTimeout
import os from 'os'
import type { BrowserWindow } from 'electron'
import { IPC_CHANNELS } from '../../shared/constants/channels'
import { offlineQueueRepository } from '../db/repositories/offlineQueue'
import { runRepository } from '../db/repositories/run'
import { operatorRepository } from '../db/repositories/operator'
import type { RunTransport, OperatorTransport } from './index'
import type { RunCreate, RunUpdate, RunRecord } from '../../shared/types/run'
import type { Operator, OperatorCreate, OperatorUpdate } from '../../shared/types/operator'

// ─── Module-level state (singleton — same pattern as db/client.ts) ───────────
let serverUrl: string | null = null
let isOnline = false
let isFlushing = false // mutex — RESEARCH Pitfall 4

/**
 * Called once at startup from initTransport('http', url). Stores the base URL
 * for all subsequent fetch() calls.
 */
export function init(url: string): void {
  serverUrl = url
}

/**
 * AbortController-based fetch timeout. Node 20's built-in fetch supports
 * AbortSignal; setTimeout fires .abort() to short-circuit hung requests.
 */
async function fetchWithTimeout(
  url: string,
  opts: RequestInit = {},
  ms = 2000
): Promise<Response> {
  const ctrl = new AbortController()
  const timer = setTimeout(() => ctrl.abort(), ms)
  try {
    return await fetch(url, { ...opts, signal: ctrl.signal })
  } finally {
    clearTimeout(timer)
  }
}

/**
 * Background reconnect poller — client mode only. Hits /api/health every 5s.
 * On state change, pushes connection:status to the renderer (D-04). On
 * online-transition, kicks off an automatic offline queue flush (D-08).
 */
export function startReconnectPoller(mainWindow: BrowserWindow): void {
  if (!serverUrl) return
  setInterval(async () => {
    const wasOnline = isOnline
    try {
      const res = await fetchWithTimeout(`${serverUrl}/api/health`, {}, 2000)
      isOnline = res.ok
    } catch {
      isOnline = false
    }
    if (isOnline !== wasOnline) {
      try {
        mainWindow.webContents.send(IPC_CHANNELS.CONNECTION_STATUS, { online: isOnline })
      } catch {
        // Window may have been destroyed (app quit in flight); ignore silently.
      }
      if (isOnline && !isFlushing) {
        void flushOfflineQueue()
      }
    }
  }, 5000)
}

/**
 * Flushes the offline queue to the server in insertion order (D-08, NET-04).
 * Each item is removed only AFTER server confirmation (200 fresh, 201 created,
 * or 409 duplicate — all are safe to dequeue). On any non-retriable response
 * or network error, breaks out and retries on the next reconnect cycle.
 *
 * isFlushing mutex prevents concurrent invocation (RESEARCH Pitfall 4).
 */
export async function flushOfflineQueue(): Promise<void> {
  if (!serverUrl || isFlushing) return
  isFlushing = true
  try {
    const items = offlineQueueRepository.getAll() // ORDER BY id ASC
    for (const item of items) {
      try {
        let res: Response
        const payload = JSON.parse(item.payload) as Record<string, unknown>
        if (item.operation === 'create') {
          res = await fetchWithTimeout(
            `${serverUrl}/api/runs`,
            {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: item.payload
            },
            5000
          )
        } else if (item.operation === 'update') {
          // Update payload was stringified as { id, ...data }; the server
          // route is PUT /api/runs/:id with body = data (without id).
          const { id, ...data } = payload
          res = await fetchWithTimeout(
            `${serverUrl}/api/runs/${String(id)}`,
            {
              method: 'PUT',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(data)
            },
            5000
          )
        } else if (item.operation === 'delete') {
          res = await fetchWithTimeout(
            `${serverUrl}/api/runs/${String(payload.id)}`,
            { method: 'DELETE' },
            5000
          )
        } else {
          // Unknown operation — skip and remove to avoid blocking the queue.
          offlineQueueRepository.dequeue(item.id)
          continue
        }
        // 2xx (including 200-idempotent and 201-created) and 409-duplicate are
        // all safe to dequeue: the server has the row.
        if (res.ok || res.status === 409) {
          offlineQueueRepository.dequeue(item.id)
        } else {
          // Non-retriable error (4xx other than 409, 5xx). Stop here; retry on
          // the next reconnect cycle. Subsequent items remain queued in order.
          break
        }
      } catch {
        // Network error mid-flush. Stop here; retry on next reconnect cycle.
        break
      }
    }
  } finally {
    isFlushing = false
  }
}

// ─── Transport implementations ──────────────────────────────────────────────

const runTransport: RunTransport = {
  getAll(): RunRecord[] {
    // Local-DB read: the local DB mirrors what we've seen from the server.
    // For v1 a periodic re-fetch from the server is out of scope; reads always
    // resolve from local. (The list will be eventually-consistent: any rows
    // saved while offline are visible immediately; rows saved on other
    // machines appear after the next user action that triggers a sync.)
    return runRepository.getAll()
  },

  getById(id: string): RunRecord | null {
    return runRepository.getById(id)
  },

  async create(data: RunCreate): Promise<RunRecord> {
    // D-02: stamp machine provenance on every save.
    const enriched = { ...data, machineName: os.hostname() }
    if (!isOnline || !serverUrl || isFlushing) {
      // Offline path (D-07, NET-03): save locally with isOfflineSave=true and
      // enqueue for flush. The local row's id becomes the idempotency key.
      const localRun = runRepository.create({
        ...enriched,
        isOfflineSave: true
      } as RunCreate)
      offlineQueueRepository.enqueue({
        runId: localRun.id,
        operation: 'create',
        payload: JSON.stringify({ ...enriched, id: localRun.id, isOfflineSave: true })
      })
      return localRun
    }
    // Online path: POST to server; on any failure fall back to local + queue.
    try {
      const res = await fetchWithTimeout(
        `${serverUrl}/api/runs`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ...enriched, isOfflineSave: false })
        },
        5000
      )
      if (!res.ok) throw new Error(`Server error ${res.status}`)
      return (await res.json()) as RunRecord
    } catch {
      // Mid-request network failure — flip offline and fall back.
      isOnline = false
      const localRun = runRepository.create({
        ...enriched,
        isOfflineSave: true
      } as RunCreate)
      offlineQueueRepository.enqueue({
        runId: localRun.id,
        operation: 'create',
        payload: JSON.stringify({ ...enriched, id: localRun.id, isOfflineSave: true })
      })
      return localRun
    }
  },

  async update(id: string, data: RunUpdate): Promise<RunRecord | null> {
    const enriched = { ...data, machineName: os.hostname() }
    if (!isOnline || !serverUrl || isFlushing) {
      const localRun = runRepository.update(id, {
        ...enriched,
        isOfflineSave: true
      } as RunUpdate)
      offlineQueueRepository.enqueue({
        runId: id,
        operation: 'update',
        payload: JSON.stringify({ id, ...enriched, isOfflineSave: true })
      })
      return localRun
    }
    try {
      const res = await fetchWithTimeout(
        `${serverUrl}/api/runs/${id}`,
        {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ...enriched, isOfflineSave: false })
        },
        5000
      )
      if (!res.ok) throw new Error(`Server error ${res.status}`)
      return (await res.json()) as RunRecord
    } catch {
      isOnline = false
      const localRun = runRepository.update(id, {
        ...enriched,
        isOfflineSave: true
      } as RunUpdate)
      offlineQueueRepository.enqueue({
        runId: id,
        operation: 'update',
        payload: JSON.stringify({ id, ...enriched, isOfflineSave: true })
      })
      return localRun
    }
  },

  async delete(id: string): Promise<void> {
    if (!isOnline || !serverUrl || isFlushing) {
      runRepository.delete(id)
      offlineQueueRepository.enqueue({
        runId: id,
        operation: 'delete',
        payload: JSON.stringify({ id })
      })
      return
    }
    try {
      const res = await fetchWithTimeout(
        `${serverUrl}/api/runs/${id}`,
        { method: 'DELETE' },
        5000
      )
      if (!res.ok) throw new Error(`Server error ${res.status}`)
      runRepository.delete(id)
    } catch {
      isOnline = false
      runRepository.delete(id)
      offlineQueueRepository.enqueue({
        runId: id,
        operation: 'delete',
        payload: JSON.stringify({ id })
      })
    }
  }
}

const operatorTransport: OperatorTransport = {
  getAll(opts: { includeInactive: boolean }): Operator[] {
    return operatorRepository.getAll(opts)
  },
  async create(data: OperatorCreate): Promise<Operator> {
    if (!isOnline || !serverUrl) {
      return operatorRepository.create(data)
    }
    try {
      const res = await fetchWithTimeout(
        `${serverUrl}/api/operators`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(data)
        },
        5000
      )
      if (!res.ok) throw new Error(`Server error ${res.status}`)
      return (await res.json()) as Operator
    } catch {
      isOnline = false
      return operatorRepository.create(data)
    }
  },
  async update(id: string, data: OperatorUpdate): Promise<Operator | null> {
    if (!isOnline || !serverUrl) {
      return operatorRepository.update(id, data)
    }
    try {
      const res = await fetchWithTimeout(
        `${serverUrl}/api/operators/${id}`,
        {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(data)
        },
        5000
      )
      if (!res.ok) throw new Error(`Server error ${res.status}`)
      return (await res.json()) as Operator
    } catch {
      isOnline = false
      return operatorRepository.update(id, data)
    }
  },
  async softDelete(id: string): Promise<void> {
    if (!isOnline || !serverUrl) {
      operatorRepository.softDelete(id)
      return
    }
    try {
      const res = await fetchWithTimeout(
        `${serverUrl}/api/operators/${id}`,
        { method: 'DELETE' },
        5000
      )
      if (!res.ok) throw new Error(`Server error ${res.status}`)
      operatorRepository.softDelete(id)
    } catch {
      isOnline = false
      operatorRepository.softDelete(id)
    }
  }
}

/**
 * Public entry point used by transport/index.ts. Matches the shape that
 * initTransport('http') expects: { init, run, operator }.
 */
export const httpTransport = {
  init,
  run: runTransport,
  operator: operatorTransport
}

// ─── Test-only state helpers ────────────────────────────────────────────────
//
// httpTransport.test.ts needs to drive isOnline/isFlushing directly to exercise
// the offline path, the online path, and the flush race. These are NOT exported
// from the production surface (httpTransport object); tests import them by name.

/**
 * TEST-ONLY: forces isOnline to a specific value to exercise online vs offline
 * code paths without standing up a real server.
 */
export function setIsOnlineForTests(value: boolean): void {
  isOnline = value
}

/**
 * TEST-ONLY: snapshot of the current isOnline flag (for assertions).
 */
export function getIsOnlineForTests(): boolean {
  return isOnline
}

/**
 * TEST-ONLY: resets module-level state between tests.
 */
export function resetHttpTransportForTests(): void {
  serverUrl = null
  isOnline = false
  isFlushing = false
}
