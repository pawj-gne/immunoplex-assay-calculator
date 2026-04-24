import type { BrowserWindow } from 'electron'
import type { RunRecord, RunCreate, RunUpdate } from '../../shared/types/run'
import type { Operator, OperatorCreate, OperatorUpdate } from '../../shared/types/operator'
import { localTransport } from './localTransport'
import {
  httpTransport as _httpTransport,
  startReconnectPoller as _startReconnectPoller
} from './httpTransport'

// Phase 6 — Transport interfaces. Implemented by:
//   - localTransport (server/local-only mode — direct repository calls)
//   - httpTransport (client mode — HTTP fetch with offline fallback; Plan 06-03)
//
// IPC handlers call through these getters, NOT repositories directly. This
// is the seam where the network/local switch happens at startup.
export interface RunTransport {
  getAll(): RunRecord[]
  getById(id: string): RunRecord | null
  create(data: RunCreate): Promise<RunRecord>
  update(id: string, data: RunUpdate): Promise<RunRecord | null>
  delete(id: string): Promise<void>
}

export interface OperatorTransport {
  getAll(opts: { includeInactive: boolean }): Operator[]
  create(data: OperatorCreate): Promise<Operator>
  update(id: string, data: OperatorUpdate): Promise<Operator | null>
  softDelete(id: string): Promise<void>
}

// Module-level transport singletons — default to local (server/local-only mode).
// Switched to httpTransport at startup if config.isServer === false.
let activeRunTransport: RunTransport = localTransport.run
let activeOperatorTransport: OperatorTransport = localTransport.operator

/**
 * Called once at startup in index.ts after DB init.
 *   'local' = server machine or local-only mode (direct repository calls)
 *   'http'  = client machine (HTTP calls with offline fallback)
 *
 * Plan 06-01 used a lazy require here because httpTransport.ts didn't exist yet.
 * Plan 06-03 created httpTransport.ts so this is now a regular top-level import.
 */
export function initTransport(mode: 'local' | 'http', serverUrl?: string): void {
  if (mode === 'http' && serverUrl) {
    _httpTransport.init(serverUrl)
    activeRunTransport = _httpTransport.run
    activeOperatorTransport = _httpTransport.operator
  }
  // 'local' (default) leaves module vars as localTransport
}

export function getRunTransport(): RunTransport {
  return activeRunTransport
}
export function getOperatorTransport(): OperatorTransport {
  return activeOperatorTransport
}

/**
 * Phase 6 Plan 03: real reconnect poller implementation lives in
 * httpTransport.ts. This forwarder keeps index.ts's import surface stable
 * (single `from './transport'` line for both initTransport + startReconnectPoller).
 */
export function startReconnectPoller(mainWindow: BrowserWindow): void {
  _startReconnectPoller(mainWindow)
}
