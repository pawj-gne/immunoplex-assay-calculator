import { useEffect } from 'react'
import { usePlatformStore } from '../../../stores/platformStore'

/**
 * Hook to load and access platform data
 * Automatically loads platforms on first use
 */
export function usePlatforms() {
  const {
    platforms,
    selectedPlatformId,
    isLoading,
    error,
    loadPlatforms,
    selectPlatform,
    clearSelection,
    getSelectedPlatform,
  } = usePlatformStore()

  // Load platforms on mount if not already loaded
  useEffect(() => {
    if (platforms.length === 0 && !isLoading && !error) {
      loadPlatforms()
    }
  }, [platforms.length, isLoading, error, loadPlatforms])

  return {
    platforms,
    selectedPlatform: getSelectedPlatform(),
    selectedPlatformId,
    isLoading,
    error,
    selectPlatform,
    clearSelection,
    reload: loadPlatforms,
  }
}
