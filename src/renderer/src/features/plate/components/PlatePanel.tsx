import { usePlateLayout } from '../hooks/usePlateLayout'
import { usePlateStore } from '../../../stores/plateStore'
import { useWellSelection } from '../hooks/useWellSelection'
import { PlateGrid } from './PlateGrid'
import { PlateToolbar } from './PlateToolbar'
import { STANDARD_COLS } from '../../../../../shared/types/plate'

/**
 * Panel displaying interactive plate layout with multi-plate support.
 * Uses PlateToolbar for plate navigation and management.
 * Wires useWellSelection hook to plateStore for interactive well click/drag.
 * Renders empty state when calculator has no outputs.
 */
export function PlatePanel() {
  const { layouts, hasOutputs } = usePlateLayout()
  const {
    activePlate,
    replicateMode,
    setActivePlate,
    addPlate,
    removePlate,
    clearPlate,
    getPlateCount,
    getSamplesRemaining,
    getPlateWells,
    setWellRange
  } = usePlateStore()

  const plateCount = getPlateCount()
  const samplesRemaining = getSamplesRemaining()
  const filledWells = getPlateWells(activePlate)

  const { hoveredWells, handleMouseDown, handleMouseEnter, handleMouseUp } =
    useWellSelection({
      standardCols: STANDARD_COLS,
      replicateMode,
      filledWells,
      onSelectionChange: (wellIds, action) => {
        if (action === 'add') {
          if (getSamplesRemaining() <= 0) return // All samples assigned
          setWellRange(activePlate, wellIds, true)
        } else {
          setWellRange(activePlate, wellIds, false)
        }
      }
    })

  if (!hasOutputs || layouts.length === 0) {
    return (
      <div className="text-center py-8 text-[var(--color-muted)]">
        Enter sample count and other inputs to see plate layout
      </div>
    )
  }

  const currentLayout = layouts[activePlate - 1]

  // Safety check: if activePlate is out of range, show first plate
  const layout = currentLayout ?? layouts[0]
  if (!layout) {
    return null
  }

  const handleRemovePlate = () => {
    removePlate(activePlate)
  }

  const handleClearPlate = () => {
    clearPlate(activePlate)
  }

  return (
    <div className="space-y-4">
      <h3 className="text-lg font-medium text-[var(--color-foreground)]">Plate Layout</h3>

      <PlateToolbar
        activePlate={activePlate}
        plateCount={plateCount}
        samplesRemaining={samplesRemaining}
        onSetActivePlate={setActivePlate}
        onAddPlate={addPlate}
        onRemovePlate={handleRemovePlate}
        onClearPlate={handleClearPlate}
      />

      <PlateGrid
        wells={layout.wells}
        selectedWells={filledWells}
        hoveredWells={hoveredWells}
        standardCols={STANDARD_COLS}
        onCellMouseDown={handleMouseDown}
        onCellMouseEnter={handleMouseEnter}
        onCellMouseUp={handleMouseUp}
      />

      <p className="text-xs text-[var(--color-muted)]">
        Click a well to toggle it. Click and drag to select a range. Ctrl+click to toggle individual wells. Shift+click to extend from last selection.
      </p>
    </div>
  )
}
