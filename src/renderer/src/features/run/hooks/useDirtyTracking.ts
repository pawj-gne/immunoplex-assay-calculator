import { usePlatformStore } from '../../../stores/platformStore'
import { useSelectionStore } from '../../../stores/selectionStore'
import { useCalculatorStore } from '../../../stores/calculatorStore'
import { usePlateStore } from '../../../stores/plateStore'
import type { MetadataFields } from './useRunSnapshot'

/**
 * Serialize the "current clean state" as a string. Reads .getState() from
 * the 4 upstream stores (platform / selection / calculator / plate) plus
 * the provided form metadata. Used as the reference baseline captured on
 * save/load/reset and compared against on demand. Cheap JSON.stringify —
 * per D-22, not a perf hotspot.
 *
 * Centralized in this helper (not per-store) so runStore owns the dirty
 * contract end-to-end (D-22 §"Centralized in runStore").
 */
export function computeCleanSnapshot(metadata: MetadataFields): string {
  const platform = usePlatformStore.getState()
  const selection = useSelectionStore.getState()
  const calculator = useCalculatorStore.getState()
  const plate = usePlateStore.getState()

  return JSON.stringify({
    platformId: platform.selectedPlatformId,
    speciesId: selection.selectedSpeciesId,
    panelId: selection.selectedPanelId,
    // Sort single analyte IDs so ordering differences don't register as dirty.
    singles: [...selection.selectedSingleIds].sort(),
    sampleCount: calculator.sampleCount,
    replicateMode: calculator.replicateMode,
    requestType: calculator.requestType,
    plates: plate.getPlatesSnapshot(),
    metadata
  })
}

/**
 * Compare the current computed snapshot against the last-saved baseline.
 * Returns false when there is no baseline (lastClean === null) — the
 * "loaded-but-not-yet-baselined" case is handled by runStore.isDirtyNow
 * (which returns currentRunId !== null in that state to err toward the
 * confirm modal).
 */
export function isDirty(lastClean: string | null, currentMetadata: MetadataFields): boolean {
  if (lastClean === null) return false
  return computeCleanSnapshot(currentMetadata) !== lastClean
}
