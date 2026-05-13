import { useMemo, useRef } from 'react'
import type { WellData } from '../../../../../shared/types/plate'
import { ROWS, COLS, STANDARD_COLS } from '../../../../../shared/types/plate'
import { getDuplicatePair } from '../../../../../shared/constants/calculator'
import { useRunStore } from '../../../stores/runStore'
import { usePlateStore } from '../../../stores/plateStore'
import { useCalculatorStore } from '../../../stores/calculatorStore'
import { usePlatformStore } from '../../../stores/platformStore'
import { useSelectionStore } from '../../../stores/selectionStore'
import { PrepSheet } from '../../plate/components/PrepSheet'
import { ReagentChecklist } from '../../plate/components/ReagentChecklist'
import { BeadRegionList } from '../../plate/components/BeadRegionList'
import { PlateGrid } from '../../plate/components/PlateGrid'
import { PrintButton } from '../../plate/components/PrintButton'
import { FinalizedRunHeader } from './FinalizedRunHeader'
import { HistoricalRunBanner } from './HistoricalRunBanner'
import { AuditTrailSection } from './AuditTrailSection'

/**
 * Build an 8x12 WellData grid for a single plate from its stored
 * selectedWells set. Standards occupy columns 1-3, all other cells start
 * as 'empty' — the selectedWells set (passed to PlateGrid alongside this
 * grid) drives the rendered fill state in read-only mode.
 */
function buildWellGrid(): WellData[][] {
  return ROWS.map((row) =>
    COLS.map((col) => ({
      id: `${row}${col}`,
      row,
      col,
      type: STANDARD_COLS.includes(col as (typeof STANDARD_COLS)[number])
        ? ('standard' as const)
        : ('empty' as const)
    }))
  )
}

/**
 * Compute dynamic sample indices from plateStore selections, matching
 * PlatePanel's column-first ordering across plates. Used by PlateGrid
 * to render sample numbers inside filled wells.
 */
function computeSampleIndexMap(
  plates: Record<number, Set<string>>,
  replicateMode: 'singles' | 'duplicates'
): Map<string, number> {
  const indexMap = new Map<string, number>()
  const plateNumbers = Object.keys(plates)
    .map(Number)
    .sort((a, b) => a - b)

  const sortWells = (wells: Set<string>): string[] =>
    [...wells].sort((a, b) => {
      const aCol = parseInt(a.slice(1))
      const bCol = parseInt(b.slice(1))
      if (aCol !== bCol) return aCol - bCol
      return a.charCodeAt(0) - b.charCodeAt(0)
    })

  let sampleIndex = 1
  for (const plateNum of plateNumbers) {
    const wells = plates[plateNum]
    if (!wells || wells.size === 0) continue
    const sorted = sortWells(wells)

    if (replicateMode === 'singles') {
      for (const wId of sorted) {
        indexMap.set(`${plateNum}:${wId}`, sampleIndex)
        sampleIndex++
      }
    } else {
      // Duplicates: each pair shares a sample index
      const seen = new Set<string>()
      for (const wId of sorted) {
        if (seen.has(wId)) continue
        seen.add(wId)
        const row = wId.charCodeAt(0) - 65
        const col = parseInt(wId.slice(1)) - 1
        const pair = getDuplicatePair(row, col)
        indexMap.set(`${plateNum}:${wId}`, sampleIndex)
        if (pair) {
          const pairId = `${String.fromCharCode(65 + pair.row)}${pair.col + 1}`
          seen.add(pairId)
          indexMap.set(`${plateNum}:${pairId}`, sampleIndex)
        }
        sampleIndex++
      }
    }
  }

  return indexMap
}

interface Props {
  /**
   * Called when the operator clicks "Start New Run". App.tsx wires this
   * to setCurrentPage(0) so the wizard returns to step 1.
   */
  onStartNewRun: () => void
}

/**
 * Wizard step 5 — Finalized Run View (D-06).
 *
 * Read-only bench sheet the operator reads from while running the assay.
 * Composition (top-to-bottom):
 *   1. FinalizedRunHeader — metadata summary with "Request XXXXX — N plate(s)"
 *      primary label.
 *   2. Actions row (Print + Start New Run) — hidden on print.
 *   3. PrepSheet — reused from Phase 3 (printable).
 *   4. ReagentChecklist — reused from Phase 3.
 *   5. BeadRegionList — reused from Phase 3.
 *   6. Per-plate layout: for each plate, a "Request XXXXX — Plate N of M"
 *      label followed by a read-only PlateGrid (interactive={false}).
 *
 * Print reuses the existing Phase 3 IPC (window.print() with @media print
 * stylesheet) per D-09. Start New Run (D-10) resets platform / selection /
 * calculator / plate / run stores and calls onStartNewRun() which routes
 * back to step 1. The wizard Back button is intercepted in App.tsx via
 * EditWarningModal when currentRunId !== null (D-12).
 */
