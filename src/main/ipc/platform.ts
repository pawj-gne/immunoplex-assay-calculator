import { ipcMain } from 'electron'
import { IPC_CHANNELS } from '../../shared/constants/channels'
import { platformCreateSchema, platformUpdateSchema } from '../../shared/validation/platform'
import { platformRepository } from '../db/repositories/platform'

export function registerPlatformHandlers(): void {
  ipcMain.handle(IPC_CHANNELS.PLATFORM_GET_ALL, async () => {
    return platformRepository.getAll()
  })

  ipcMain.handle(IPC_CHANNELS.PLATFORM_GET_BY_ID, async (_, id: unknown) => {
    if (typeof id !== 'string') {
      throw new Error('Invalid platform ID')
    }
    return platformRepository.getById(id)
  })

  ipcMain.handle(IPC_CHANNELS.PLATFORM_CREATE, async (_, data: unknown) => {
    const validated = platformCreateSchema.parse(data)
    return platformRepository.create(validated)
  })

  ipcMain.handle(IPC_CHANNELS.PLATFORM_UPDATE, async (_, data: unknown) => {
    const validated = platformUpdateSchema.parse(data)
    return platformRepository.update(validated)
  })
}
