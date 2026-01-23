import type { Platform } from '../../../../shared/types/platform'

interface PlatformCardProps {
  platform: Platform
  isSelected: boolean
  onSelect: (id: string) => void
}

export function PlatformCard({ platform, isSelected, onSelect }: PlatformCardProps) {
  return (
    <button
      type="button"
      onClick={() => onSelect(platform.id)}
      className={`
        w-full p-4 rounded-lg border-2 text-left transition-all duration-150
        hover:border-[var(--color-primary)] hover:shadow-md
        focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)] focus:ring-offset-2
        ${
          isSelected
            ? 'border-[var(--color-primary)] bg-blue-50 shadow-md'
            : 'border-[var(--color-border)] bg-white'
        }
      `}
    >
      <div className="flex justify-between items-start mb-2">
        <h3 className="font-semibold text-[var(--color-foreground)]">
          {platform.name}
        </h3>
        {isSelected && (
          <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-[var(--color-primary)] text-white">
            Selected
          </span>
        )}
      </div>

      {platform.description && (
        <p className="text-sm text-[var(--color-muted)] mb-3">
          {platform.description}
        </p>
      )}

      <div className="flex items-center gap-2 pt-2 border-t border-[var(--color-border)]">
        <span className="text-xs font-medium text-[var(--color-muted)] uppercase tracking-wide">
          Stock Concentration:
        </span>
        <span className="text-sm font-semibold text-[var(--color-foreground)]">
          {platform.stockConcentration}x
        </span>
      </div>
    </button>
  )
}
