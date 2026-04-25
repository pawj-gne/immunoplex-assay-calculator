import { create } from 'zustand'
import type { Species } from '../../../shared/types/species'
import type { PremixPanel, PanelWithAnalytes } from '../../../shared/types/panel'
import type { Analyte } from '../../../shared/types/analyte'
import { MAX_SINGLES_PREMIX } from '../../../shared/constants/calculator'

interface SelectionState {
  // Species state
  speciesList: Species[]
  selectedSpeciesId: string | null
  speciesLoading: boolean
  speciesError: string | null

  // Panel state
  panels: PremixPanel[]
  selectedPanelId: string | null
  selectedPanel: PanelWithAnalytes | null
  panelLoading: boolean
  panelError: string | null

  // Analyte state
  availableAnalytes: Analyte[]
  selectedSingleIds: string[]
  analytesLoading: boolean
  analytesError: string | null

  // Panel-analyte mapping (panelId -> analyteId[])
  panelAnalyteMap: Record<string, string[]>

  // Actions
  loadSpecies: (platformId: string) => Promise<void>
  selectSpecies: (speciesId: string) => void
  clearSpecies: () => void

  loadPanelsAndAnalytes: (platformId: string, speciesId: string) => Promise<void>
  selectPanel: (panelId: string | null) => Promise<void>

  toggleSingleAnalyte: (analyteId: string) => void
  clearSingles: () => void

  // Reset on platform change
  resetAllSelections: () => void

  // Computed
  getSelectedSpecies: () => Species | null
  getPanelAnalytes: () => Analyte[]
  getSelectedSingles: () => Analyte[]
  getAllSelectedAnalytes: () => Analyte[]
  getRequestType: () => 'premix' | 'premix_singles' | 'custom'
  canAddMoreSingles: () => boolean
  getRemainingSinglesCount: () => number
  getAvailableSingles: () => Analyte[]
  getPanelAnalyteMap: () => Record<string, Analyte[]>
  getUnassignedAnalytes: () => Analyte[]
}

const initialState = {
  speciesList: [] as Species[],
  selectedSpeciesId: null as string | null,
  speciesLoading: false,
  speciesError: null as string | null,

  panels: [] as PremixPanel[],
  selectedPanelId: null as string | null,
  selectedPanel: null as PanelWithAnalytes | null,
  panelLoading: false,
  panelError: null as string | null,

  availableAnalytes: [] as Analyte[],
  selectedSingleIds: [] as string[],
  analytesLoading: false,
  analytesError: null as string | null,

  panelAnalyteMap: {} as Record<string, string[]>
}

