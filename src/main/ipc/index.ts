import { registerPlatformHandlers } from './platform'
import { registerDbHandlers } from './db'

export function registerIpcHandlers(): void {
  registerPlatformHandlers()
  registerDbHandlers()
  console.log('IPC handlers registered')
}
