import { app, shell, BrowserWindow } from 'electron'
import { join } from 'path'
import { initializeDatabase, closeDatabase } from './db/client'
import { initializeLocalDatabase, closeLocalDatabase } from './db/clientLocal'
import { runMigrations } from './db/migrate'
import { seedAll } from './db/seed'
import { registerIpcHandlers } from './ipc'
import { loadConfig } from './config/appConfig'
import { startExpressServer } from './server/expressServer'
import { initTransport, startReconnectPoller } from './transport'

function createWindow(): BrowserWindow {
  const mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    show: false,
    autoHideMenuBar: true,
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false,
      contextIsolation: true,
      nodeIntegration: false
    }
  })

  mainWindow.on('ready-to-show', () => {
    mainWindow.show()
  })

  mainWindow.webContents.setWindowOpenHandler((details) => {
    shell.openExternal(details.url)
    return { action: 'deny' }
  })

  // HMR for renderer based on electron-vite cli.
  // Load the remote URL for development or the local html file for production.
  if (!app.isPackaged && process.env['ELECTRON_RENDERER_URL']) {
    mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }

  return mainWindow
}

app.whenReady().then(() => {
  // Phase 6: branch startup by config.json (D-03 / D-09 / client-mode).
  // loadConfig() must come AFTER app.whenReady() — app.getPath() requires app ready
  // (RESEARCH §Pitfall 2).
  const config = loadConfig()

  if (config === null) {
    // D-03: No config.json — fully functional local-only mode, no prompts.
    initializeDatabase()
    runMigrations()
    seedAll()
    initTransport('local')
  } else if (config.isServer) {
    // D-09: Server machine — central DB + Express HTTP server.
    initializeDatabase()
    runMigrations()
    seedAll()
    // Express must start AFTER migrations — see RESEARCH anti-pattern
    // "Starting Express server before DB is ready".
    startExpressServer(config.serverUrl)
    initTransport('local') // server uses direct repo calls (no HTTP hop, D-09)
  } else {
    // Client mode — local fallback DB only; no central DB on client machines.
    initializeLocalDatabase()
    runMigrations() // applies migration 0005 to immunoplex-local.db (RESEARCH §Pitfall 3)
    initTransport('http', config.serverUrl)
  }

  // Register IPC handlers
  registerIpcHandlers()

  // Set app user model id for windows
  app.setAppUserModelId('com.immunoplex.calculator')

  const mainWindow = createWindow()

  if (config !== null && !config.isServer) {
    // Client mode: start background reconnect poller (Plan 06-03 implements).
    startReconnectPoller(mainWindow)
  }

  app.on('activate', function () {
    // On macOS it's common to re-create a window in the app when the
    // dock icon is clicked and there are no other windows open.
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  closeDatabase()
  closeLocalDatabase() // no-op on server/local-only mode (sqlite is null)
  if (process.platform !== 'darwin') {
    app.quit()
  }
})
