import fs from 'fs'
import path from 'path'
import { app } from 'electron'

export interface AppConfig {
  serverUrl: string // e.g. "http://192.168.1.10:3847"
  isServer: boolean // true = this machine runs the central DB + Express server
}

/**
 * Reads config.json from the userData directory. Returns null when:
 * - File does not exist → local-only mode (D-03)
 * - File is malformed JSON → local-only mode (D-03 fail-safe)
 *
 * Must be called INSIDE app.whenReady() — app.getPath() throws before ready
 * (RESEARCH §Pitfall 2).
 */
export function loadConfig(): AppConfig | null {
  const configPath = path.join(app.getPath('userData'), 'config.json')
  try {
    const raw = fs.readFileSync(configPath, 'utf-8')
    return JSON.parse(raw) as AppConfig
  } catch {
    return null // missing or malformed → local-only (D-03 safe default)
  }
}
