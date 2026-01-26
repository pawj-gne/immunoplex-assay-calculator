import type { Platform, PlatformCreate, PlatformUpdate } from '../shared/types/platform'

interface CustomElectronAPI {
  platform: {
    getAll: () => Promise<Platform[]>
    getById: (id: string) => Promise<Platform | null>
    create: (data: PlatformCreate) => Promise<Platform>
    update: (data: PlatformUpdate) => Promise<Platform | null>
  }
  db: {
    health: () => Promise<{ ok: boolean }>
  }
}

declare global {
  interface Window {
    electronAPI: CustomElectronAPI
  }
}

export {}
