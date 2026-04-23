import { useAnalyteSelection } from '../hooks/useAnalyteSelection'
import { PremixPanelList } from './PremixPanelList'
import { AnalyteGrid } from './AnalyteGrid'
import { SelectedAnalytesList } from './SelectedAnalytesList'

export function AnalyteSelectionPanel() {
  const {
    panels,
    selectedPanelId,
    selectedPanel,
    panelAnalytes,
    availableAnalytes,
    selectedSingleIds,
    selectedSingles,
    isLoading,
    panelLoading,
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

  const isLimited = remainingSingles !== Infinity

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium text-[var(--color-foreground)]">
          Select Analytes
        </h3>
        {selectedPanelId && isLimited && (
          <span
            className={`text-xs ${remainingSingles > 0 ? 'text-[var(--color-muted)]' : 'text-amber-600'}`}
          >
            {remainingSingles} singles remaining
          </span>
        )}
      </div>

      {/* Top section: Premix panel strip */}
      <PremixPanelList
        panels={panels}
        selectedPanelId={selectedPanelId}
        isLoading={panelLoading}
        onSelect={selectPanel}
      />

      {/* Middle section: Grid + Sidebar */}
      <div className="flex gap-6">
        {/* Left: Analyte grid */}
        <div className="flex-1 min-w-0">
          <AnalyteGrid
            scopedAnalytes={selectedPanelId && selectedPanel ? selectedPanel.analytes : availableAnalytes}
            sectionLabel={selectedPanelId && selectedPanel ? selectedPanel.name : 'Analytes'}
            selectedSingleIds={selectedSingleIds}
            canAddMoreSingles={canAddMoreSingles}
            onToggleSingle={toggleSingleAnalyte}
          />
        </div>

        {/* Right: Selected analytes sidebar */}
        <SelectedAnalytesList
          panelName={selectedPanel?.name ?? null}
          panelAnalytes={panelAnalytes}
          singleAnalytes={selectedSingles}
          onRemoveSingle={toggleSingleAnalyte}
        />
      </div>
    </div>
  )
}
