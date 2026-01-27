import { BrowserWindow, ipcMain } from 'electron'
import { IPC_CHANNELS } from '../../shared/constants/channels'

/**
 * Register IPC handlers for print functionality.
 * Handles print:prep-sheet by invoking Electron's native print dialog.
 */
export function registerPrintHandlers(): void {
  ipcMain.handle(IPC_CHANNELS.PRINT_PREP_SHEET, async (event) => {
    const win = BrowserWindow.fromWebContents(event.sender)
    if (!win) {
      return { success: false, error: 'No window found' }
    }

    return new Promise((resolve) => {
      win.webContents.print(
        {
          silent: false,          // Show print dialog
          printBackground: true,  // Include background colors
          margins: { marginType: 'default' }
        },
        (success, errorType) => {
          resolve({ success, error: errorType || null })
        }
      )
    })
  })
}
