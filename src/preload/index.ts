import { contextBridge, ipcRenderer } from 'electron'
import { IPC_CHANNELS } from '../shared/constants/channels'

// Expose protected methods that allow the renderer process to use
// ipcRenderer without exposing the entire object
contextBridge.exposeInMainWorld('electronAPI', {
  platform: {
    getAll: () => ipcRenderer.invoke(IPC_CHANNELS.PLATFORM_GET_ALL),
    getById: (id: string) => ipcRenderer.invoke(IPC_CHANNELS.PLATFORM_GET_BY_ID, id),
    create: (data: unknown) => ipcRenderer.invoke(IPC_CHANNELS.PLATFORM_CREATE, data),
    update: (data: unknown) => ipcRenderer.invoke(IPC_CHANNELS.PLATFORM_UPDATE, data)
  },
  species: {
    getByPlatformId: (platformId: string) =>
      ipcRenderer.invoke(IPC_CHANNELS.SPECIES_GET_BY_PLATFORM, platformId)
  },
  panel: {
    getByPlatformAndSpecies: (platformId: string, speciesId: string) =>
      ipcRenderer.invoke(IPC_CHANNELS.PANEL_GET_BY_PLATFORM_SPECIES, platformId, speciesId),
    getWithAnalytes: (panelId: string) =>
      ipcRenderer.invoke(IPC_CHANNELS.PANEL_GET_WITH_ANALYTES, panelId)
  },
  analyte: {
    getByPlatformAndSpecies: (platformId: string, speciesId: string) =>
      ipcRenderer.invoke(IPC_CHANNELS.ANALYTE_GET_BY_PLATFORM_SPECIES, platformId, speciesId),
    getByPanelId: (panelId: string) => ipcRenderer.invoke(IPC_CHANNELS.ANALYTE_GET_BY_PANEL, panelId)
  },
  db: {
    health: () => ipcRenderer.invoke(IPC_CHANNELS.DB_HEALTH)
  },
  print: {
    prepSheet: () => ipcRenderer.invoke(IPC_CHANNELS.PRINT_PREP_SHEET)
  },
  import: {
    panelData: () => ipcRenderer.invoke(IPC_CHANNELS.IMPORT_PANEL_DATA)
  }
})
