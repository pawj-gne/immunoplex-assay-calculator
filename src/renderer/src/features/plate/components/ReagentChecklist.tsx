import { useState } from 'react'
import { useCalculator } from '../../calculator/hooks/useCalculator'

interface ReagentItem {
  id: string
  name: string
  volume: string
  unit: string
  note?: string
}

/**
 * Checkbox list for reagent preparation tracking
 * Operators can check off reagents as they prepare them
 * Note: Checkbox state won't persist to print - operators check on paper
 */
export function ReagentChecklist() {
  const { outputs, singlesWithVolumes, requestType } = useCalculator()
  const [checkedItems, setCheckedItems] = useState<Record<string, boolean>>({})

  if (!outputs) {
    return (
      <div className="text-gray-500 italic print:text-gray-600">
        No calculations available. Please enter sample count.
      </div>
    )
  }

  // Build reagent list
  const reagents: ReagentItem[] = [
    {
      id: 'capture-beads',
      name: 'Capture Bead Solution',
      volume: outputs.finalVolumeML,
      unit: 'mL',
      note: 'Vortex before use'
    },
    {
      id: 'detection-antibody',
      name: 'Biotinylated Detection Antibody',
      volume: outputs.finalVolumeML,
      unit: 'mL'
    },
    {
      id: 'sa-pe',
      name: 'SA-PE (Streptavidin-PE)',
      volume: outputs.finalVolumeML,
      unit: 'mL'
    }
  ]

  // Add assay buffer for custom request types (dilution buffer)
  if (requestType === 'custom' || requestType === 'premix_singles') {
    reagents.push({
      id: 'assay-buffer',
      name: 'Assay Buffer',
      volume: outputs.finalVolumeML,
      unit: 'mL',
      note: 'For dilutions'
    })
  }

  // Add single analytes if present
  if (singlesWithVolumes && singlesWithVolumes.length > 0) {
    singlesWithVolumes.forEach((single) => {
      reagents.push({
        id: `single-${single.id}`,
        name: single.name,
        volume: single.additionVolumeUL,
        unit: 'µL',
        note: `${single.stockConcentration}x stock`
      })
    })
  }

  const handleCheck = (id: string) => {
    setCheckedItems((prev) => ({
      ...prev,
      [id]: !prev[id]
    }))
  }

  return (
    <div className="space-y-4 print:space-y-3">
      <h2 className="text-lg font-semibold text-gray-800 print:text-base">Reagent Checklist</h2>

      <p className="text-sm text-gray-600 print:text-xs">
        Check off each reagent as you prepare it. Ensure all volumes are accurate before proceeding.
      </p>

      <div className="space-y-2 print:space-y-1">
        {reagents.map((reagent) => (
          <label
            key={reagent.id}
            className="flex items-center gap-3 p-2 rounded hover:bg-gray-50 cursor-pointer print:p-1 print:hover:bg-transparent"
          >
            <input
              type="checkbox"
              checked={checkedItems[reagent.id] || false}
              onChange={() => handleCheck(reagent.id)}
              className="w-5 h-5 rounded border-gray-300 text-blue-600 focus:ring-blue-500 print:w-4 print:h-4"
            />
            <span className="flex-1 text-gray-700 print:text-sm">
              {reagent.name}
              {reagent.note && (
                <span className="text-gray-500 text-sm ml-2 print:text-xs">({reagent.note})</span>
              )}
            </span>
            <span className="font-mono font-medium text-gray-900 print:text-sm">
              {reagent.volume} {reagent.unit}
            </span>
          </label>
        ))}
      </div>

      <div className="text-xs text-gray-500 mt-4 print:mt-2 print:text-gray-600">
        Tip: Checkboxes are for on-screen tracking. Mark the printed checklist by hand.
      </div>
    </div>
  )
}
