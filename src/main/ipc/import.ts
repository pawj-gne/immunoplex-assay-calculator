import { ipcMain, dialog, BrowserWindow } from 'electron'
import { IPC_CHANNELS } from '../../shared/constants/channels'
import { importPanelData } from '../import/importer'
import type { ImportResult } from '../import/importer'

export function registerImportHandlers(): void {
  ipcMain.handle(IPC_CHANNELS.IMPORT_PANEL_DATA, async (): Promise<ImportResult> => {
    const win = BrowserWindow.getFocusedWindow()
    const result = await dialog.showOpenDialog(win ?? BrowserWindow.getAllWindows()[0], {
      title: 'Import Panel Data',
      filters: [
        { name: 'Spreadsheets', extensions: ['csv', 'xlsx', 'xls'] }
      ],
      properties: ['openFile']
    })

    if (result.canceled || result.filePaths.length === 0) {
      return {
        success: false,
        canceled: true,
        created: { analytes: 0, panels: 0, links: 0 },
        skipped: { analytes: 0 },
        errors: []
      }
    }

    try {
      return importPanelData(result.filePaths[0])
    } catch (err) {
      return {
        success: false,
        created: { analytes: 0, panels: 0, links: 0 },
        skipped: { analytes: 0 },
        errors: [{ row: 0, issues: [err instanceof Error ? err.message : 'Unknown error'] }]
      }
    }
  })
}
