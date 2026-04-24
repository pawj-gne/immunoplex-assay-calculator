export interface Analyte {
  id: string
  name: string
  beadRegion: number
  premixConc: number
  singleConc: number
  platformId: string
  speciesId: string
  masterPanelId: string | null
  createdAt: string
  updatedAt: string
}

export interface AnalyteCreate {
  name: string
  beadRegion: number
  premixConc: number
  singleConc: number
  platformId: string
  speciesId: string
  masterPanelId?: string | null
}

export interface AnalyteUpdate {
  id: string
  name?: string
  beadRegion?: number
  premixConc?: number
  singleConc?: number
}

// Phase 5 (D-17): input shape for analyteRepository.upsertByNameInMaster
export interface AnalyteUpsertInMasterInput {
  name: string
  platformId: string
  speciesId: string
  masterPanelId: string
  beadRegion: number
  concentration: number
}
