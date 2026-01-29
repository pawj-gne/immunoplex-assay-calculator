import { ipcMain } from 'electron'
import { z } from 'zod'
import { IPC_CHANNELS } from '../../shared/constants/channels'
import { analyteRepository } from '../db/repositories/analyte'

const analyteUpdateSchema = z.object({
  id: z.string(),
  name: z.string().optional(),
  beadRegion: z.number().optional(),
  premixConc: z.number().optional(),
  singleConc: z.number().optional()
})

export function registerAnalyteHandlers(): void {
  ipcMain.handle(
    IPC_CHANNELS.ANALYTE_GET_BY_PLATFORM_SPECIES,
    async (_, platformId: unknown, speciesId: unknown) => {
      if (typeof platformId !== 'string') {
        throw new Error('Invalid platform ID')
      }
      if (typeof speciesId !== 'string') {
        throw new Error('Invalid species ID')
      }
      return analyteRepository.getByPlatformAndSpecies(platformId, speciesId)
    }
  )

  ipcMain.handle(IPC_CHANNELS.ANALYTE_GET_BY_PANEL, async (_, panelId: unknown) => {
    if (typeof panelId !== 'string') {
      throw new Error('Invalid panel ID')
    }
    return analyteRepository.getByPanelId(panelId)
  })

  ipcMain.handle(IPC_CHANNELS.ANALYTE_UPDATE, async (_, data: unknown) => {
    const parsed = analyteUpdateSchema.parse(data)
    const { id, ...updates } = parsed
    return analyteRepository.update(id, updates)
  })

  ipcMain.handle(IPC_CHANNELS.ANALYTE_DELETE, async (_, id: unknown) => {
    if (typeof id !== 'string') throw new Error('Invalid analyte ID')
    analyteRepository.delete(id)
  })
}
