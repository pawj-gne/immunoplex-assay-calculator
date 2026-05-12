import { useMemo } from 'react'
import type { Analyte } from '../../../../../shared/types/analyte'
import { sortByBeadRegion } from '../lib/sortAnalytes'

interface SelectedAnalytesListProps {
  panelAnalytes: Analyte[]
  singleAnalytes: Analyte[]
  onRemoveSingle: (analyteId: string) => void
}

export function SelectedAnalytesList({
  panelAnalytes,
  singleAnalytes,
  onRemoveSingle
}: SelectedAnalytesListProps) {
  const totalCount = panelAnalytes.length + singleAnalytes.length

  // Combined flat list sorted by bead region (D-14, D-15). Premix members
  // and standalone singles render in the same list with no grouping. Sort
  // helper lives in features/selection/lib/sortAnalytes.ts (extracted for
  // vitest coverage — see Phase 14 Plan 05 Task 2).
  const flatList = useMemo(
    () => [...panelAnalytes, ...singleAnalytes].sort(sortByBeadRegion),
    [panelAnalytes, singleAnalytes]
  )

  // Track which IDs are panel members vs standalone singles for the
  // conditional remove button (D-16: drop remove on member rows; keep on
  // singles rows).
  const panelMemberIds = useMemo(
    () => new Set(panelAnalytes.map((a) => a.id)),
    [panelAnalytes]
  )

  return (
    <div className="w-72 shrink-0 sticky top-0 self-start">
      <div className="border border-[var(--color-border)] rounded-lg overflow-hidden bg-white">
        {/* Header — preserved from prior implementation */}
        <div className="px-4 py-3 bg-gray-50 border-b border-[var(--color-border)]">
          <h4 className="text-sm font-medium text-[var(--color-foreground)]">
            Selected Analytes
            {totalCount > 0 && (
              <span className="ml-2 text-xs text-[var(--color-muted)]">({totalCount})</span>
            )}
          </h4>
        </div>

        {/* Empty state — preserved from prior implementation */}
        {totalCount === 0 && (
          <div className="px-4 py-6 text-center">
            <p className="text-sm text-[var(--color-muted)]">
              No analytes selected.
            </p>
            <p className="text-xs text-[var(--color-muted)] mt-1">
              Choose a premix panel or add individual analytes.
            </p>
          </div>
        )}

        {/* Flat sorted list (D-14, D-15, D-16) */}
        {totalCount > 0 && (
          <div className="divide-y divide-[var(--color-border)]">
            {flatList.map((analyte) => {
              const isPanelMember = panelMemberIds.has(analyte.id)
              return (
                <div
                  key={analyte.id}
                  className="px-4 py-2 flex items-center justify-between group"
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="text-sm text-[var(--color-foreground)] truncate">
                      {analyte.name}
                    </span>
                    <span className="text-xs text-[var(--color-muted)] bg-gray-100 px-2 py-0.5 rounded shrink-0">
                      {analyte.beadRegion}
                    </span>
                  </div>
                  {!isPanelMember && (
                    <button
                      type="button"
                      onClick={() => onRemoveSingle(analyte.id)}
                      className="opacity-0 group-hover:opacity-100 text-red-500 hover:text-red-700 transition-opacity p-1 rounded hover:bg-red-50 shrink-0 ml-2"
                      title="Remove analyte"
                    >
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M6 18L18 6M6 6l12 12"
                        />
                      </svg>
                    </button>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
