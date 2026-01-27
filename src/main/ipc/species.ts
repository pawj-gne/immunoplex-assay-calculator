import { ipcMain } from 'electron'
import { IPC_CHANNELS } from '../../shared/constants/channels'
import { speciesRepository } from '../db/repositories/species'

export function registerSpeciesHandlers(): void {
  ipcMain.handle(IPC_CHANNELS.SPECIES_GET_BY_PLATFORM, async (_, platformId: unknown) => {
    if (typeof platformId !== 'string') {
      throw new Error('Invalid platform ID')
    }
    return speciesRepository.getByPlatformId(platformId)
  })
}
