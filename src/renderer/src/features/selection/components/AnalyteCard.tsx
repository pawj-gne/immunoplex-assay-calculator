import type { Analyte } from '../../../../../shared/types/analyte'

interface AnalyteCardProps {
  analyte: Analyte
  isSelected: boolean
  isGrayed: boolean
  isDisabled: boolean
  onToggle: () => void
}

export function AnalyteCard({
  analyte,
  isSelected,
  isGrayed,
  isDisabled,
  onToggle
}: AnalyteCardProps) {
  const isInteractive = !isGrayed && !isDisabled

  const cardClasses = [
    'p-3 rounded-lg border-2 text-left transition-all duration-150 w-full',
    isGrayed
      ? 'border-gray-200 bg-gray-50 opacity-50 cursor-not-allowed'
      : isSelected
        ? 'border-[var(--color-primary)] bg-blue-50 shadow-sm'
        : isDisabled
          ? 'border-gray-200 bg-white opacity-50 cursor-not-allowed'
          : 'border-[var(--color-border)] bg-white hover:border-[var(--color-primary)] hover:shadow-sm cursor-pointer'
  ].join(' ')

  return (
    <button
      type="button"
      onClick={isInteractive ? onToggle : undefined}
      disabled={!isInteractive}
      className={cardClasses}
    >
      <div className="text-sm font-medium text-[var(--color-foreground)] truncate">
        {analyte.name}
      </div>
      <div className="flex items-center justify-between mt-1.5">
        <span className="inline-flex items-center justify-center h-5 min-w-5 px-1.5 rounded-full bg-[#6b2040] text-[0.6rem] font-semibold text-white leading-none">
          {analyte.beadRegion}
        </span>
        <span className="text-xs text-[var(--color-muted)]">
          {analyte.singleConc}x
        </span>
      </div>
    </button>
  )
}
