import { contextBridge, ipcRenderer } from 'electron'

// Expose protected methods that allow the renderer process to use
// ipcRenderer without exposing the entire object
contextBridge.exposeInMainWorld('electronAPI', {
  // Platform operations (to be implemented in Plan 02)
  platform: {
    getAll: (): Promise<unknown[]> => ipcRenderer.invoke('platform:get-all'),
    getById: (id: string): Promise<unknown> => ipcRenderer.invoke('platform:get-by-id', id)
  },
  // Database health check (to be implemented in Plan 02)
  db: {
    health: (): Promise<{ ok: boolean }> => ipcRenderer.invoke('db:health')
  }
})
