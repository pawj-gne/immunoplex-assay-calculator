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
      ipcRenderer.invoke(IPC_CHANNELS.PANEL_GET_WITH_ANALYTES, panelId),
    update: (data: unknown) => ipcRenderer.invoke(IPC_CHANNELS.PANEL_UPDATE, data),
    delete: (id: string) => ipcRenderer.invoke(IPC_CHANNELS.PANEL_DELETE, id),
    addAnalyte: (panelId: string, analyteId: string) =>
      ipcRenderer.invoke(IPC_CHANNELS.PANEL_ADD_ANALYTE, panelId, analyteId),
    removeAnalyte: (panelId: string, analyteId: string) =>
      ipcRenderer.invoke(IPC_CHANNELS.PANEL_REMOVE_ANALYTE, panelId, analyteId)
  },
  analyte: {
    getByPlatformAndSpecies: (platformId: string, speciesId: string) =>
      ipcRenderer.invoke(IPC_CHANNELS.ANALYTE_GET_BY_PLATFORM_SPECIES, platformId, speciesId),
    getByPanelId: (panelId: string) =>
      ipcRenderer.invoke(IPC_CHANNELS.ANALYTE_GET_BY_PANEL, panelId),
    update: (data: unknown) => ipcRenderer.invoke(IPC_CHANNELS.ANALYTE_UPDATE, data),
    delete: (id: string) => ipcRenderer.invoke(IPC_CHANNELS.ANALYTE_DELETE, id)
  },
  db: {
    health: () => ipcRenderer.invoke(IPC_CHANNELS.DB_HEALTH)
  },
  print: {
    prepSheet: () => ipcRenderer.invoke(IPC_CHANNELS.PRINT_PREP_SHEET)
  },
  import: {
    panelData: () => ipcRenderer.invoke(IPC_CHANNELS.IMPORT_PANEL_DATA)
  },
  run: {
    getAll: () => ipcRenderer.invoke(IPC_CHANNELS.RUN_GET_ALL),
    getById: (id: string) => ipcRenderer.invoke(IPC_CHANNELS.RUN_GET_BY_ID, id),
    create: (data: unknown) => ipcRenderer.invoke(IPC_CHANNELS.RUN_CREATE, data),
    update: (id: string, data: unknown) =>
      ipcRenderer.invoke(IPC_CHANNELS.RUN_UPDATE, id, data),
    delete: (id: string) => ipcRenderer.invoke(IPC_CHANNELS.RUN_DELETE, id)
  },
  operator: {
    getAll: (opts?: { includeInactive?: boolean }) =>
      ipcRenderer.invoke(IPC_CHANNELS.OPERATOR_GET_ALL, opts),
    create: (data: unknown) => ipcRenderer.invoke(IPC_CHANNELS.OPERATOR_CREATE, data),
    update: (id: string, data: unknown) =>
      ipcRenderer.invoke(IPC_CHANNELS.OPERATOR_UPDATE, id, data),
    delete: (id: string) => ipcRenderer.invoke(IPC_CHANNELS.OPERATOR_DELETE, id)
  }
})
