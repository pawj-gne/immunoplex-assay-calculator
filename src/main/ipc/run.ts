import { ipcMain } from 'electron'
import { IPC_CHANNELS } from '../../shared/constants/channels'
import { runCreateSchema, runUpdateSchema } from '../../shared/validation/run'
import { runRepository } from '../db/repositories/run'

export function registerRunHandlers(): void {
  ipcMain.handle(IPC_CHANNELS.RUN_GET_ALL, async () => {
    return runRepository.getAll()
  })

  ipcMain.handle(IPC_CHANNELS.RUN_GET_BY_ID, async (_, id: unknown) => {
    if (typeof id !== 'string') {
      throw new Error('id must be a string')
    }
    return runRepository.getById(id)
  })

  ipcMain.handle(IPC_CHANNELS.RUN_CREATE, async (_, data: unknown) => {
    const parsed = runCreateSchema.parse(data)
    return runRepository.create(parsed)
  })

  ipcMain.handle(IPC_CHANNELS.RUN_UPDATE, async (_, id: unknown, data: unknown) => {
    if (typeof id !== 'string') {
      throw new Error('id must be a string')
    }
    // runUpdateSchema === runCreateSchema (ISSUE 3): unified contract.
    const parsed = runUpdateSchema.parse(data)
    return runRepository.update(id, parsed)
  })

  ipcMain.handle(IPC_CHANNELS.RUN_DELETE, async (_, id: unknown) => {
    if (typeof id !== 'string') {
      throw new Error('id must be a string')
    }
    runRepository.delete(id)
  })
}
