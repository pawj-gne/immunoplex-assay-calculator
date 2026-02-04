import { useState } from 'react'
import type { Analyte } from '../../../../../shared/types/analyte'

interface SelectedAnalytesListProps {
  panelName: string | null
  panelAnalytes: Analyte[]
  singleAnalytes: Analyte[]
  onRemoveSingle: (analyteId: string) => void
}

export function SelectedAnalytesList({
  panelName,
  panelAnalytes,
  singleAnalytes,
  onRemoveSingle
}: SelectedAnalytesListProps) {
  const [panelExpanded, setPanelExpanded] = useState(true)
  const totalCount = panelAnalytes.length + singleAnalytes.length

  return (
    <div className="w-72 shrink-0 sticky top-0 self-start">
      <div className="border border-[var(--color-border)] rounded-lg overflow-hidden bg-white">
        {/* Header */}
        <div className="px-4 py-3 bg-gray-50 border-b border-[var(--color-border)]">
          <h4 className="text-sm font-medium text-[var(--color-foreground)]">
            Selected Analytes
            {totalCount > 0 && (
              <span className="ml-2 text-xs text-[var(--color-muted)]">({totalCount})</span>
            )}
          </h4>
        </div>

        {/* Empty state */}
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

        {/* Panel section */}
        {panelName && panelAnalytes.length > 0 && (
          <div className="border-b border-[var(--color-border)]">
            <button
              type="button"
              onClick={() => setPanelExpanded(!panelExpanded)}
              className="w-full px-4 py-2 flex items-center justify-between bg-blue-50 hover:bg-blue-100 transition-colors"
            >
              <span className="text-xs font-medium text-blue-700 uppercase tracking-wide">
                {panelName}
              </span>
              <div className="flex items-center gap-2">
                <span className="text-xs text-blue-600">{panelAnalytes.length}</span>
                <svg
                  className={`w-3.5 h-3.5 text-blue-600 transition-transform duration-150 ${panelExpanded ? 'rotate-180' : ''}`}
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </div>
            </button>
            {panelExpanded && (
              <div className="divide-y divide-[var(--color-border)]">
                {panelAnalytes.map((analyte) => (
                  <div
                    key={analyte.id}
                    className="px-4 py-2 flex items-center justify-between bg-blue-50/50"
                  >
                    <span className="text-sm text-[var(--color-foreground)]">{analyte.name}</span>
                    <span className="text-xs text-[var(--color-muted)] bg-white px-2 py-0.5 rounded">
                      {analyte.beadRegion}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Singles section */}
        {singleAnalytes.length > 0 && (
          <div>
            {panelName && (
              <div className="px-4 py-2 bg-gray-50 border-b border-[var(--color-border)]">
                <span className="text-xs font-medium text-[var(--color-muted)] uppercase tracking-wide">
                  Individual Additions
                </span>
              </div>
            )}
            <div className="divide-y divide-[var(--color-border)]">
              {singleAnalytes.map((analyte) => (
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
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
