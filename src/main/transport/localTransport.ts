import { runRepository } from '../db/repositories/run'
import { operatorRepository } from '../db/repositories/operator'
import type { RunTransport, OperatorTransport } from './index'

// Phase 6 — Local transport: delegates directly to existing repositories.
// Used by:
//   - Server machines (D-09: server saves go directly to central DB, no HTTP hop)
//   - Local-only machines (D-03: no config.json, fully functional standalone)
//
// httpTransport (Plan 06-03) is the alternative implementation used on
// client machines, with this localTransport as the offline fallback.
export const localTransport: { run: RunTransport; operator: OperatorTransport } = {
  run: {
    getAll: () => runRepository.getAll(),
    getById: (id: string) => runRepository.getById(id),
    create: async (data) => runRepository.create(data),
    update: async (id, data) => runRepository.update(id, data),
    delete: async (id) => {
      runRepository.delete(id)
    }
  },
  operator: {
    getAll: (opts) => operatorRepository.getAll(opts),
    create: async (data) => operatorRepository.create(data),
    update: async (id, data) => operatorRepository.update(id, data),
    softDelete: async (id) => {
      operatorRepository.softDelete(id)
    }
  }
}
