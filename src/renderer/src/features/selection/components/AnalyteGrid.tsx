import type { PremixPanel } from '../../../../../shared/types/panel'
import type { Analyte } from '../../../../../shared/types/analyte'
import { AnalyteCard } from './AnalyteCard'

interface AnalyteGridProps {
  panels: PremixPanel[]
  panelAnalyteMap: Record<string, Analyte[]>
  unassignedAnalytes: Analyte[]
  selectedPanelId: string | null
  selectedSingleIds: string[]
  canAddMoreSingles: boolean
  onToggleSingle: (analyteId: string) => void
}

export function AnalyteGrid({
  panels,
  panelAnalyteMap,
  unassignedAnalytes,
  selectedPanelId,
  selectedSingleIds,
  canAddMoreSingles,
  onToggleSingle
}: AnalyteGridProps) {
  return (
    <div className="space-y-6">
      {/* Panel-grouped sections */}
      {panels.map((panel) => {
        const analytes = panelAnalyteMap[panel.id] ?? []
        if (analytes.length === 0) return null

        const isPanelSelected = panel.id === selectedPanelId

        return (
          <div key={panel.id}>
            <div className="flex items-center gap-3 mb-3">
              <h4 className="text-xs font-semibold uppercase tracking-wide text-[var(--color-muted)]">
                {panel.name}
              </h4>
              <div className="flex-1 h-px bg-[var(--color-border)]" />
              {isPanelSelected && (
                <span className="text-xs px-2 py-0.5 rounded bg-blue-100 text-blue-700 font-medium">
                  Selected Panel
                </span>
              )}
            </div>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
              {analytes.map((analyte) => {
                const isGrayed = isPanelSelected
                const isSelected = selectedSingleIds.includes(analyte.id)
                const isDisabled = !canAddMoreSingles && !isSelected

                return (
                  <AnalyteCard
                    key={analyte.id}
                    analyte={analyte}
                    isSelected={isSelected}
                    isGrayed={isGrayed}
                    isDisabled={isDisabled}
                    onToggle={() => onToggleSingle(analyte.id)}
                  />
                )
              })}
            </div>
          </div>
        )
      })}

      {/* Unassigned analytes section */}
      {unassignedAnalytes.length > 0 && (
        <div>
          <div className="flex items-center gap-3 mb-3">
            <h4 className="text-xs font-semibold uppercase tracking-wide text-[var(--color-muted)]">
              All Analytes
            </h4>
            <div className="flex-1 h-px bg-[var(--color-border)]" />
          </div>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
            {unassignedAnalytes.map((analyte) => {
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
      )}

      {/* Empty state when no analytes at all */}
      {panels.every((p) => (panelAnalyteMap[p.id] ?? []).length === 0) &&
        unassignedAnalytes.length === 0 && (
          <div className="p-8 text-center">
            <p className="text-sm text-[var(--color-muted)] italic">
              No analytes available for this species.
            </p>
          </div>
        )}
    </div>
  )
}
