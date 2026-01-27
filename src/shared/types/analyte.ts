export interface Analyte {
  id: string
  name: string
  beadRegion: number
  beadStockConc: number
  antibodyStockConc: number
  platformId: string
  speciesId: string
  createdAt: string
  updatedAt: string
}

export interface AnalyteCreate {
  name: string
  beadRegion: number
  beadStockConc: number
  antibodyStockConc: number
  platformId: string
  speciesId: string
}

export interface AnalyteUpdate {
  id: string
  name?: string
  beadRegion?: number
  beadStockConc?: number
  antibodyStockConc?: number
}
