import { useMemo } from 'react'
import type { RunCreate, SampleType } from '../../../../../shared/types/run'
import { DEAD_VOLUME_PER_SETUP_UL } from '../../../../../shared/constants/calculator'
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
  build: (m: MetadataFields) => Promise<RunCreate | { error: string }>
}

/**
 * Phase 15: sync preconditions extracted out of buildRunSnapshot so the
 * useRunSnapshot hook can drive `canSave` / `reason` synchronously without
 * paying for an IPC call on every keystroke. Returns null when ALL gates
 * pass (i.e. Save is enabled); returns { error } at the FIRST failing gate.
 *
 * Identical gate set + ordering as the pre-Phase-15 buildRunSnapshot.
 */
function validateSnapshotPreconditions(
  metadata: MetadataFields,
  platform: ReturnType<typeof usePlatformStore.getState>,
  selection: ReturnType<typeof useSelectionStore.getState>,
  calculator: ReturnType<typeof useCalculatorStore.getState>
): { error: string } | null {
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
  return null
}

/**
 * Phase 15: assemble a RunCreate payload by reading .getState() from the 4
 * upstream stores (platform / selection / calculator / plate) plus the
 * provided form metadata, then fetching master-panel data via IPC for the
 * audit-trail snapshot fields. Async because of the IPC fetch — the sync
 * gating logic was extracted into validateSnapshotPreconditions above so
 * useRunSnapshot.useMemo can drive `canSave` without paying for IPC on
 * every keystroke.
 *
 * Returns { error } instead of throwing so callers can surface gates + IPC
 * failures uniformly.
 *
 * plex is auto-derived as getAllSelectedAnalytes().length so panel analytes
 * are counted alongside singles. singleAnalyteIds only holds singles (D-19:
 * the join table stores singles; panel members stay implicit via panelId).
 */
export async function buildRunSnapshot(
  metadata: MetadataFields
): Promise<RunCreate | { error: string }> {
  const platform = usePlatformStore.getState()
  const selection = useSelectionStore.getState()
  const calculator = useCalculatorStore.getState()
  const plate = usePlateStore.getState()

  // Sync gates first — fail fast before any IPC.
  const gateError = validateSnapshotPreconditions(metadata, platform, selection, calculator)
  if (gateError) return gateError

  // Type narrowing: the gate above guaranteed both ids are non-null, but TS
  // cannot see through the extracted helper. Re-derive narrowed locals so the
  // returned RunCreate satisfies its `platformId: string` / `speciesId: string`
  // shape without runtime cost (this branch is unreachable post-gate).
  if (!platform.selectedPlatformId) return { error: 'No platform selected' }
  if (!selection.selectedSpeciesId) return { error: 'No species selected' }
  const selectedPlatformId = platform.selectedPlatformId
  const selectedSpeciesId = selection.selectedSpeciesId

  const allAnalytes = selection.getAllSelectedAnalytes()
  // Panel members are NOT counted here — the join table stores only singles per D-19.
  const singleAnalyteIds = selection.selectedSingleIds

  // Phase 15 SMK3-15/16: snapshot-at-save fetch of master-panel + reagents.
  // Skipped when no premix selected (custom assay) — leaves all 6 master-panel
  // fields null and the audit trail renders `—` (D-15-12). Premix concentration
  // comes from selectionStore.selectedPanel.subPanelConc directly (no IPC needed
  // — already in renderer state post-selectPanel; verified in RESEARCH §Q2).
  const premixConcentration = selection.selectedPanel?.subPanelConc ?? null

  let sapeName: string | null = null
  let sapeConcentration: number | null = null
  let beadsDiluent: string | null = null
  let antibodiesDiluent: string | null = null
  let beadsVolumePerWell: number | null = null
  let antibodiesVolumePerWell: number | null = null

  // Phase 15.1 WR-02 (D-15.1-01/02): three-branch gate for the audit-trail
  // snapshot. auditTrailCaptured = true means "write the smoke3 marker + 10
  // audit fields"; false means "save as legacy custom-assay (no marker,
  // 10 fields omitted via conditional spread)".
  //
  //   masterPanelId === null            → true  (custom assay, no IPC, 6 fields legit null)
  //   masterPanelId set, result !== null → true  (happy path)
  //   masterPanelId set, result === null → false (IPC succeeded but row missing)
  //   masterPanelId set, IPC threw       → false (IPC failure)
  //
  // The custom-assay path (existing test at useRunSnapshot.test.ts:197-221)
  // continues to write 'smoke3' because auditTrailCaptured stays true when
  // the IPC was never attempted.
  let auditTrailCaptured = true
  const masterPanelId = selection.selectedPanel?.masterPanelId ?? null
  if (masterPanelId) {
    try {
      const result = await window.electronAPI.masterPanel.getWithReagents(masterPanelId)
      if (result) {
        sapeName = result.masterPanel.sapeName
        const beads = result.reagents.find((r) => r.reagentKind === 'beads')
        const ab = result.reagents.find((r) => r.reagentKind === 'antibodies')
        const sape = result.reagents.find((r) => r.reagentKind === 'sape')
        beadsDiluent = beads?.diluent ?? null
        antibodiesDiluent = ab?.diluent ?? null
        beadsVolumePerWell = beads?.volumePerWell ?? null
        antibodiesVolumePerWell = ab?.volumePerWell ?? null
        sapeConcentration = sape?.concentration ?? null
      } else {
        auditTrailCaptured = false
        console.warn(
          `[buildRunSnapshot] Master panel ${masterPanelId} returned null from getWithReagents — saving without 'smoke3' marker (run will render as legacy).`
        )
      }
    } catch (e) {
      auditTrailCaptured = false
      console.warn(
        `[buildRunSnapshot] IPC failure fetching master panel ${masterPanelId} — saving without 'smoke3' marker: ${(e as Error).message}`
      )
    }
  }

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
    platformId: selectedPlatformId,
    speciesId: selectedSpeciesId,
    panelId: selection.selectedPanelId,
    volumePerWell: calculator.volumePerWell,
    // SMK3-05: deadVolume is derived from numberOfSetups (computed at snapshot
    // time so the persisted µL value matches what the calculator produced).
    // numberOfSetups itself is also persisted for snapshot fidelity (SMK3-16
    // enabler — allows a Smoke 3 run to round-trip its dead volume on reload).
    // Use the shared constant so a future tuning of dead-volume-per-setup
    // propagates to the snapshot in lock-step with the rest of the codebase
    // (WR-03 — eliminates duplicated `2000` magic number).
    deadVolume: calculator.numberOfSetups * DEAD_VOLUME_PER_SETUP_UL,
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
    singleAnalyteIds,
    // Phase 15 SMK3-12/15/16/17 audit-trail snapshot fields. 6 master-panel-derived
    // fields populated from the IPC result above (all null on custom-assay path);
    // premixConcentration from selectionStore.selectedPanel.subPanelConc; 2 override
    // booleans from calculatorStore.oldBeadsOverride / oldAntibodiesOverride lifted
    // by Plan 15-03 Task 1; calculationRulesVersion is the marker that drives the
    // historical-run banner ('smoke3' for Phase-15-and-later saves).
    //
    // Phase 15.1 WR-02: 10 audit-trail snapshot fields written only when capture
    // succeeded. Conditional spread → omitted keys → NULL in SQLite via the
    // repository's conditional-write idiom (run.ts:99-101, 198-200). A run
    // without these fields renders as legacy (em-dash + HistoricalRunBanner)
    // per SMK3-16, which is the desired degrade-to-legacy semantic.
    ...(auditTrailCaptured && {
      sapeName,
      sapeConcentration,
      beadsDiluent,
      antibodiesDiluent,
      beadsVolumePerWell,
      antibodiesVolumePerWell,
      premixConcentration,
      oldBeadsOverride: calculator.oldBeadsOverride,
      oldAntibodiesOverride: calculator.oldAntibodiesOverride,
      calculationRulesVersion: 'smoke3'
    })
  }
}

