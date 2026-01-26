import { useState } from 'react'
import { useCalculator } from '../hooks/useCalculator'

export function SingleAnalyteManager() {
  const {
    requestType,
    stockConcentration,
    singlesWithVolumes,
    canAddMoreSingles,
    remainingSingles,
    addSingle,
    removeSingle
  } = useCalculator()

  const [newSingleName, setNewSingleName] = useState('')

  // Don't show for premix-only
  if (requestType === 'premix') {
    return null
  }

  const handleAddSingle = () => {
    if (!newSingleName.trim() || !stockConcentration) return

    addSingle({
      name: newSingleName.trim(),
      stockConcentration
    })
    setNewSingleName('')
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleAddSingle()
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h3 className="font-medium text-[var(--color-foreground)]">Single Analytes</h3>
        {remainingSingles !== Infinity && (
          <span className="text-sm text-[var(--color-muted)]">{remainingSingles} remaining</span>
        )}
      </div>

      {/* Add Single Form */}
      <div className="flex gap-2">
        <input
          type="text"
          value={newSingleName}
          onChange={(e) => setNewSingleName(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Analyte name"
          disabled={!canAddMoreSingles || !stockConcentration}
          className="flex-1 px-3 py-2 border border-[var(--color-border)] rounded-md focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)] focus:border-transparent disabled:bg-gray-100 disabled:cursor-not-allowed"
        />
        <button
          type="button"
          onClick={handleAddSingle}
          disabled={!canAddMoreSingles || !newSingleName.trim() || !stockConcentration}
          className="px-4 py-2 bg-[var(--color-primary)] text-white rounded-md hover:bg-blue-600 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
        >
          Add
        </button>
      </div>

      {!stockConcentration && (
        <p className="text-sm text-yellow-600">Select a platform to add singles</p>
      )}

      {/* Singles List */}
      {singlesWithVolumes && singlesWithVolumes.length > 0 && (
        <div className="border border-[var(--color-border)] rounded-lg divide-y divide-[var(--color-border)]">
          {singlesWithVolumes.map((single) => (
            <div
              key={single.id}
              className="flex justify-between items-center p-3 hover:bg-gray-50"
            >
              <div>
                <span className="font-medium">{single.name}</span>
                <span className="text-sm text-[var(--color-muted)] ml-2">
                  ({single.stockConcentration}x stock)
                </span>
              </div>
              <div className="flex items-center gap-4">
                <span className="font-mono text-sm">{single.additionVolumeUL} µL</span>
                <button
                  type="button"
                  onClick={() => removeSingle(single.id)}
                  className="text-red-500 hover:text-red-700 text-sm"
                >
                  Remove
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {(!singlesWithVolumes || singlesWithVolumes.length === 0) && stockConcentration && (
        <p className="text-sm text-[var(--color-muted)] text-center py-4">No singles added yet</p>
      )}
    </div>
  )
}
