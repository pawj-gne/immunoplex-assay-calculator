import type { Platform, PlatformCreate, PlatformUpdate } from '../shared/types/platform'
import type { Species } from '../shared/types/species'
import type { PremixPanel, PremixPanelUpdate, PanelWithAnalytes } from '../shared/types/panel'
import type { Analyte, AnalyteUpdate } from '../shared/types/analyte'
import type { RunRecord, RunCreate, RunUpdate } from '../shared/types/run'
import type { Operator, OperatorCreate, OperatorUpdate } from '../shared/types/operator'

/**
 * Phase 13 (Plan 13-06): ImportResult contract duplicated here for the
 * renderer-side surface. The canonical source-of-truth lives in
 * src/main/import/importer.ts, but the preload bridge runs in the renderer
 * (browser) context and cannot reach main-process files. Type drift between
 * main and renderer is caught at compile-time by `tsc --noEmit` over both
 * tsconfig.node.json (main) and tsconfig.web.json (renderer).
 */
export interface PanelSummary {
  sheetName: string
  normalizedName: string
  platform: string
  species: string
  analyteCount: number
  premixCount: number
  sapeName: string | null
  sapeConc: number
  wasUpdate: boolean
}

export interface ImportSheetError {
  sheetName: string // empty string for file-level (D-21) errors
  issues: string[]
}

export interface ImportResult {
  success: boolean
  canceled?: boolean
  summaries: PanelSummary[]
  errors: ImportSheetError[]
}

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
  // Phase 6: connection status push channel — see src/preload/index.ts
  // and src/main/transport/httpTransport.ts (Plan 06-03).
  connection: {
    onStatusChange: (cb: (online: boolean) => void) => void
  }
}

declare global {
  interface Window {
    electronAPI: ElectronAPI
  }
}

export {}
