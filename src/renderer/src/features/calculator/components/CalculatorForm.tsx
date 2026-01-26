import { useCalculator } from '../hooks/useCalculator'

export function CalculatorForm() {
  const {
    sampleCount,
    replicateMode,
    plateCount,
    requestType,
    validationError,
    setSampleCount,
    setReplicateMode,
    setPlateCount,
    setRequestType
  } = useCalculator()

  return (
    <div className="space-y-4">
      <h3 className="font-medium text-[var(--color-foreground)]">Calculator Inputs</h3>

      {/* Sample Count */}
      <div>
        <label
          htmlFor="sampleCount"
          className="block text-sm font-medium text-[var(--color-foreground)] mb-1"
        >
          Number of Samples
        </label>
        <input
          id="sampleCount"
          type="number"
          min={1}
          value={sampleCount}
          onChange={(e) => setSampleCount(Number(e.target.value))}
          className="w-full px-3 py-2 border border-[var(--color-border)] rounded-md focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)] focus:border-transparent"
        />
      </div>

      {/* Replicate Mode */}
      <div>
        <label className="block text-sm font-medium text-[var(--color-foreground)] mb-1">
          Replicate Mode
        </label>
        <div className="flex gap-4">
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="radio"
              name="replicateMode"
              value="singles"
              checked={replicateMode === 'singles'}
              onChange={() => setReplicateMode('singles')}
              className="text-[var(--color-primary)] focus:ring-[var(--color-primary)]"
            />
            <span className="text-sm">Singles (72 wells/plate)</span>
          </label>
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="radio"
              name="replicateMode"
              value="duplicates"
              checked={replicateMode === 'duplicates'}
              onChange={() => setReplicateMode('duplicates')}
              className="text-[var(--color-primary)] focus:ring-[var(--color-primary)]"
            />
            <span className="text-sm">Duplicates (36 wells/plate)</span>
          </label>
        </div>
      </div>

      {/* Plate Count */}
      <div>
        <label
          htmlFor="plateCount"
          className="block text-sm font-medium text-[var(--color-foreground)] mb-1"
        >
          Number of Plates
        </label>
        <input
          id="plateCount"
          type="number"
          min={1}
          max={10}
          value={plateCount}
          onChange={(e) => setPlateCount(Number(e.target.value))}
          className="w-full px-3 py-2 border border-[var(--color-border)] rounded-md focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)] focus:border-transparent"
        />
      </div>

      {/* Request Type */}
      <div>
        <label className="block text-sm font-medium text-[var(--color-foreground)] mb-1">
          Request Type
        </label>
        <select
          value={requestType}
          onChange={(e) => setRequestType(e.target.value as typeof requestType)}
          className="w-full px-3 py-2 border border-[var(--color-border)] rounded-md focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)] focus:border-transparent"
        >
          <option value="premix">Premix Only</option>
          <option value="premix_singles">Premix + Singles (max 5)</option>
          <option value="custom">Full Custom (unlimited)</option>
        </select>
      </div>

      {/* Validation Error */}
      {validationError && (
        <div className="p-3 bg-red-50 border border-red-200 rounded-md">
          <p className="text-sm text-red-700">{validationError}</p>
        </div>
      )}
    </div>
  )
}
