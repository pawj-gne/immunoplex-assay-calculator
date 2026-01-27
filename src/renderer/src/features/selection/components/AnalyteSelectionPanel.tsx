import { useAnalyteSelection } from '../hooks/useAnalyteSelection'
import { PremixPanelList } from './PremixPanelList'
import { AnalyteSelector } from './AnalyteSelector'
import { SelectedAnalytesList } from './SelectedAnalytesList'

export function AnalyteSelectionPanel() {
  const {
    panels,
    selectedPanelId,
    selectedPanel,
    panelAnalytes,
    availableSingles,
    selectedSingleIds,
    selectedSingles,
    isLoading,
    panelLoading,
    analytesLoading,
    canAddMoreSingles,
    remainingSingles,
    selectPanel,
    toggleSingleAnalyte
  } = useAnalyteSelection()

  if (isLoading && panels.length === 0) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-[var(--color-primary)]"></div>
        <span className="ml-3 text-[var(--color-muted)]">Loading panels and analytes...</span>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <h3 className="text-sm font-medium text-[var(--color-foreground)]">
        Select Analytes
      </h3>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left column: Panel selection */}
        <div className="space-y-4">
          <PremixPanelList
            panels={panels}
            selectedPanelId={selectedPanelId}
            isLoading={panelLoading}
            onSelect={selectPanel}
          />
        </div>

        {/* Right column: Individual analytes */}
        <div className="space-y-4">
          <AnalyteSelector
            analytes={availableSingles}
            selectedIds={selectedSingleIds}
            isLoading={analytesLoading}
            canAddMore={canAddMoreSingles}
            remainingCount={remainingSingles}
            onToggle={toggleSingleAnalyte}
          />
        </div>
      </div>

      {/* Selected analytes summary */}
      <SelectedAnalytesList
        panelName={selectedPanel?.name ?? null}
        panelAnalytes={panelAnalytes}
        singleAnalytes={selectedSingles}
        onRemoveSingle={toggleSingleAnalyte}
      />
    </div>
  )
}
