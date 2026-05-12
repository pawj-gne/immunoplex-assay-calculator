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
 *
 * Plan 14-06 extension (Smoke 3 SMK3-02/03/04 + D-10):
 *   - Exposes the four new operator-typed inputs (plateCount,
 *     oldBeads, oldAntibodies, numberOfSetups) AND the D-10
 *     capPaused output-suppression flag.
 *   - Exposes the five new setters (setPlateCount, setOldBeads,
 *     setOldAntibodies, setNumberOfSetups, setCapPaused) so
 *     CalculatorForm can drive the 7-input D-01 ordering without
 *     reaching past the hook into the stores directly.
 */
export function useCalculator() {
  const {
    sampleCount,
    replicateMode,
    volumePerWell,
    // SMK3-05: store's deadVolume field replaced by numberOfSetups (Phase 12-03);
    // the live deadVolume is derived inside createCalculatorInputs/getOutputs.
    numberOfSetups,
    oldBeads,
    oldAntibodies,
    capPaused,
    validationError,
    setSampleCount,
    setReplicateMode,
    setNumberOfSetups,
    setOldBeads,
    setOldAntibodies,
    setCapPaused,
    reset,
    getOutputs
  } = useCalculatorStore()

  const { getSelectedPlatform } = usePlatformStore()
  const selectedPlatform = getSelectedPlatform()

  // Read plateCount from plateStore (auto-calculated) and the new
  // D-03 bidirectional setter that CalculatorForm's "Number of Plates"
  // input will commit to.
  const plateCount = usePlateStore().getPlateCount()
  const setPlateCount = usePlateStore((s) => s.setPlateCount)

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
    numberOfSetups,
    oldBeads,
    oldAntibodies,
    // D-10: UI gates outputs on this flag (CalculatorPanel renders the
    // cap-paused placeholder when true).
    capPaused,

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
    setNumberOfSetups,
    setOldBeads,
    setOldAntibodies,
    setPlateCount,
    setCapPaused,
    reset
  }
}
