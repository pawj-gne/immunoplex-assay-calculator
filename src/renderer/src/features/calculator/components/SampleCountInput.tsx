import { useState, useEffect, useCallback, type ChangeEvent, type KeyboardEvent } from 'react'

interface SampleCountInputProps {
  /** Committed numeric value (from plateStore.sampleCount) */
  value: number
  /** Slider maximum (default 500) */
  max?: number
  /** Called on commit (blur, Enter, slider change) */
  onChange: (value: number) => void
}

/**
 * Composite input with a slider and an editable number field that stay synced.
 *
 * Uses a two-state pattern to avoid typing friction:
 * - `value` prop is the committed numeric value (drives the slider)
 * - Internal `displayValue` (string state) is what the text field shows
 * - On blur or Enter, the display value is parsed, clamped, and committed
 * - Slider changes commit immediately
 */
export function SampleCountInput({ value, max = 500, onChange }: SampleCountInputProps) {
  const [displayValue, setDisplayValue] = useState(value === 0 ? '' : String(value))

  // Sync displayValue when value prop changes externally (e.g., reset)
  useEffect(() => {
    setDisplayValue(value === 0 ? '' : String(value))
  }, [value])

  const commitValue = useCallback(
    (raw: string) => {
      const parsed = parseInt(raw, 10)
      if (isNaN(parsed) || parsed < 0) {
        onChange(0)
        setDisplayValue('')
      } else {
        const clamped = Math.min(parsed, max)
        onChange(clamped)
        setDisplayValue(clamped === 0 ? '' : String(clamped))
      }
    },
    [max, onChange]
  )

  const handleFieldChange = (e: ChangeEvent<HTMLInputElement>) => {
    setDisplayValue(e.target.value)
  }

  const handleFieldBlur = () => {
    commitValue(displayValue)
  }

  const handleFieldKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      commitValue(displayValue)
    }
  }

  const handleSliderChange = (e: ChangeEvent<HTMLInputElement>) => {
    const val = Number(e.target.value)
    onChange(val)
    setDisplayValue(val === 0 ? '' : String(val))
  }

  return (
    <div>
      <label className="block text-sm font-medium text-[var(--color-foreground)] mb-1">
        Samples
      </label>
      <div className="flex items-center gap-4">
        <input
          type="number"
          min={0}
          max={max}
          value={displayValue}
          placeholder="0"
          onChange={handleFieldChange}
          onBlur={handleFieldBlur}
          onKeyDown={handleFieldKeyDown}
          className="w-24 px-3 py-2 border border-[var(--color-border)] rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]"
        />
        <input
          type="range"
          min={0}
          max={max}
          value={value}
          onChange={handleSliderChange}
          className="flex-1 h-2 accent-[var(--color-primary)]"
        />
      </div>
    </div>
  )
}
