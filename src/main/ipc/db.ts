import { ipcMain } from 'electron'
import { IPC_CHANNELS } from '../../shared/constants/channels'
import { getSqlite } from '../db/client'

export function registerDbHandlers(): void {
  ipcMain.handle(IPC_CHANNELS.DB_HEALTH, async () => {
    try {
      const sqlite = getSqlite()
      // Simple query to verify database is working
      const result = sqlite.prepare('SELECT 1 as ok').get() as { ok: number }
      return { ok: result.ok === 1 }
    } catch {
      return { ok: false }
    }
  })
}
