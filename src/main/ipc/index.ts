import { registerPlatformHandlers } from './platform'
import { registerSpeciesHandlers } from './species'
import { registerPanelHandlers } from './panel'
import { registerAnalyteHandlers } from './analyte'
import { registerDbHandlers } from './db'
import { registerPrintHandlers } from './print'
import { registerImportHandlers } from './import'

export function registerIpcHandlers(): void {
  registerPlatformHandlers()
  registerSpeciesHandlers()
  registerPanelHandlers()
  registerAnalyteHandlers()
  registerDbHandlers()
  registerPrintHandlers()
  registerImportHandlers()
  console.log('IPC handlers registered')
}
