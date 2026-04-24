import type { RunRecord, RunCreate, RunUpdate } from '../../shared/types/run'
import type { Operator, OperatorCreate, OperatorUpdate } from '../../shared/types/operator'
import { localTransport } from './localTransport'

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
 * httpTransport is loaded lazily because Plan 06-03 creates that module.
 * Until 06-03 lands, calling initTransport('http') logs a warning and
 * falls back to local — keeps the build green and the app functional in
 * a degraded local-only mode rather than crashing.
 */
export function initTransport(mode: 'local' | 'http', serverUrl?: string): void {
  if (mode === 'http' && serverUrl) {
    try {
      // Lazy require avoids module-load failure when httpTransport.ts doesn't exist yet.
      const httpTransportModule = require('./httpTransport') as {
        httpTransport: {
          init: (url: string) => void
          run: RunTransport
          operator: OperatorTransport
        }
      }
      httpTransportModule.httpTransport.init(serverUrl)
      activeRunTransport = httpTransportModule.httpTransport.run
      activeOperatorTransport = httpTransportModule.httpTransport.operator
    } catch (err) {
      console.warn(
        '[transport] httpTransport not available yet (Plan 06-03 not landed); falling back to local:',
        err
      )
    }
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
 * Plan 06-03 will replace this stub with a real reconnect poller (setInterval +
 * fetch /api/health, push connection:status IPC events, trigger flush). Stubbed
 * here so index.ts can import it now and the build stays green.
 */
export function startReconnectPoller(_mainWindow: unknown): void {
  // Stub — Plan 06-03 implementation
}
