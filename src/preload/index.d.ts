import type { Platform, PlatformCreate, PlatformUpdate } from '../shared/types/platform'
import type { Species } from '../shared/types/species'
import type { PremixPanel, PremixPanelUpdate, PanelWithAnalytes } from '../shared/types/panel'
import type { Analyte, AnalyteUpdate } from '../shared/types/analyte'
import type { ImportResult } from '../main/import/importer'
import type { RunRecord, RunCreate, RunUpdate } from '../shared/types/run'
import type { Operator, OperatorCreate, OperatorUpdate } from '../shared/types/operator'

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
    update: (data: AnalyteUpdate) => Promise<Analyte | null>
    delete: (id: string) => Promise<void>
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
  run: {
    getAll: () => Promise<RunRecord[]>
    getById: (id: string) => Promise<RunRecord | null>
    create: (data: RunCreate) => Promise<RunRecord>
    update: (id: string, data: RunUpdate) => Promise<RunRecord | null>
    delete: (id: string) => Promise<void>
  }
  operator: {
    getAll: (opts?: { includeInactive?: boolean }) => Promise<Operator[]>
    create: (data: OperatorCreate) => Promise<Operator>
    update: (id: string, data: OperatorUpdate) => Promise<Operator | null>
    delete: (id: string) => Promise<Operator | null>
  }
}

declare global {
  interface Window {
    electronAPI: ElectronAPI
  }
}

export {}
