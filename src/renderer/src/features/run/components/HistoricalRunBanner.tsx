import { useRunStore } from '../../../stores/runStore'

/**
 * Phase 15 SMK3-16 D-15-11: advisory banner above the audit trail for runs
 * saved before Phase 15 (calculationRulesVersion !== 'smoke3'). Renders null
 * for Phase-15-or-later runs and when no current run is loaded. Print-safe
 * (lives inside FinalizedRunView's print stylesheet).
 */
export function HistoricalRunBanner(): JSX.Element | null {
  const currentRun = useRunStore(
    (s) => s.runs.find((r) => r.id === s.currentRunId) ?? null
  )
  if (!currentRun) return null
  if (currentRun.calculationRulesVersion === 'smoke3') return null
  return (
    <div className="p-3 bg-amber-50 border border-amber-300 rounded-md">
      <p className="text-sm text-amber-900">
        This run was saved under previous calculation rules. Values displayed as recorded — no recompute on reopen.
      </p>
    </div>
  )
}
