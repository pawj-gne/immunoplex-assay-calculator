import type { Platform, PlatformCreate, PlatformUpdate } from '../shared/types/platform'
import type { Species } from '../shared/types/species'
import type { PremixPanel, PremixPanelUpdate, PanelWithAnalytes } from '../shared/types/panel'
import type { Analyte } from '../shared/types/analyte'
import type { ImportResult } from '../main/import/importer'

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
    update: (data: PremixPanelUpdate) => Promise<PremixPanel | null>
    delete: (id: string) => Promise<void>
    addAnalyte: (panelId: string, analyteId: string) => Promise<void>
    removeAnalyte: (panelId: string, analyteId: string) => Promise<void>
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
  import: {
    panelData: () => Promise<ImportResult>
  }
}

declare global {
  interface Window {
    electronAPI: ElectronAPI
  }
}

export {}
