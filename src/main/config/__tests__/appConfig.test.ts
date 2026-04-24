import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import fs from 'fs'
import path from 'path'
import { app } from 'electron'

// Mock electron app BEFORE importing loadConfig — module-scope import binds to
// the mocked `app.getPath` so the path build inside loadConfig is deterministic.
vi.mock('electron', () => ({
  app: {
    getPath: vi.fn()
  }
}))

// Import AFTER the mock is established (top-level await pattern in vitest works
// because tests run in ESM context).
const { loadConfig } = await import('../appConfig')

describe('loadConfig (NET-02)', () => {
  beforeEach(() => {
    // Re-establish the mock return value before each test — afterEach's
    // restoreAllMocks() resets vi.fn() implementations, so the getPath()
    // mock would otherwise return undefined on the second test onward.
    vi.mocked(app.getPath).mockReturnValue('/fake/userData')
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('returns null when config.json does not exist (D-03 local-only mode)', () => {
    vi.spyOn(fs, 'readFileSync').mockImplementation(() => {
      throw new Error('ENOENT: no such file or directory')
    })
    const result = loadConfig()
    expect(result).toBeNull()
  })

  it('returns null when config.json is malformed JSON (D-03 fail-safe)', () => {
    vi.spyOn(fs, 'readFileSync').mockReturnValue('not valid json {')
    const result = loadConfig()
    expect(result).toBeNull()
  })

  it('parses serverUrl and isServer=true correctly (server mode, D-09)', () => {
    const config = { serverUrl: 'http://192.168.1.10:3847', isServer: true }
    vi.spyOn(fs, 'readFileSync').mockReturnValue(JSON.stringify(config))
    const result = loadConfig()
    expect(result).not.toBeNull()
    expect(result?.serverUrl).toBe('http://192.168.1.10:3847')
    expect(result?.isServer).toBe(true)
  })

  it('parses serverUrl and isServer=false correctly (client mode)', () => {
    const config = { serverUrl: 'http://192.168.1.10:3847', isServer: false }
    vi.spyOn(fs, 'readFileSync').mockReturnValue(JSON.stringify(config))
    const result = loadConfig()
    expect(result).not.toBeNull()
    expect(result?.isServer).toBe(false)
    expect(result?.serverUrl).toBe('http://192.168.1.10:3847')
  })

  it('reads from the correct path: userData/config.json (D-05)', () => {
    const readSpy = vi.spyOn(fs, 'readFileSync').mockImplementation(() => {
      throw new Error('ENOENT')
    })
    loadConfig()
    expect(readSpy).toHaveBeenCalledWith(path.join('/fake/userData', 'config.json'), 'utf-8')
  })
})
