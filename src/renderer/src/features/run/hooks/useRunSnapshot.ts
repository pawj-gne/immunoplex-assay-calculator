import { useMemo } from 'react'
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
    // SMK3-05: deadVolume is derived from numberOfSetups (computed at snapshot
    // time so the persisted µL value matches what the calculator produced).
    // numberOfSetups itself is also persisted for snapshot fidelity (SMK3-16
    // enabler — allows a Smoke 3 run to round-trip its dead volume on reload).
    deadVolume: calculator.numberOfSetups * 2000,
    numberOfSetups: calculator.numberOfSetups,
    // Smoke 3 SMK3-02/03 + SMK3-16: persist raw typed values per D-08 (the
    // operator's author intent is preserved). Floor-rounding (to 0.1 mL)
    // happens at consumption inside calculatorStore.getOutputs(), NOT at the
    // snapshot boundary. Pre-Phase-14 runs that lack these fields load as 0
    // via the `?? 0` default in runStore.loadRun.
    oldBeads: calculator.oldBeads,
    oldAntibodies: calculator.oldAntibodies,
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
  // re-renders this hook's consumer on any relevant upstream change. The
  // returned values feed into a useMemo dependency list so the snapshot
  // re-builds exactly when any subscribed slice changes.
  const platformId = usePlatformStore((s) => s.selectedPlatformId)
  const speciesId = useSelectionStore((s) => s.selectedSpeciesId)
  const sampleCount = useCalculatorStore((s) => s.sampleCount)
  const validationError = useCalculatorStore((s) => s.validationError)
  const selectedCount = useSelectionStore((s) => s.getAllSelectedAnalytes().length)

  const result = useMemo(
    () => buildRunSnapshot(metadata),
    // metadata is captured inside buildRunSnapshot; these slice values are
    // listed here to force re-evaluation when any upstream change occurs.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [metadata, platformId, speciesId, sampleCount, validationError, selectedCount]
  )

  const canSave = !('error' in result)
  const reason = canSave ? null : (result as { error: string }).error
  return {
    canSave,
    reason,
    build: buildRunSnapshot
  }
}
