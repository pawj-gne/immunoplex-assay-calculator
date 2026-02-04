interface PlateToolbarProps {
  activePlate: number
  plateCount: number
  samplesRemaining: number
  onSetActivePlate: (plate: number) => void
  onAddPlate: () => void
  onRemovePlate: () => void
  onClearPlate: () => void
}

/**
 * Toolbar for plate navigation and management.
 *
 * Left: paging arrows with plate indicator
 * Center: samples remaining badge (green/amber/red)
 * Right: add, remove, clear plate buttons
 */
export function PlateToolbar({
  activePlate,
  plateCount,
  samplesRemaining,
  onSetActivePlate,
  onAddPlate,
  onRemovePlate,
  onClearPlate
}: PlateToolbarProps) {
  const isFirstPlate = activePlate === 1
  const isLastPlate = activePlate === plateCount

  // Badge color based on samples remaining
  const badgeClasses =
    samplesRemaining === 0
      ? 'bg-green-100 text-green-700 border-green-300'
      : samplesRemaining > 0
        ? 'bg-amber-100 text-amber-700 border-amber-300'
        : 'bg-red-100 text-red-700 border-red-300'

  const badgeLabel =
    samplesRemaining === 0
      ? 'All assigned'
      : samplesRemaining > 0
        ? `${samplesRemaining} remaining`
        : `${Math.abs(samplesRemaining)} over-assigned`

  return (
    <div className="flex items-center justify-between px-4 py-2 border-b border-[var(--color-border)]">
      {/* Left: Paging */}
      <div className="flex items-center gap-2">
        <button
          type="button"
          disabled={isFirstPlate}
          onClick={() => onSetActivePlate(activePlate - 1)}
          className="px-2 py-1 text-sm border border-[var(--color-border)] rounded disabled:opacity-40 disabled:cursor-not-allowed hover:bg-[var(--color-surface-hover)]"
          aria-label="Previous plate"
        >
          &lt;
        </button>
        <span className="text-sm text-[var(--color-foreground)]">
          Plate {activePlate} of {plateCount}
        </span>
        <button
          type="button"
          disabled={isLastPlate}
          onClick={() => onSetActivePlate(activePlate + 1)}
          className="px-2 py-1 text-sm border border-[var(--color-border)] rounded disabled:opacity-40 disabled:cursor-not-allowed hover:bg-[var(--color-surface-hover)]"
          aria-label="Next plate"
        >
          &gt;
        </button>
      </div>

      {/* Center: Samples Remaining badge */}
      <div className={`px-3 py-1 text-xs font-medium border rounded-full ${badgeClasses}`}>
        {badgeLabel}
      </div>

      {/* Right: Plate management buttons */}
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={onAddPlate}
          className="px-3 py-1 text-sm border border-[var(--color-border)] rounded hover:bg-[var(--color-surface-hover)]"
        >
          Add Plate
        </button>
        <button
          type="button"
          disabled={plateCount <= 1}
          onClick={onRemovePlate}
          className="px-3 py-1 text-sm border border-[var(--color-border)] rounded disabled:opacity-40 disabled:cursor-not-allowed hover:bg-[var(--color-surface-hover)]"
        >
          Remove Plate
        </button>
        <button
          type="button"
          onClick={onClearPlate}
          className="px-3 py-1 text-sm border border-[var(--color-border)] rounded hover:bg-[var(--color-surface-hover)]"
        >
          Clear Plate
        </button>
      </div>
    </div>
  )
}
