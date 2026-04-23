import type { RunCreate, SampleType } from '../../../../../shared/types/run'
import { usePlatformStore } from '../../../stores/platformStore'
import { useSelectionStore } from '../../../stores/selectionStore'
import { useCalculatorStore } from '../../../stores/calculatorStore'
import { usePlateStore } from '../../../stores/plateStore'

/**
 * The metadata fields captured by RunMetadataForm (Plan 04-02 / CONTEXT.md
 * §"Required Metadata Fields"). Mirrors the 11 form controls top-to-bottom.
 * requestNumber is null when requestOverrideAdHoc is true.
 */
export interface MetadataFields {
  requestNumber: number | null
  requestOverrideAdHoc: boolean
  userName: string
  operatorId: string
  runDate: string
  sampleType: SampleType | ''
  dilutionFactor: number
  hamilton: number
  runPlatePosition: number
  standardPosition: number
  troughPosition: number
  comments: string
}

export interface SnapshotResult {
  canSave: boolean
  reason: string | null
  build: (m: MetadataFields) => RunCreate | { error: string }
}

/**
 * Assemble a RunCreate payload by reading .getState() from the 4 upstream
 * stores (platform / selection / calculator / plate) plus the provided
 * form metadata. Returns { error } instead of throwing so callers can
 * surface the first-failing gate to the user.
 *
 * plex is auto-derived as getAllSelectedAnalytes().length so panel
 * analytes are counted alongside singles. singleAnalyteIds only holds
 * singles (D-19: the join table stores singles; panel members stay
 * implicit via panelId).
 */
export function buildRunSnapshot(metadata: MetadataFields): RunCreate | { error: string } {
  const platform = usePlatformStore.getState()
  const selection = useSelectionStore.getState()
  const calculator = useCalculatorStore.getState()
  const plate = usePlateStore.getState()

  if (!platform.selectedPlatformId) return { error: 'No platform selected' }
  if (!selection.selectedSpeciesId) return { error: 'No species selected' }
  const allAnalytes = selection.getAllSelectedAnalytes()
  if (allAnalytes.length === 0) return { error: 'No analytes selected' }
  if (calculator.sampleCount <= 0) return { error: 'Sample count must be > 0' }
  if (calculator.validationError) return { error: calculator.validationError }

  // Metadata validation — mirrors runCreateSchema client-side for pre-IPC gating.
  if (!metadata.userName.trim()) return { error: 'User name required' }
  if (!metadata.operatorId) return { error: 'Operator required' }
  if (!metadata.runDate) return { error: 'Run date required' }
  if (!metadata.sampleType) return { error: 'Sample type required' }
  if (metadata.dilutionFactor <= 0) return { error: 'Dilution factor must be > 0' }
  if (metadata.hamilton < 1 || metadata.hamilton > 5) return { error: 'Hamilton must be 1-5' }
  if (metadata.runPlatePosition < 1 || metadata.runPlatePosition > 4) {
    return { error: 'Run plate position must be 1-4' }
  }
  if (metadata.standardPosition < 1 || metadata.standardPosition > 2) {
    return { error: 'Standard position must be 1-2' }
  }
  if (metadata.troughPosition < 1 || metadata.troughPosition > 2) {
    return { error: 'Trough position must be 1-2' }
  }
  if (
    !metadata.requestOverrideAdHoc &&
    (metadata.requestNumber === null ||
      metadata.requestNumber < 1 ||
      metadata.requestNumber > 99999)
  ) {
    return { error: 'Request number required (1-99999) unless ad-hoc' }
  }

  // Panel members are NOT counted here — the join table stores only singles per D-19.
  const singleAnalyteIds = selection.selectedSingleIds

  return {
    requestNumber: metadata.requestOverrideAdHoc ? null : metadata.requestNumber,
    requestOverrideAdHoc: metadata.requestOverrideAdHoc,
    userName: metadata.userName.trim(),
    operatorId: metadata.operatorId,
    runDate: metadata.runDate,
    sampleType: metadata.sampleType as SampleType,
    dilutionFactor: metadata.dilutionFactor,
    sampleCount: calculator.sampleCount,
    replicateMode: calculator.replicateMode,
    requestType: calculator.requestType,
    platformId: platform.selectedPlatformId,
    speciesId: selection.selectedSpeciesId,
    panelId: selection.selectedPanelId,
    volumePerWell: calculator.volumePerWell,
    deadVolume: calculator.deadVolume,
    hamilton: metadata.hamilton,
    runPlatePosition: metadata.runPlatePosition,
    standardPosition: metadata.standardPosition,
    troughPosition: metadata.troughPosition,
    comments: metadata.comments.trim() || null,
    // Total selected analytes (panel + singles) per CONTEXT.md 'plex' semantics.
    plex: allAnalytes.length,
    plateCount: plate.getPlateCount(),
    plates: plate.getPlatesSnapshot(),
    singleAnalyteIds
  }
}

/**
 * React hook that subscribes to the stores via selectors so the Save button
 * re-renders on any upstream change, and returns { canSave, reason, build }.
 * The `build` function is identical to `buildRunSnapshot` — exposing it on
 * the result lets the parent call build(metadata) on the Save click without
 * re-importing.
 */
export function useRunSnapshot(metadata: MetadataFields): SnapshotResult {
  // Selectors — subscribe to the state slices that gate canSave so React
  // re-renders this hook's consumer on any relevant upstream change.
  // Return values are intentionally unused below (just the subscription).
  /* eslint-disable @typescript-eslint/no-unused-vars */
  const _platformId = usePlatformStore((s) => s.selectedPlatformId)
  const _speciesId = useSelectionStore((s) => s.selectedSpeciesId)
  const _sampleCount = useCalculatorStore((s) => s.sampleCount)
  const _validationError = useCalculatorStore((s) => s.validationError)
  const _selectedCount = useSelectionStore((s) => s.getAllSelectedAnalytes().length)
  /* eslint-enable @typescript-eslint/no-unused-vars */

  const result = buildRunSnapshot(metadata)
  const canSave = !('error' in result)
  const reason = canSave ? null : (result as { error: string }).error
  return {
    canSave,
    reason,
    build: buildRunSnapshot
  }
}