export const useSelectionStore = create<SelectionState>((set, get) => ({
  ...initialState,

  loadSpecies: async (platformId: string) => {
    set({ speciesLoading: true, speciesError: null })
    try {
      const speciesList = await window.electronAPI.species.getByPlatformId(platformId)
      set({ speciesList, speciesLoading: false })
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to load species'
      set({ speciesError: message, speciesLoading: false })
      console.error('Failed to load species:', err)
    }
  },

  selectSpecies: (speciesId: string) => {
    const { speciesList } = get()
    const species = speciesList.find((s) => s.id === speciesId)
    if (species) {
      // Clear panel, singles, and downstream data on species change
      set({
        selectedSpeciesId: speciesId,
        selectedPanelId: null,
        selectedPanel: null,
        panels: [],
        availableAnalytes: [],
        selectedSingleIds: [],
        panelAnalyteMap: {}
      })
    }
  },

  clearSpecies: () => {
    set({
      selectedSpeciesId: null,
      selectedPanelId: null,
      selectedPanel: null,
      panels: [],
      availableAnalytes: [],
      selectedSingleIds: [],
      panelAnalyteMap: {}
    })
  },

  loadPanelsAndAnalytes: async (platformId: string, speciesId: string) => {
    set({ panelLoading: true, analytesLoading: true, panelError: null, analytesError: null })

    try {
      const [allPanels, analytes] = await Promise.all([
        window.electronAPI.panel.getByPlatformAndSpecies(platformId, speciesId),
        window.electronAPI.analyte.getByPlatformAndSpecies(platformId, speciesId)
      ])

      // Show only selectable panels: sub-panels (have a parent) OR standalone
      // panels with no children. Master panels that own sub-panels are hidden
      // from the calculator selection UI — users pick sub-panels instead.
      const masterIdsWithChildren = new Set(
        allPanels
          .filter((p) => p.parentPanelId !== null)
          .map((p) => p.parentPanelId as string)
      )
      const panels = allPanels.filter(
        (p) => p.parentPanelId !== null || !masterIdsWithChildren.has(p.id)
      )

      // Build panel-analyte mapping by fetching each panel's analytes
      const panelDetails = await Promise.all(
        panels.map((p) => window.electronAPI.panel.getWithAnalytes(p.id))
      )
      const panelAnalyteMap: Record<string, string[]> = {}
      for (const detail of panelDetails) {
        if (detail) {
          panelAnalyteMap[detail.id] = detail.analytes.map((a) => a.id)
        }
      }

      set({
        panels,
        availableAnalytes: analytes,
        panelAnalyteMap,
        panelLoading: false,
        analytesLoading: false
      })
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to load panels/analytes'
      set({
        panelError: message,
        analytesError: message,
        panelLoading: false,
        analytesLoading: false
      })
      console.error('Failed to load panels/analytes:', err)
    }
  },

  selectPanel: async (panelId: string | null) => {
    // Per D-4.1-04: switching between premix selections (including to "No Premix")
    // must clear stale singles so analytes scoped to the prior premix do not
    // survive the switch. Clear optimistically; re-applied even on fetch error.
    if (panelId === null) {
      set({
        selectedPanelId: null,
        selectedPanel: null,
        selectedSingleIds: []
      })
      return
    }

    set({
      panelLoading: true,
      panelError: null,
      selectedSingleIds: []
    })

    try {
      const panelWithAnalytes = await window.electronAPI.panel.getWithAnalytes(panelId)
      set({
        selectedPanelId: panelId,
        selectedPanel: panelWithAnalytes,
        panelLoading: false
      })
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to load panel details'
      set({ panelError: message, panelLoading: false })
      console.error('Failed to load panel details:', err)
    }
  },

  toggleSingleAnalyte: (analyteId: string) => {
    const { selectedSingleIds, selectedPanelId, selectedPanel, availableAnalytes } = get()

    // Don't allow selecting if it's already in panel
    if (selectedPanel) {
      const panelAnalyteIds = selectedPanel.analytes.map((a) => a.id)
      if (panelAnalyteIds.includes(analyteId)) {
        return // Already in panel, don't add to singles
      }
    }

    // Check if already selected
    const isSelected = selectedSingleIds.includes(analyteId)

    if (isSelected) {
      // Remove from selection
      set({ selectedSingleIds: selectedSingleIds.filter((id) => id !== analyteId) })
    } else {
      // Check if we can add more
      const maxSingles = selectedPanelId ? MAX_SINGLES_PREMIX : Infinity
      if (selectedSingleIds.length >= maxSingles) {
        return // At limit
      }

      // Verify analyte exists
      const analyte = availableAnalytes.find((a) => a.id === analyteId)
      if (analyte) {
        set({ selectedSingleIds: [...selectedSingleIds, analyteId] })
      }
    }
  },

  clearSingles: () => {
    set({ selectedSingleIds: [] })
  },

  resetAllSelections: () => {
    set({
      ...initialState,
      // Keep species list and panels if they're still valid
      speciesList: get().speciesList
    })
  },

  getSelectedSpecies: () => {
    const { speciesList, selectedSpeciesId } = get()
    if (!selectedSpeciesId) return null
    return speciesList.find((s) => s.id === selectedSpeciesId) ?? null
  },

  getPanelAnalytes: () => {
    const { selectedPanel } = get()
    return selectedPanel?.analytes ?? []
  },

  getSelectedSingles: () => {
    const { availableAnalytes, selectedSingleIds } = get()
    return availableAnalytes.filter((a) => selectedSingleIds.includes(a.id))
  },

  getAllSelectedAnalytes: () => {
    const panelAnalytes = get().getPanelAnalytes()
    const singles = get().getSelectedSingles()
    return [...panelAnalytes, ...singles]
  },

  getRequestType: () => {
    const { selectedPanelId, selectedSingleIds } = get()

    if (selectedPanelId && selectedSingleIds.length > 0) {
      return 'premix_singles'
    }
    if (selectedPanelId) {
      return 'premix'
    }
    return 'custom'
  },

  canAddMoreSingles: () => {
    const { selectedPanelId, selectedSingleIds } = get()
    const maxSingles = selectedPanelId ? MAX_SINGLES_PREMIX : Infinity
    return selectedSingleIds.length < maxSingles
  },

  getRemainingSinglesCount: () => {
    const { selectedPanelId, selectedSingleIds } = get()
    if (!selectedPanelId) return Infinity
    return Math.max(0, MAX_SINGLES_PREMIX - selectedSingleIds.length)
  },

  getAvailableSingles: () => {
    const { availableAnalytes, selectedPanel } = get()

    // If a panel is selected, filter out analytes that are in the panel
    if (selectedPanel) {
      const panelAnalyteIds = selectedPanel.analytes.map((a) => a.id)
      return availableAnalytes.filter((a) => !panelAnalyteIds.includes(a.id))
    }

    // If no panel, all analytes are available as singles
    return availableAnalytes
  },

  getPanelAnalyteMap: () => {
    const { panelAnalyteMap, availableAnalytes } = get()
    const result: Record<string, Analyte[]> = {}
    for (const [panelId, analyteIds] of Object.entries(panelAnalyteMap)) {
      result[panelId] = analyteIds
        .map((id) => availableAnalytes.find((a) => a.id === id))
        .filter((a): a is Analyte => a !== undefined)
    }
    return result
  },

  getUnassignedAnalytes: () => {
    const { panelAnalyteMap, availableAnalytes } = get()
    const allPanelAnalyteIds = new Set(Object.values(panelAnalyteMap).flat())
    return availableAnalytes.filter((a) => !allPanelAnalyteIds.has(a.id))
  }
}))
