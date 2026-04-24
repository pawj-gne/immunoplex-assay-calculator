import { ipcMain } from 'electron'
import { IPC_CHANNELS } from '../../shared/constants/channels'
import { operatorCreateSchema, operatorUpdateSchema } from '../../shared/validation/operator'
import { getOperatorTransport } from '../transport'

// Phase 6 Plan 03: IPC handlers call through the transport interface, NOT
// operatorRepository directly. On server / local-only machines, this resolves
// to localTransport (direct repository calls). On client machines it resolves
// to httpTransport (HTTP fetch). Zod validation stays at the IPC boundary.
export function registerOperatorHandlers(): void {
  ipcMain.handle(IPC_CHANNELS.OPERATOR_GET_ALL, async (_, opts: unknown) => {
    const includeInactive =
      typeof opts === 'object' &&
      opts !== null &&
      (opts as { includeInactive?: unknown }).includeInactive === true
    return getOperatorTransport().getAll({ includeInactive })
  })

  ipcMain.handle(IPC_CHANNELS.OPERATOR_CREATE, async (_, data: unknown) => {
    const parsed = operatorCreateSchema.parse(data)
    return getOperatorTransport().create(parsed)
  })

  ipcMain.handle(IPC_CHANNELS.OPERATOR_UPDATE, async (_, id: unknown, data: unknown) => {
    if (typeof id !== 'string') {
      throw new Error('id must be a string')
    }
    const parsed = operatorUpdateSchema.parse(data)
    return getOperatorTransport().update(id, parsed)
  })

  ipcMain.handle(IPC_CHANNELS.OPERATOR_DELETE, async (_, id: unknown) => {
    if (typeof id !== 'string') {
      throw new Error('id must be a string')
    }
    await getOperatorTransport().softDelete(id)
  })
}
