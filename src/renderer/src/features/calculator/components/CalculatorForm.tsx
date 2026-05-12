import { useState, useEffect } from 'react'
import { useCalculator } from '../hooks/useCalculator'
import { SampleCountInput } from './SampleCountInput'
import { OldReagentCapModal } from '../../plate/components/OldReagentCapModal'
import { DEAD_VOLUME_PER_SETUP_UL } from '../../../../../shared/constants/calculator'

/**
 * Calculator Inputs panel — 7 controls in the D-01 PRD order:
 *   1. Number of Plates       (NEW — bidirectional with plateStore)
 *   2. Replicate Mode         (existing radios)
 *   3. Number of Samples      (existing SampleCountInput slider)
 *   4. Old Beads (mL)         (NEW — 20%-cap soft-block + override)
 *   5. Old Antibodies (mL)    (NEW — 20%-cap soft-block + override)
 *   6. Number of Setups       (NEW — drives dead volume = setups × 2 mL)
 *   7. Request Type badge     (existing read-only)
 *
 * D-09/D-10 cap UX: when oldBeads OR oldAntibodies exceeds 20% of its
 * per-reagent total reaction volume, the input renders with a red
 * border + helper text and the OldReagentCapModal opens. Yes-override
 * accepts the typed value (amber 'overridden' badge); Cancel snaps the
 * input back to the cap value. While any over-cap input is awaiting
 * decision (no override accepted, value not lowered), capPaused is
 * pushed into the store via useEffect so calculator outputs pause
 * (CalculatorPanel renders the cap-exceeded placeholder).
 */
