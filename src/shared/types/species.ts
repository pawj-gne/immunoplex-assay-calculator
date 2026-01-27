export interface Species {
  id: string
  name: string
  platformId: string
  createdAt: string
  updatedAt: string
}

export interface SpeciesCreate {
  name: string
  platformId: string
}

export interface SpeciesUpdate {
  id: string
  name?: string
  platformId?: string
}
