import { useCalculatorStore } from '../../../stores/calculatorStore'
import { usePlatformStore } from '../../../stores/platformStore'
import { useSelectionStore } from '../../../stores/selectionStore'
import { usePlateStore } from '../../../stores/plateStore'
import { volumeToDisplay } from '../../../lib/decimal'
import { calculateItemizedVolumes } from '../../../lib/calculator'

/**
 * Hook to access calculator state with computed values
 * Integrates selection store for analyte-based calculations
 * Reads plateCount from plateStore (auto-calculated, not manual input)
 */
export function useCalculator() {
  const {
    sampleCount,
    replicateMode,
    volumePerWell,
    deadVolume,
    validationError,
    setSampleCount,
    setReplicateMode,
    reset,
    getOutputs
  } = useCalculatorStore()

  const { getSelectedPlatform } = usePlatformStore()
  const selectedPlatform = getSelectedPlatform()

  // Read plateCount from plateStore (auto-calculated)
  const plateCount = usePlateStore().getPlateCount()

  const {
    selectedPanel,
    getSelectedSingles,
    getRequestType,
    canAddMoreSingles,
    getRemainingSinglesCount
  } = useSelectionStore()

  // Get calculated outputs
  const outputs = getOutputs()
  const selectedSingles = getSelectedSingles()
  const requestType = getRequestType()

  // Calculate itemized volumes based on selection
  const itemizedVolumes =
    outputs && outputs.finalVolume
      ? calculateItemizedVolumes(outputs.finalVolume, selectedPanel, selectedSingles)
      : null

  // Format volumes for display
  const formattedOutputs = outputs
    ? {
        totalWells: outputs.totalWells,
        unknownWells: outputs.unknownWells,
        standardWells: outputs.standardWells,
        rawVolumeUL: volumeToDisplay(outputs.rawVolume, 'uL', 0),
        rawVolumeML: volumeToDisplay(outputs.rawVolume, 'mL', 2),
        finalVolumeML: outputs.finalVolumeML.toString()
      }
    : null

  return {
    // Inputs
    sampleCount,
    replicateMode,
    plateCount,
    volumePerWell,
    deadVolume,

    // Platform
    selectedPlatform,
    stockConcentration: selectedPlatform?.stockConcentration ?? null,

    // Selection-driven values
    requestType,
    selectedPanel,
    selectedSingles,

    // Validation
    validationError,
    isValid: !validationError && sampleCount > 0,

    // Outputs
    outputs: formattedOutputs,
    rawOutputs: outputs,
    itemizedVolumes,

    // Singles helpers (from selection store now)
    canAddMoreSingles: canAddMoreSingles(),
    remainingSingles: getRemainingSinglesCount(),

    // Actions
    setSampleCount,
    setReplicateMode,
    reset
  }
}
