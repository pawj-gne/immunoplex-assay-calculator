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
      // Phase 13: new ImportResult shape (summaries / ImportSheetError). UI surface
      // adoption deferred to Plan 13-06; this branch is the minimal-update path
      // required to keep tsc --noEmit -p tsconfig.node.json at exit 0.
      return {
        success: false,
        canceled: true,
        summaries: [],
        errors: []
      }
    }

    try {
      return importPanelData(result.filePaths[0])
    } catch (err) {
      return {
        success: false,
        summaries: [],
        errors: [
          {
            sheetName: '',
            issues: [err instanceof Error ? err.message : 'Unknown error']
          }
        ]
      }
    }
  })
}
