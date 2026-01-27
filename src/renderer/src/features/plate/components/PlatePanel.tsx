import { useState } from 'react'
import { usePlateLayout } from '../hooks/usePlateLayout'
import { PlateGrid } from './PlateGrid'

/**
 * Panel displaying plate layout visualization with multi-plate support.
 * Shows an interactive plate selector when multiple plates are needed.
 * Renders empty state when calculator has no outputs.
 */
export function PlatePanel() {
  const { layouts, hasOutputs } = usePlateLayout()
  const [currentPlate, setCurrentPlate] = useState(1)

  if (!hasOutputs || layouts.length === 0) {
    return (
      <div className="text-center py-8 text-[var(--color-muted)]">
        Enter sample count and other inputs to see plate layout
      </div>
    )
  }

  const currentLayout = layouts[currentPlate - 1]

  // Reset to plate 1 if current plate no longer exists (sample count decreased)
  if (!currentLayout) {
    setCurrentPlate(1)
    return null
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-medium text-[var(--color-foreground)]">
          Plate Layout
        </h3>
        {layouts.length > 1 && (
          <div className="flex items-center gap-2">
            <span className="text-sm text-[var(--color-muted)]">Plate:</span>
            <select
              value={currentPlate}
              onChange={(e) => setCurrentPlate(Number(e.target.value))}
              className="border border-[var(--color-border)] rounded px-2 py-1 text-sm"
            >
              {layouts.map((_, i) => (
                <option key={i + 1} value={i + 1}>
                  {i + 1}
                </option>
              ))}
            </select>
            <span className="text-sm text-[var(--color-muted)]">
              of {layouts.length}
            </span>
          </div>
        )}
      </div>

      <PlateGrid wells={currentLayout.wells} />
    </div>
  )
}
