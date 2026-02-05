import { useEffect } from 'react'
import { useSelectionStore } from '../../../stores/selectionStore'
import { usePlatformStore } from '../../../stores/platformStore'

/**
 * Hook to manage panel and analyte selection
 * Automatically loads panels/analytes when species changes
 */
export function useAnalyteSelection() {
  const { selectedPlatformId } = usePlatformStore()

  const {
    selectedSpeciesId,
    panels,
    selectedPanelId,
    selectedPanel,
    availableAnalytes,
    selectedSingleIds,
    panelLoading,
    analytesLoading,
    panelError,
    analytesError,
    loadPanelsAndAnalytes,
    selectPanel,
    toggleSingleAnalyte,
    clearSingles,
    getPanelAnalytes,
    getSelectedSingles,
    getAllSelectedAnalytes,
    getRequestType,
    canAddMoreSingles,
    getRemainingSinglesCount,
    getAvailableSingles,
    getPanelAnalyteMap,
    getUnassignedAnalytes
  } = useSelectionStore()

  // Load panels and analytes when species changes
  useEffect(() => {
    if (selectedPlatformId && selectedSpeciesId) {
      loadPanelsAndAnalytes(selectedPlatformId, selectedSpeciesId)
    }
  }, [selectedPlatformId, selectedSpeciesId, loadPanelsAndAnalytes])

  return {
    // Panel data
    panels,
    selectedPanelId,
    selectedPanel,
    panelAnalytes: getPanelAnalytes(),

    // Analyte data
    availableAnalytes,
    availableSingles: getAvailableSingles(),
    selectedSingleIds,
    selectedSingles: getSelectedSingles(),
    allSelectedAnalytes: getAllSelectedAnalytes(),
    panelAnalyteMap: getPanelAnalyteMap(),
    unassignedAnalytes: getUnassignedAnalytes(),

    // Loading state
    isLoading: panelLoading || analytesLoading,
    panelLoading,
    analytesLoading,
    error: panelError || analytesError,

    // Computed
    requestType: getRequestType(),
    canAddMoreSingles: canAddMoreSingles(),
    remainingSingles: getRemainingSinglesCount(),

    // Actions
    selectPanel,
    toggleSingleAnalyte,
    clearSingles
  }
}
