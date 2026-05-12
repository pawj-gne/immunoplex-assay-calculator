import { CalculatorForm } from './CalculatorForm'
import { ItemizedVolumeDisplay } from './ItemizedVolumeDisplay'
import { PlatePanel } from '../../plate/components/PlatePanel'
import { useCalculator } from '../hooks/useCalculator'

/**
 * Calculator output-rendering surface (Plan 14-06 Task 4 Step B):
 *
 * Three rendering branches, in priority order:
 *
 *   1. capPaused === true (D-10) — operator typed an over-cap old-reagent
 *      value and has not yet overridden OR lowered it. Render an amber
 *      "Cap exceeded — override or lower the value to resume calculation."
 *      placeholder. Takes priority over the validity branch because it's
 *      the most actionable signal: the operator just typed something.
 *      Defense-in-depth: getOutputs() already returns null when capPaused
 *      (Step A of Task 4), so this is double-locked.
 *
 *   2. isValid && itemizedVolumes && outputs — happy path; render the
 *      ItemizedVolumeDisplay (Phase 12 contract preserved).
 *
 *   3. fallthrough — neutral "Enter valid inputs to see calculated volumes"
 *      placeholder (e.g., sampleCount === 0 with no cap-pause active).
 */
export function CalculatorPanel() {
  const { isValid, outputs, itemizedVolumes, capPaused } = useCalculator()

  return (
    <div className="space-y-6">
      <CalculatorForm />
      <hr className="border-[var(--color-border)]" />
      <PlatePanel />
      <hr className="border-[var(--color-border)]" />

      {capPaused ? (
        // D-10: output suppression while any old-reagent input is over its
        // 20% cap without override accepted. Override-accept OR lowering
        // the value to the cap clears this state and resumes computation.
        <div className="p-4 bg-amber-50 border border-amber-200 rounded-lg">
          <p className="text-sm text-amber-800">
            Cap exceeded — override or lower the value to resume calculation.
          </p>
        </div>
      ) : isValid && itemizedVolumes && outputs ? (
        <ItemizedVolumeDisplay
          itemizedVolumes={itemizedVolumes}
          totalWells={outputs.totalWells}
          unknownWells={outputs.unknownWells}
          standardWells={outputs.standardWells}
        />
      ) : (
        <div className="p-4 bg-gray-50 border border-[var(--color-border)] rounded-lg">
          <p className="text-sm text-[var(--color-muted)]">
            Enter valid inputs to see calculated volumes
          </p>
        </div>
      )}
    </div>
  )
}
