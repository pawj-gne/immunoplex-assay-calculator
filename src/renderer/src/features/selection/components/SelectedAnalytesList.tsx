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
  const totalCount = panelAnalytes.length + singleAnalytes.length

  if (totalCount === 0) {
    return (
      <div className="p-4 bg-gray-50 rounded-lg text-center">
        <p className="text-sm text-[var(--color-muted)]">
          No analytes selected. Choose a premix panel or add individual analytes.
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h4 className="text-sm font-medium text-[var(--color-foreground)]">
          Selected Analytes ({totalCount})
        </h4>
      </div>

      <div className="border border-[var(--color-border)] rounded-lg overflow-hidden">
        {/* Panel analytes section */}
        {panelName && panelAnalytes.length > 0 && (
          <div className="bg-blue-50 border-b border-[var(--color-border)]">
            <div className="px-3 py-2 bg-blue-100 border-b border-blue-200">
              <span className="text-xs font-medium text-blue-700 uppercase tracking-wide">
                From {panelName}
              </span>
            </div>
            <div className="divide-y divide-[var(--color-border)]">
              {panelAnalytes.map((analyte) => (
                <div
                  key={analyte.id}
                  className="px-3 py-2 flex items-center justify-between"
                >
                  <span className="text-sm text-[var(--color-foreground)]">{analyte.name}</span>
                  <span className="text-xs text-[var(--color-muted)] bg-white px-2 py-0.5 rounded">
                    Region {analyte.beadRegion}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Single analytes section */}
        {singleAnalytes.length > 0 && (
          <div className="bg-white">
            {panelName && (
              <div className="px-3 py-2 bg-gray-50 border-b border-[var(--color-border)]">
                <span className="text-xs font-medium text-[var(--color-muted)] uppercase tracking-wide">
                  Individual Additions
                </span>
              </div>
            )}
            <div className="divide-y divide-[var(--color-border)]">
              {singleAnalytes.map((analyte) => (
                <div
                  key={analyte.id}
                  className="px-3 py-2 flex items-center justify-between group"
                >
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-[var(--color-foreground)]">{analyte.name}</span>
                    <span className="text-xs text-[var(--color-muted)] bg-gray-100 px-2 py-0.5 rounded">
                      Region {analyte.beadRegion}
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => onRemoveSingle(analyte.id)}
                    className="opacity-0 group-hover:opacity-100 text-red-500 hover:text-red-700 transition-opacity p-1 rounded hover:bg-red-50"
                    title="Remove analyte"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
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
