import type { Analyte } from '../../../../../shared/types/analyte'

interface AnalyteSelectorProps {
  analytes: Analyte[]
  selectedIds: string[]
  isLoading: boolean
  canAddMore: boolean
  remainingCount: number
  onToggle: (analyteId: string) => void
}

export function AnalyteSelector({
  analytes,
  selectedIds,
  isLoading,
  canAddMore,
  remainingCount,
  onToggle
}: AnalyteSelectorProps) {
  if (isLoading) {
    return (
      <div className="flex items-center p-4">
        <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-[var(--color-primary)]"></div>
        <span className="ml-2 text-sm text-[var(--color-muted)]">Loading analytes...</span>
      </div>
    )
  }

  if (analytes.length === 0) {
    return (
      <div className="p-3 bg-gray-50 rounded-lg">
        <p className="text-sm text-[var(--color-muted)] italic">
          No additional analytes available.
        </p>
      </div>
    )
  }

  const isLimited = remainingCount !== Infinity

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <h4 className="text-sm font-medium text-[var(--color-foreground)]">
          Add Individual Analytes
        </h4>
        {isLimited && (
          <span
            className={`text-xs ${remainingCount > 0 ? 'text-[var(--color-muted)]' : 'text-amber-600'}`}
          >
            {remainingCount} remaining
          </span>
        )}
      </div>

      <div className="grid grid-cols-2 gap-2 max-h-64 overflow-y-auto p-1">
        {analytes.map((analyte) => {
          const isSelected = selectedIds.includes(analyte.id)
          const isDisabled = !canAddMore && !isSelected

          return (
            <label
              key={analyte.id}
              className={`
                flex items-center gap-2 p-2 rounded-lg border cursor-pointer transition-all duration-150
                ${isSelected ? 'border-[var(--color-primary)] bg-blue-50' : 'border-[var(--color-border)] bg-white'}
                ${isDisabled ? 'opacity-50 cursor-not-allowed' : 'hover:border-[var(--color-primary)]'}
              `}
            >
              <input
                type="checkbox"
                checked={isSelected}
                disabled={isDisabled}
                onChange={() => onToggle(analyte.id)}
                className="h-4 w-4 rounded border-[var(--color-border)] text-[var(--color-primary)] focus:ring-[var(--color-primary)]"
              />
              <div className="flex-1 min-w-0">
                <span className="text-sm font-medium text-[var(--color-foreground)] truncate block">
                  {analyte.name}
                </span>
                <span className="text-xs text-[var(--color-muted)]">
                  Region {analyte.beadRegion}
                </span>
              </div>
            </label>
          )
        })}
      </div>

      {!canAddMore && isLimited && (
        <p className="text-xs text-amber-600">
          Maximum singles limit reached. Remove a selection to add more.
        </p>
      )}
    </div>
  )
}