/**
 * React hook that subscribes to the stores via selectors so the Save button
 * re-renders on any upstream change, and returns { canSave, reason, build }.
 *
 * Phase 15: the hook stays SYNC by calling validateSnapshotPreconditions on
 * every dependency change (not the async buildRunSnapshot). This avoids
 * paying for an IPC call on every keystroke; the IPC fetch happens only
 * when the Save button is clicked and `build(metadata)` is awaited.
 *
 * The exposed `build` function is the async `buildRunSnapshot` directly —
 * callers `await` it on Save.
 */
export function useRunSnapshot(metadata: MetadataFields): SnapshotResult {
  // Selectors — subscribe to the state slices that gate canSave so React
  // re-renders this hook's consumer on any relevant upstream change. The
  // returned values feed into a useMemo dependency list so the gate result
  // re-evaluates exactly when any subscribed slice changes.
  const platformId = usePlatformStore((s) => s.selectedPlatformId)
  const speciesId = useSelectionStore((s) => s.selectedSpeciesId)
  const sampleCount = useCalculatorStore((s) => s.sampleCount)
  const validationError = useCalculatorStore((s) => s.validationError)
  const selectedCount = useSelectionStore((s) => s.getAllSelectedAnalytes().length)

  const gateResult = useMemo(
    () => {
      const platform = usePlatformStore.getState()
      const selection = useSelectionStore.getState()
      const calculator = useCalculatorStore.getState()
      return validateSnapshotPreconditions(metadata, platform, selection, calculator)
    },
    // metadata is captured inside validateSnapshotPreconditions; these slice
    // values are listed here to force re-evaluation when any upstream change
    // occurs.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [metadata, platformId, speciesId, sampleCount, validationError, selectedCount]
  )

  const canSave = gateResult === null
  const reason = canSave ? null : gateResult.error
  return {
    canSave,
    reason,
    build: buildRunSnapshot
  }
}