export function FinalizedRunView({ onStartNewRun }: Props): JSX.Element {
  const currentRun = useRunStore(
    (s) => s.runs.find((r) => r.id === s.currentRunId) ?? null
  )
  const plates = usePlateStore((s) => s.plates)
  const plateCount = usePlateStore((s) => s.getPlateCount())
  const replicateMode = usePlateStore((s) => s.replicateMode)

  // Ref required by PrepSheet for the react-to-print contract (even though
  // we use window.print() here; PrepSheet's prop is the existing Phase 3
  // surface and we don't modify its API).
  const prepSheetRef = useRef<HTMLDivElement>(null!)

  const sampleIndexMap = useMemo(
    () => computeSampleIndexMap(plates, replicateMode),
    [plates, replicateMode]
  )

  if (!currentRun) {
    return (
      <div className="p-6 text-sm text-[var(--color-muted)]">
        No active run. Save a run first or load one from Past Runs.
      </div>
    )
  }

  // Per-plate label prefix — D-06 / §Specific Ideas.
  const reqDisplay = currentRun.requestOverrideAdHoc
    ? 'Ad-hoc run'
    : `Request ${String(currentRun.requestNumber ?? 0).padStart(5, '0')}`

  // Sort plate numbers ascending for consistent rendering.
  const plateNumbers = Object.keys(plates)
    .map(Number)
    .sort((a, b) => a - b)

  const handleStartNewRun = (): void => {
    // D-10: reset all stores and return to step 1. The existing
    // calculatorStore.reset cascade covers calculatorStore +
    // plateStore + runStore.clearCurrentRun (via the late-bound hook
    // registered in runStore). platformStore and selectionStore need
    // to be cleared explicitly because the cascade does not cover them.
    useCalculatorStore.getState().reset()
    usePlatformStore.getState().clearSelection()
    useSelectionStore.getState().resetAllSelections()
    // No confirmation modal — "Start New Run" is explicit operator intent
    // per D-10.
    onStartNewRun()
  }

  return (
    <div className="space-y-6">
      {/* Header — metadata summary */}
      <FinalizedRunHeader />

      {/* Phase 15 SMK3-16: pre-Phase-15 advisory banner (renders conditionally) */}
      <HistoricalRunBanner />

      {/* Phase 15 SMK3-15: Calculation Audit Trail — Inputs / Intermediates /
          Outputs / Diluent decision blocks. Reads exclusively from RunRecord
          (D-15-01); pure render-from-record. */}
      <AuditTrailSection />

      {/* Actions row — Print + Start New Run. Hidden on print. */}
      <div className="flex items-center gap-3 print:hidden">
        <PrintButton />
        <button
          type="button"
          onClick={handleStartNewRun}
          className="px-4 py-2 text-sm font-medium rounded-md bg-[var(--color-primary)] text-white hover:opacity-90"
        >
          Start New Run
        </button>
      </div>

      {/* Reagent prep recipe — reused from Phase 3 (printable) */}
      <section>
        <h3 className="text-lg font-semibold mb-2 text-[var(--color-foreground)]">
          Reagent Prep Recipe
        </h3>
        <PrepSheet contentRef={prepSheetRef} />
      </section>

      {/* Reagent checklist — reused from Phase 3 */}
      <section>
        <h3 className="text-lg font-semibold mb-2 text-[var(--color-foreground)]">
          Reagent Checklist
        </h3>
        <ReagentChecklist />
      </section>

      {/* Bead regions — reused from Phase 3 */}
      <section>
        <h3 className="text-lg font-semibold mb-2 text-[var(--color-foreground)]">
          Bead Regions
        </h3>
        <BeadRegionList />
      </section>

      {/* Plates — one read-only grid per plate with per-plate label. */}
      <section>
        <h3 className="text-lg font-semibold mb-2 text-[var(--color-foreground)]">
          Plate Layout
        </h3>
        <div className="space-y-4">
          {plateNumbers.map((plateNumber) => {
            const wells = buildWellGrid()
            const selectedWells = plates[plateNumber] ?? new Set<string>()
            return (
              <div key={plateNumber}>
                <div className="text-sm font-medium mb-1 text-[var(--color-foreground)]">
                  {reqDisplay} — Plate {plateNumber} of {plateCount}
                </div>
                <PlateGrid
                  wells={wells}
                  selectedWells={selectedWells}
                  standardCols={STANDARD_COLS}
                  sampleIndexMap={sampleIndexMap}
                  activePlate={plateNumber}
                  interactive={false}
                />
              </div>
            )
          })}
        </div>
      </section>
    </div>
  )
}
