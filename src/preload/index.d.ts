// Placeholder types until Plan 02 defines proper Platform type
interface Platform {
  id: string
  name: string
  description: string | null
  stockConcentration: number
  createdAt: string
  updatedAt: string
}

interface CustomElectronAPI {
  platform: {
    getAll: () => Promise<Platform[]>
    getById: (id: string) => Promise<Platform | null>
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