export function CalculatorForm() {
  const {
    sampleCount,
    replicateMode,
    plateCount,
    volumePerWell,
    numberOfSetups,
    oldBeads,
    oldAntibodies,
    requestType,
    validationError,
    setSampleCount,
    setReplicateMode,
    setNumberOfSetups,
    setOldBeads,
    setOldAntibodies,
    setPlateCount,
    setCapPaused
  } = useCalculator()

  // Two-state pattern (Pattern S7 from 14-PATTERNS.md) — each numeric input
  // tracks a `displayValue` string locally so the operator's keystrokes
  // don't fight a NaN→0 coerce, then commits on blur / Enter.
  const [platesDisplay, setPlatesDisplay] = useState(String(plateCount))
  const [oldBeadsDisplay, setOldBeadsDisplay] = useState(oldBeads === 0 ? '0' : String(oldBeads))
  const [oldAntibodiesDisplay, setOldAntibodiesDisplay] = useState(
    oldAntibodies === 0 ? '0' : String(oldAntibodies)
  )
  const [setupsDisplay, setSetupsDisplay] = useState(String(numberOfSetups))

  // Keep displayValues in sync if external code (e.g., runStore.loadRun) changes the store.
  useEffect(() => {
    setPlatesDisplay(String(plateCount))
  }, [plateCount])
  useEffect(() => {
    setOldBeadsDisplay(oldBeads === 0 ? '0' : String(oldBeads))
  }, [oldBeads])
  useEffect(() => {
    setOldAntibodiesDisplay(oldAntibodies === 0 ? '0' : String(oldAntibodies))
  }, [oldAntibodies])
  useEffect(() => {
    setSetupsDisplay(String(numberOfSetups))
  }, [numberOfSetups])

  // Override-acceptance flags per reagent — D-10. Reset when input value
  // changes (so re-typing a still-over value re-prompts; matches the
  // "re-prompts on next focus" CONTEXT wording).
  const [beadsOverrideAccepted, setBeadsOverrideAccepted] = useState(false)
  const [antibodiesOverrideAccepted, setAntibodiesOverrideAccepted] = useState(false)

  // Modal state — one modal can be open at a time (D-10 single confirm).
  // pendingTypedValue snapshots the typed value at modal-open time so the
  // operator can't race the input.
  const [activeModal, setActiveModal] = useState<'beads' | 'antibodies' | null>(null)
  const [pendingTypedValue, setPendingTypedValue] = useState(0)

  // Compute live 20%-caps per D-09. Inputs in mL; volumePerWell is µL;
  // dead volume = numberOfSetups × DEAD_VOLUME_PER_SETUP_UL (= 2000 µL/setup).
  // Total reaction volume per reagent in mL = (sampleCount × volumePerWell + setups × 2000) / 1000.
  // Cap = 20% of that.
  const totalReactionVolumeML =
    sampleCount > 0 && volumePerWell > 0
      ? (sampleCount * volumePerWell + numberOfSetups * DEAD_VOLUME_PER_SETUP_UL) / 1000
      : 0
  const capML = 0.2 * totalReactionVolumeML
  const beadsExceedsCap = !beadsOverrideAccepted && oldBeads > capML && capML > 0
  const antibodiesExceedsCap = !antibodiesOverrideAccepted && oldAntibodies > capML && capML > 0

  // D-10 OUTPUT PAUSE: any active over-cap input without override accepted
  // pauses calculator output. Push the derived flag into the store so
  // CalculatorPanel (the output-rendering surface) can gate ItemizedVolumeDisplay
  // and getOutputs() returns null. Driven via useEffect so the store stays
  // in sync with the live UI state (override flips, value lowering, etc.).
  useEffect(() => {
    setCapPaused(beadsExceedsCap || antibodiesExceedsCap)
  }, [beadsExceedsCap, antibodiesExceedsCap, setCapPaused])

  // Commit handlers for each numeric input.
  const commitPlates = (raw: string) => {
    const n = parseInt(raw, 10)
    if (!Number.isFinite(n) || n < 1) {
      setPlatesDisplay(String(plateCount)) // snap back to store value
      return
    }
    setPlateCount(n)
  }

  const commitSetups = (raw: string) => {
    const n = parseInt(raw, 10)
    if (!Number.isFinite(n) || n < 1) {
      setSetupsDisplay(String(numberOfSetups))
      return
    }
    setNumberOfSetups(n)
  }

  // Old-reagent commit — per D-08 the field displays the operator-typed
  // value; floor-rounding happens inside calculatorStore.getOutputs(),
  // not here. Just validate non-negative finite and pass through; if it
  // exceeds the live cap, open the override modal.
  const commitOldBeads = (raw: string) => {
    const n = parseFloat(raw)
    if (!Number.isFinite(n) || n < 0) {
      setOldBeadsDisplay(oldBeads === 0 ? '0' : String(oldBeads))
      return
    }
    // Reset override flag when value changes (re-prompt next time it exceeds).
    if (n !== oldBeads) setBeadsOverrideAccepted(false)
    setOldBeads(n)
    if (capML > 0 && n > capML && !beadsOverrideAccepted) {
      setPendingTypedValue(n)
      setActiveModal('beads')
    }
  }

  const commitOldAntibodies = (raw: string) => {
    const n = parseFloat(raw)
    if (!Number.isFinite(n) || n < 0) {
      setOldAntibodiesDisplay(oldAntibodies === 0 ? '0' : String(oldAntibodies))
      return
    }
    if (n !== oldAntibodies) setAntibodiesOverrideAccepted(false)
    setOldAntibodies(n)
    if (capML > 0 && n > capML && !antibodiesOverrideAccepted) {
      setPendingTypedValue(n)
      setActiveModal('antibodies')
    }
  }

  // Modal handlers
  const handleOverride = () => {
    if (activeModal === 'beads') setBeadsOverrideAccepted(true)
    else if (activeModal === 'antibodies') setAntibodiesOverrideAccepted(true)
    setActiveModal(null)
  }

  const handleCancel = () => {
    // Snap input back to the cap value per D-10.
    if (activeModal === 'beads') {
      setOldBeads(capML)
      setOldBeadsDisplay(capML.toFixed(1))
    } else if (activeModal === 'antibodies') {
      setOldAntibodies(capML)
      setOldAntibodiesDisplay(capML.toFixed(1))
    }
    setActiveModal(null)
  }

  // Display-friendly request type label (preserved from original)
  const requestTypeLabel =
    requestType === 'premix'
      ? 'Premix Panel Only'
      : requestType === 'premix_singles'
        ? 'Premix + Singles'
        : 'Custom (Singles Only)'

  const numericInputClass = (exceeds: boolean) =>
    `w-24 px-3 py-2 border rounded-md text-sm focus:outline-none focus:ring-2 ${
      exceeds
        ? 'border-red-500 ring-red-500'
        : 'border-[var(--color-border)] focus:ring-[var(--color-primary)]'
    }`

  return (
    <div className="space-y-4">
      <h3 className="font-medium text-[var(--color-foreground)]">Calculator Inputs</h3>

      {/* 1. Number of Plates (D-01 / D-03 bidirectional with PlateToolbar) */}
      <div>
        <label className="block text-sm font-medium text-[var(--color-foreground)] mb-1">
          Number of Plates
        </label>
        <input
          type="number"
          min={1}
          step={1}
          value={platesDisplay}
          onChange={(e) => setPlatesDisplay(e.target.value)}
          onBlur={(e) => commitPlates(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') commitPlates((e.target as HTMLInputElement).value)
          }}
          className={numericInputClass(false)}
        />
      </div>

      {/* 2. Replicate Mode (existing radios, preserved) */}
      <div>
        <label className="block text-sm font-medium text-[var(--color-foreground)] mb-1">
          Replicate Mode
        </label>
        <div className="flex gap-4">
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="radio"
              name="replicateMode"
              value="singles"
              checked={replicateMode === 'singles'}
              onChange={() => setReplicateMode('singles')}
              className="text-[var(--color-primary)] focus:ring-[var(--color-primary)]"
            />
            <span className="text-sm">Singles (72 wells/plate)</span>
          </label>
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="radio"
              name="replicateMode"
              value="duplicates"
              checked={replicateMode === 'duplicates'}
              onChange={() => setReplicateMode('duplicates')}
              className="text-[var(--color-primary)] focus:ring-[var(--color-primary)]"
            />
            <span className="text-sm">Duplicates (36 wells/plate)</span>
          </label>
        </div>
      </div>

      {/* 3. Number of Samples (existing slider, preserved) */}
      <SampleCountInput value={sampleCount} max={500} onChange={setSampleCount} />

      {/* 4. Old Beads — mL (D-04, D-09, D-10) */}
      <div>
        <label className="block text-sm font-medium text-[var(--color-foreground)] mb-1">
          Old Beads (mL)
        </label>
        <div className="flex items-center gap-2">
          <input
            type="number"
            min={0}
            step={0.1}
            value={oldBeadsDisplay}
            onChange={(e) => setOldBeadsDisplay(e.target.value)}
            onBlur={(e) => commitOldBeads(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') commitOldBeads((e.target as HTMLInputElement).value)
            }}
            className={numericInputClass(beadsExceedsCap)}
          />
          {beadsOverrideAccepted && oldBeads > capML && (
            <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-amber-100 text-amber-700">
              overridden
            </span>
          )}
        </div>
        {capML > 0 && (
          <p
            className={`text-xs mt-1 ${
              beadsExceedsCap ? 'text-red-600' : 'text-[var(--color-muted)]'
            }`}
          >
            {beadsExceedsCap
              ? `Max ${capML.toFixed(1)} mL (20% of ${totalReactionVolumeML.toFixed(1)} mL total). Override?`
              : `20% cap: ${capML.toFixed(1)} mL`}
          </p>
        )}
      </div>

      {/* 5. Old Antibodies — mL (D-04, D-09, D-10) */}
      <div>
        <label className="block text-sm font-medium text-[var(--color-foreground)] mb-1">
          Old Antibodies (mL)
        </label>
        <div className="flex items-center gap-2">
          <input
            type="number"
            min={0}
            step={0.1}
            value={oldAntibodiesDisplay}
            onChange={(e) => setOldAntibodiesDisplay(e.target.value)}
            onBlur={(e) => commitOldAntibodies(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') commitOldAntibodies((e.target as HTMLInputElement).value)
            }}
            className={numericInputClass(antibodiesExceedsCap)}
          />
          {antibodiesOverrideAccepted && oldAntibodies > capML && (
            <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-amber-100 text-amber-700">
              overridden
            </span>
          )}
        </div>
        {capML > 0 && (
          <p
            className={`text-xs mt-1 ${
              antibodiesExceedsCap ? 'text-red-600' : 'text-[var(--color-muted)]'
            }`}
          >
            {antibodiesExceedsCap
              ? `Max ${capML.toFixed(1)} mL (20% of ${totalReactionVolumeML.toFixed(1)} mL total). Override?`
              : `20% cap: ${capML.toFixed(1)} mL`}
          </p>
        )}
      </div>

      {/* 6. Number of Setups (D-05) */}
      <div>
        <label className="block text-sm font-medium text-[var(--color-foreground)] mb-1">
          Number of Setups
        </label>
        <input
          type="number"
          min={1}
          step={1}
          value={setupsDisplay}
          onChange={(e) => setSetupsDisplay(e.target.value)}
          onBlur={(e) => commitSetups(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') commitSetups((e.target as HTMLInputElement).value)
          }}
          className={numericInputClass(false)}
        />
        <p className="text-xs text-[var(--color-muted)] mt-1">
          Dead volume = {numberOfSetups} × 2.0 mL = {(numberOfSetups * 2).toFixed(1)} mL
        </p>
      </div>

      {/* 7. Request Type (existing read-only, preserved) */}
      <div>
        <label className="block text-sm font-medium text-[var(--color-foreground)] mb-1">
          Request Type
        </label>
        <div className="px-3 py-2 bg-gray-50 border border-[var(--color-border)] rounded-md text-sm text-[var(--color-foreground)]">
          {requestTypeLabel}
          <span className="text-xs text-[var(--color-muted)] ml-2">
            (determined by analyte selection)
          </span>
        </div>
      </div>

      {/* Validation Error (preserved from original) */}
      {validationError && (
        <div className="p-3 bg-red-50 border border-red-200 rounded-md">
          <p className="text-sm text-red-700">{validationError}</p>
        </div>
      )}

      {/* Cap-exceedance override modal (D-10) */}
      <OldReagentCapModal
        open={activeModal !== null}
        reagentLabel={activeModal === 'antibodies' ? 'Old Antibodies' : 'Old Beads'}
        typedValueML={pendingTypedValue}
        capValueML={capML}
        totalReactionVolumeML={totalReactionVolumeML}
        onOverride={handleOverride}
        onCancel={handleCancel}
      />
    </div>
  )
}
