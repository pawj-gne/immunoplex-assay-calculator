import type { Analyte } from '../../../../../shared/types/analyte'
import { AnalyteCard } from './AnalyteCard'

interface AnalyteGridProps {
  scopedAnalytes: Analyte[]
  sectionLabel: string
  selectedSingleIds: string[]
  canAddMoreSingles: boolean
  onToggleSingle: (analyteId: string) => void
}

export function AnalyteGrid({
  scopedAnalytes,
  sectionLabel,
  selectedSingleIds,
  canAddMoreSingles,
  onToggleSingle
}: AnalyteGridProps) {
  if (scopedAnalytes.length === 0) {
    return (
      <div className="p-8 text-center">
        <p className="text-sm text-[var(--color-muted)] italic">
          No analytes available for this species.
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div>
        <div className="flex items-center gap-3 mb-3">
          <h4 className="text-xs font-semibold uppercase tracking-wide text-[var(--color-muted)]">
            {sectionLabel}
          </h4>
          <div className="flex-1 h-px bg-[var(--color-border)]" />
        </div>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
          {scopedAnalytes.map((analyte) => {
            const isSelected = selectedSingleIds.includes(analyte.id)
            const isDisabled = !canAddMoreSingles && !isSelected

            return (
              <AnalyteCard
                key={analyte.id}
                analyte={analyte}
                isSelected={isSelected}
                isGrayed={false}
                isDisabled={isDisabled}
                onToggle={() => onToggleSingle(analyte.id)}
              />
            )
          })}
        </div>
      </div>
    </div>
  )
}
