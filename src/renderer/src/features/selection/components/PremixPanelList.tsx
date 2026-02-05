import type { PremixPanel } from '../../../../../shared/types/panel'

interface PremixPanelListProps {
  panels: PremixPanel[]
  selectedPanelId: string | null
  isLoading: boolean
  onSelect: (panelId: string | null) => void
}

export function PremixPanelList({
  panels,
  selectedPanelId,
  isLoading,
  onSelect
}: PremixPanelListProps) {
  if (isLoading) {
    return (
      <div className="flex items-center p-4">
        <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-[var(--color-primary)]"></div>
        <span className="ml-2 text-sm text-[var(--color-muted)]">Loading panels...</span>
      </div>
    )
  }

  return (
    <div className="space-y-2">
      <h4 className="text-sm font-medium text-[var(--color-foreground)]">Premix Panels</h4>

      <div className="flex flex-wrap gap-3">
        {/* "None" option for custom assays */}
        <button
          type="button"
          onClick={() => onSelect(null)}
          className={`
            min-w-40 max-w-60 p-3 rounded-lg border-2 text-left transition-all duration-150
            hover:border-[var(--color-primary)] hover:shadow-sm
            focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)] focus:ring-offset-2
            ${
              selectedPanelId === null
                ? 'border-[var(--color-primary)] bg-blue-50'
                : 'border-[var(--color-border)] bg-white'
            }
          `}
        >
          <div className="flex items-center justify-between gap-2">
            <span
              className={`text-sm font-medium ${selectedPanelId === null ? 'text-[var(--color-primary)]' : 'text-[var(--color-foreground)]'}`}
            >
              No Premix (Custom Assay)
            </span>
            {selectedPanelId === null && (
              <span className="text-xs px-2 py-0.5 rounded bg-[var(--color-primary)] text-white whitespace-nowrap">
                Selected
              </span>
            )}
          </div>
          <p className="text-xs text-[var(--color-muted)] mt-1">
            Select individual analytes only
          </p>
        </button>

        {panels.map((panel) => (
          <button
            key={panel.id}
            type="button"
            onClick={() => onSelect(panel.id)}
            className={`
              min-w-40 max-w-60 p-3 rounded-lg border-2 text-left transition-all duration-150
              hover:border-[var(--color-primary)] hover:shadow-sm
              focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)] focus:ring-offset-2
              ${
                panel.id === selectedPanelId
                  ? 'border-[var(--color-primary)] bg-blue-50'
                  : 'border-[var(--color-border)] bg-white'
              }
            `}
          >
            <div className="flex items-center justify-between gap-2">
              <span
                className={`text-sm font-medium ${panel.id === selectedPanelId ? 'text-[var(--color-primary)]' : 'text-[var(--color-foreground)]'}`}
              >
                {panel.name}
              </span>
              {panel.id === selectedPanelId && (
                <span className="text-xs px-2 py-0.5 rounded bg-[var(--color-primary)] text-white whitespace-nowrap">
                  Selected
                </span>
              )}
            </div>
            {panel.description && (
              <p className="text-xs text-[var(--color-muted)] mt-1 line-clamp-2">
                {panel.description}
              </p>
            )}
          </button>
        ))}

        {panels.length === 0 && (
          <p className="text-sm text-[var(--color-muted)] italic p-3">
            No premix panels available for this species.
          </p>
        )}
      </div>
    </div>
  )
}
