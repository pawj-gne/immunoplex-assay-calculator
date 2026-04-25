import type { Analyte } from './analyte'

export interface PremixPanel {
  id: string
  name: string
  description: string | null
  platformId: string
  speciesId: string
  masterPanelId: string | null
  parentPanelId: string | null
  subPanelConc: number
  createdAt: string
  updatedAt: string
}

export interface PremixPanelCreate {
  name: string
  description?: string | null
  platformId: string
  speciesId: string
  masterPanelId?: string | null
  parentPanelId?: string | null
  subPanelConc?: number
}

export interface PremixPanelUpdate {
  id: string
  name?: string
  description?: string | null
}

export interface PanelWithAnalytes extends PremixPanel {
  analytes: Analyte[]
}
