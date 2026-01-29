import { ipcMain } from 'electron'
import { z } from 'zod'
import { IPC_CHANNELS } from '../../shared/constants/channels'
import { panelRepository } from '../db/repositories/panel'

const panelUpdateSchema = z.object({
  id: z.string(),
  name: z.string().optional(),
  description: z.string().nullable().optional()
})

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

  ipcMain.handle(IPC_CHANNELS.PANEL_UPDATE, async (_, data: unknown) => {
    const parsed = panelUpdateSchema.parse(data)
    const { id, ...updates } = parsed
    return panelRepository.update(id, updates)
  })

  ipcMain.handle(IPC_CHANNELS.PANEL_DELETE, async (_, id: unknown) => {
    if (typeof id !== 'string') throw new Error('Invalid panel ID')
    panelRepository.delete(id)
  })

  ipcMain.handle(
    IPC_CHANNELS.PANEL_ADD_ANALYTE,
    async (_, panelId: unknown, analyteId: unknown) => {
      if (typeof panelId !== 'string') throw new Error('Invalid panel ID')
      if (typeof analyteId !== 'string') throw new Error('Invalid analyte ID')
      panelRepository.addAnalyteToPanel(panelId, analyteId)
    }
  )

  ipcMain.handle(
    IPC_CHANNELS.PANEL_REMOVE_ANALYTE,
    async (_, panelId: unknown, analyteId: unknown) => {
      if (typeof panelId !== 'string') throw new Error('Invalid panel ID')
      if (typeof analyteId !== 'string') throw new Error('Invalid analyte ID')
      panelRepository.removeAnalyteFromPanel(panelId, analyteId)
    }
  )
}
