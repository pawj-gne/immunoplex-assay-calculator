import { registerPlatformHandlers } from './platform'
import { registerDbHandlers } from './db'
import { registerPrintHandlers } from './print'

export function registerIpcHandlers(): void {
  registerPlatformHandlers()
  registerDbHandlers()
  registerPrintHandlers()
  console.log('IPC handlers registered')
}
