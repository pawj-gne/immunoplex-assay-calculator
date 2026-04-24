import { ipcMain } from 'electron'
import { IPC_CHANNELS } from '../../shared/constants/channels'
import { runCreateSchema, runUpdateSchema } from '../../shared/validation/run'
import { getRunTransport } from '../transport'

// Phase 6 Plan 03: IPC handlers call through the transport interface, NOT
// runRepository directly. On server / local-only machines, getRunTransport()
// resolves to localTransport (direct repository calls). On client machines it
// resolves to httpTransport (HTTP fetch with offline fallback). Zod validation
// stays at the IPC boundary; the transport layer never re-validates.
export function registerRunHandlers(): void {
  ipcMain.handle(IPC_CHANNELS.RUN_GET_ALL, async () => {
    return getRunTransport().getAll()
  })

  ipcMain.handle(IPC_CHANNELS.RUN_GET_BY_ID, async (_, id: unknown) => {
    if (typeof id !== 'string') {
      throw new Error('id must be a string')
    }
    return getRunTransport().getById(id)
  })

  ipcMain.handle(IPC_CHANNELS.RUN_CREATE, async (_, data: unknown) => {
    const parsed = runCreateSchema.parse(data)
    return getRunTransport().create(parsed)
  })

  ipcMain.handle(IPC_CHANNELS.RUN_UPDATE, async (_, id: unknown, data: unknown) => {
    if (typeof id !== 'string') {
      throw new Error('id must be a string')
    }
    // runUpdateSchema === runCreateSchema (ISSUE 3): unified contract.
    const parsed = runUpdateSchema.parse(data)
    return getRunTransport().update(id, parsed)
  })

  ipcMain.handle(IPC_CHANNELS.RUN_DELETE, async (_, id: unknown) => {
    if (typeof id !== 'string') {
      throw new Error('id must be a string')
    }
    await getRunTransport().delete(id)
  })
}
