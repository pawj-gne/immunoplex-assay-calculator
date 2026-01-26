import { useCalculatorStore } from '../../../stores/calculatorStore'
import { usePlatformStore } from '../../../stores/platformStore'
import { volumeToDisplay } from '../../../lib/decimal'

/**
 * Hook to access calculator state with computed values
 */
export function useCalculator() {
  const {
    sampleCount,
    replicateMode,
    plateCount,
    requestType,
    volumePerWell,
    deadVolume,
    singles,
    validationError,
    setSampleCount,
    setReplicateMode,
    setPlateCount,
    setRequestType,
    addSingle,
    removeSingle,
    clearSingles,
    reset,
    getOutputs,
    getSinglesWithVolumes,
    canAddMoreSingles,
    getRemainingSinglesCount
  } = useCalculatorStore()

  const { getSelectedPlatform } = usePlatformStore()
  const selectedPlatform = getSelectedPlatform()

  // Get calculated outputs
  const outputs = getOutputs()
  const singlesWithVolumes = getSinglesWithVolumes()

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

  // Format singles with volumes for display
  const formattedSingles = singlesWithVolumes?.map((s) => ({
    ...s,
    additionVolumeUL: volumeToDisplay(s.additionVolume, 'uL', 1)
  }))

  return {
    // Inputs
    sampleCount,
    replicateMode,
    plateCount,
    requestType,
    volumePerWell,
    deadVolume,
    singles,

    // Platform
    selectedPlatform,
    stockConcentration: selectedPlatform?.stockConcentration ?? null,

    // Validation
    validationError,
    isValid: !validationError && sampleCount > 0,

    // Outputs
    outputs: formattedOutputs,
    singlesWithVolumes: formattedSingles,

    // Singles helpers
    canAddMoreSingles: canAddMoreSingles(),
    remainingSingles: getRemainingSinglesCount(),

    // Actions
    setSampleCount,
    setReplicateMode,
    setPlateCount,
    setRequestType,
    addSingle,
    removeSingle,
    clearSingles,
    reset
  }
}
