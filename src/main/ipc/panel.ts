import { ipcMain } from 'electron'
import { IPC_CHANNELS } from '../../shared/constants/channels'
import { panelRepository } from '../db/repositories/panel'

export function registerPanelHandlers(): void {
  ipcMain.handle(
    IPC_CHANNELS.PANEL_GET_BY_PLATFORM_SPECIES,
    async (_, platformId: unknown, speciesId: unknown) => {
      if (typeof platformId !== 'string') {
        throw new Error('Invalid platform ID')
      }
      if (typeof speciesId !== 'string') {
        throw new Error('Invalid species ID')
      }
      return panelRepository.getByPlatformAndSpecies(platformId, speciesId)
    }
  )

  ipcMain.handle(IPC_CHANNELS.PANEL_GET_WITH_ANALYTES, async (_, panelId: unknown) => {
    if (typeof panelId !== 'string') {
      throw new Error('Invalid panel ID')
    }
    return panelRepository.getWithAnalytes(panelId)
  })
}
