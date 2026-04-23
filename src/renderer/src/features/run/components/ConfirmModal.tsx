interface ConfirmModalProps {
  open: boolean
  title: string
  body: string
  primaryLabel: string
  secondaryLabel: string
  /**
   * Visual treatment for the primary button. Defaults to 'default'.
   * 'destructive' renders in red (used for discard/delete flows).
   */
  primaryStyle?: 'default' | 'destructive'
  /**
   * Visual treatment for the secondary button. Defaults to 'default'.
   * Plan 04-04's EditWarningModal passes 'destructive' here to render
   * "Edit anyway" in destructive style per D-12 §Specific Ideas. The
   * token mapping is identical to primaryStyle — no asymmetry.
   */
  secondaryStyle?: 'default' | 'destructive'
  onPrimary: () => void
  onSecondary: () => void
}

const STYLE_MAP: Record<'default' | 'destructive', string> = {
  default:
    'px-4 py-2 text-sm font-medium rounded-md border border-[var(--color-border)] bg-white text-[var(--color-foreground)] hover:bg-gray-50',
  destructive:
    'px-4 py-2 text-sm font-medium rounded-md border border-red-700 bg-red-600 text-white hover:bg-red-700'
}

/**
 * Reusable confirm modal with a title, body, and two buttons whose visual
 * styles are independently controlled by primaryStyle / secondaryStyle.
 * Both props default to 'default' and share the same style token map so
 * either button can be rendered in the destructive red treatment.
 *
 * Used by:
 *   - RunList (Plan 04-02) — dirty-load confirm (primary destructive) and
 *     delete confirm (primary destructive).
 *   - EditWarningModal (Plan 04-04) — "Keep viewing" primary default,
 *     "Edit anyway" secondary destructive per D-12.
 */
export function ConfirmModal({
  open,
  title,
  body,
  primaryLabel,
  secondaryLabel,
  primaryStyle = 'default',
  secondaryStyle = 'default',
  onPrimary,
  onSecondary
}: ConfirmModalProps): JSX.Element | null {
  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-lg border border-[var(--color-border)] shadow-lg w-full max-w-md mx-4">
        <div className="px-6 py-4 border-b border-[var(--color-border)]">
          <h3 className="text-lg font-semibold text-[var(--color-foreground)]">{title}</h3>
        </div>
        <div className="px-6 py-4">
          <p className="text-sm text-[var(--color-foreground)]">{body}</p>
        </div>
        <div className="flex justify-end gap-2 px-6 py-4 border-t border-[var(--color-border)]">
          <button onClick={onSecondary} className={STYLE_MAP[secondaryStyle]}>
            {secondaryLabel}
          </button>
          <button onClick={onPrimary} className={STYLE_MAP[primaryStyle]}>
            {primaryLabel}
          </button>
        </div>
      </div>
    </div>
  )
}
