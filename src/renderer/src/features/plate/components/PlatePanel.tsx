import { usePlateLayout } from '../hooks/usePlateLayout'
import { usePlateStore } from '../../../stores/plateStore'
import { PlateGrid } from './PlateGrid'
import { PlateToolbar } from './PlateToolbar'

/**
 * Panel displaying plate layout visualization with multi-plate support.
 * Uses PlateToolbar for plate navigation and management.
 * Renders empty state when calculator has no outputs.
 */
export function PlatePanel() {
  const { layouts, hasOutputs } = usePlateLayout()
  const {
    activePlate,
    setActivePlate,
    addPlate,
    removePlate,
    clearPlate,
    getPlateCount,
    getSamplesRemaining
  } = usePlateStore()

  const plateCount = getPlateCount()
  const samplesRemaining = getSamplesRemaining()

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

      <PlateGrid wells={layout.wells} />
    </div>
  )
}
