import { useCalculator } from '../hooks/useCalculator'
import { SampleCountInput } from './SampleCountInput'

export function CalculatorForm() {
  const {
    sampleCount,
    replicateMode,
    requestType,
    validationError,
    setSampleCount,
    setReplicateMode
  } = useCalculator()

  // Display-friendly request type label
  const requestTypeLabel =
    requestType === 'premix'
      ? 'Premix Panel Only'
      : requestType === 'premix_singles'
        ? 'Premix + Singles'
        : 'Custom (Singles Only)'

  return (
    <div className="space-y-4">
      <h3 className="font-medium text-[var(--color-foreground)]">Calculator Inputs</h3>

      {/* Sample Count - Slider + editable field */}
      <SampleCountInput value={sampleCount} max={500} onChange={setSampleCount} />

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

      {/* Request Type - Read-only, driven by selection */}
      <div>
        <label className="block text-sm font-medium text-[var(--color-foreground)] mb-1">
          Request Type
        </label>
        <div className="px-3 py-2 bg-gray-50 border border-[var(--color-border)] rounded-md text-sm text-[var(--color-foreground)]">
          {requestTypeLabel}
          <span className="text-xs text-[var(--color-muted)] ml-2">
            (determined by analyte selection)
          </span>
        </div>
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
