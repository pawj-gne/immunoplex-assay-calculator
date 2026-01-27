import type { Platform, PlatformCreate, PlatformUpdate } from '../shared/types/platform'
import type { Species } from '../shared/types/species'
import type { PremixPanel, PanelWithAnalytes } from '../shared/types/panel'
import type { Analyte } from '../shared/types/analyte'

export interface ElectronAPI {
  platform: {
    getAll: () => Promise<Platform[]>
    getById: (id: string) => Promise<Platform | null>
    create: (data: PlatformCreate) => Promise<Platform>
    update: (data: PlatformUpdate) => Promise<Platform | null>
  }
  species: {
    getByPlatformId: (platformId: string) => Promise<Species[]>
  }
  panel: {
    getByPlatformAndSpecies: (platformId: string, speciesId: string) => Promise<PremixPanel[]>
    getWithAnalytes: (panelId: string) => Promise<PanelWithAnalytes | null>
  }
  analyte: {
    getByPlatformAndSpecies: (platformId: string, speciesId: string) => Promise<Analyte[]>
    getByPanelId: (panelId: string) => Promise<Analyte[]>
  }
  db: {
    health: () => Promise<{ ok: boolean }>
  }
  print: {
    prepSheet: () => Promise<{ success: boolean; error: string | null }>
  }
}

declare global {
  interface Window {
    electronAPI: ElectronAPI
  }
}

export {}
