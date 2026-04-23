import { registerPlatformHandlers } from './platform'
import { registerSpeciesHandlers } from './species'
import { registerPanelHandlers } from './panel'
import { registerAnalyteHandlers } from './analyte'
import { registerDbHandlers } from './db'
import { registerPrintHandlers } from './print'
import { registerImportHandlers } from './import'
import { registerRunHandlers } from './run'
import { registerOperatorHandlers } from './operator'

export function registerIpcHandlers(): void {
  registerPlatformHandlers()
  registerSpeciesHandlers()
  registerPanelHandlers()
  registerAnalyteHandlers()
  registerDbHandlers()
  registerPrintHandlers()
  registerImportHandlers()
  registerRunHandlers()
  registerOperatorHandlers()
  console.log('IPC handlers registered')
}
