import { create } from 'zustand'
import type { Platform } from '../../../shared/types/platform'

interface PlatformState {
  // State
  platforms: Platform[]
  selectedPlatformId: string | null
  isLoading: boolean
  error: string | null

  // Actions
  loadPlatforms: () => Promise<void>
  selectPlatform: (id: string) => void
  clearSelection: () => void

  // Computed (via getters in component or selector)
  getSelectedPlatform: () => Platform | null
}

export const usePlatformStore = create<PlatformState>((set, get) => ({
  // Initial state
  platforms: [],
  selectedPlatformId: null,
  isLoading: false,
  error: null,

  // Load all platforms from database via IPC
  loadPlatforms: async () => {
    set({ isLoading: true, error: null })
    try {
      const platforms = await window.electronAPI.platform.getAll()
      set({ platforms, isLoading: false })
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to load platforms'
      set({ error: message, isLoading: false })
      console.error('Failed to load platforms:', err)
    }
  },

  // Select a platform by ID
  selectPlatform: (id: string) => {
    const { platforms } = get()
    const platform = platforms.find((p) => p.id === id)
    if (platform) {
      set({ selectedPlatformId: id })
    }
  },

  // Clear current selection
  clearSelection: () => {
    set({ selectedPlatformId: null })
  },

  // Get the currently selected platform object
  getSelectedPlatform: () => {
    const { platforms, selectedPlatformId } = get()
    if (!selectedPlatformId) return null
    return platforms.find((p) => p.id === selectedPlatformId) ?? null
  },
}))
