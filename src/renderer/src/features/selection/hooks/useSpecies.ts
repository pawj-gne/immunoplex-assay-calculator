import { useEffect } from 'react'
import { useSelectionStore } from '../../../stores/selectionStore'
import { usePlatformStore } from '../../../stores/platformStore'

/**
 * Hook to manage species selection
 * Automatically loads species when platform changes
 */
export function useSpecies() {
  const { selectedPlatformId } = usePlatformStore()

  const {
    speciesList,
    selectedSpeciesId,
    speciesLoading,
    speciesError,
    loadSpecies,
    selectSpecies,
    clearSpecies,
    getSelectedSpecies,
    resetAllSelections
  } = useSelectionStore()

  // Load species when platform changes
  useEffect(() => {
    if (selectedPlatformId) {
      // Reset all downstream selections when platform changes
      resetAllSelections()
      loadSpecies(selectedPlatformId)
    } else {
      clearSpecies()
    }
  }, [selectedPlatformId, loadSpecies, clearSpecies, resetAllSelections])

  return {
    species: speciesList,
    selectedSpecies: getSelectedSpecies(),
    selectedSpeciesId,
    isLoading: speciesLoading,
    error: speciesError,
    selectSpecies,
    clearSpecies,
    reload: () => selectedPlatformId && loadSpecies(selectedPlatformId)
  }
}
