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
  db: {
    health: () => ipcRenderer.invoke(IPC_CHANNELS.DB_HEALTH)
  }
})
