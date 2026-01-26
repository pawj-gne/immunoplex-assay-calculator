export interface Platform {
  id: string
  name: string
  description: string | null
  stockConcentration: number
  createdAt: string
  updatedAt: string
}

export interface PlatformCreate {
  name: string
  description?: string | null
  stockConcentration: number
}

export interface PlatformUpdate {
  id: string
  name?: string
  description?: string | null
  stockConcentration?: number
}
