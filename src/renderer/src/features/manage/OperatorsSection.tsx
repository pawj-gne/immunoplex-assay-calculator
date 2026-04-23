import { useEffect, useState } from 'react'
import type { Operator } from '../../../../shared/types/operator'
import { useOperatorsStore } from '../../stores/operatorsStore'
import { OperatorEditModal } from './OperatorEditModal'

type ModalState =
  | { mode: 'closed' }
  | { mode: 'add' }
  | { mode: 'edit'; operator: Operator }

export function OperatorsSection(): JSX.Element {
  const operators = useOperatorsStore((s) => s.operators)
  const isLoading = useOperatorsStore((s) => s.isLoading)
  const error = useOperatorsStore((s) => s.error)
  const includeInactive = useOperatorsStore((s) => s.includeInactive)
  const loadOperators = useOperatorsStore((s) => s.loadOperators)
  const setOperatorActive = useOperatorsStore((s) => s.setOperatorActive)
  const softDeleteOperator = useOperatorsStore((s) => s.softDeleteOperator)

  const [modal, setModal] = useState<ModalState>({ mode: 'closed' })
  const [confirmHide, setConfirmHide] = useState<Operator | null>(null)
  const [showHidden, setShowHidden] = useState<boolean>(includeInactive)

  // Re-load whenever the local toggle changes. This also triggers an initial
  // load on mount (mirrors PanelList's fetchPanels pattern).
  useEffect(() => {
    void loadOperators({ includeInactive: showHidden })
  }, [showHidden, loadOperators])

  // Keep the visible sort stable: active-first alphabetical, then hidden alphabetical.
  const sorted = [...operators].sort((a, b) => {
    if (a.active !== b.active) return a.active ? -1 : 1
    return a.name.localeCompare(b.name)
  })

  async function handleHideConfirm(): Promise<void> {
    if (!confirmHide) return
    await softDeleteOperator(confirmHide.id)
    setConfirmHide(null)
  }

  async function handleUnhide(op: Operator): Promise<void> {
    await setOperatorActive(op.id, true)
  }

  return (
    <section className="space-y-3">
      <div className="flex items-center justify-between gap-4">
        <h2 className="text-base font-semibold text-[var(--color-foreground)]">Operators</h2>
        <div className="flex items-center gap-4">
          <label className="flex items-center gap-2 text-sm text-[var(--color-foreground)]">
            <input
              type="checkbox"
              checked={showHidden}
              onChange={(e) => setShowHidden(e.target.checked)}
            />
            Show hidden
          </label>
          <button
            onClick={() => setModal({ mode: 'add' })}
            className="px-3 py-1.5 text-sm font-medium rounded-md bg-[var(--color-primary)] text-white hover:opacity-90"
          >
            Add operator
          </button>
        </div>
      </div>

      {error && (
        <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded px-3 py-2">
          {error}
        </div>
      )}

      {isLoading ? (
        <p className="text-sm text-[var(--color-muted)]">Loading operators...</p>
      ) : sorted.length === 0 ? (
        <p className="text-sm text-[var(--color-muted)]">No operators.</p>
      ) : (
        <ul className="space-y-2">
          {sorted.map((op) => (
            <li
              key={op.id}
              className="flex items-center justify-between px-3 py-2 border border-[var(--color-border)] rounded-md bg-white"
            >
              <span
                className={
                  op.active
                    ? 'text-sm text-[var(--color-foreground)]'
                    : 'text-sm text-[var(--color-muted)] italic'
                }
              >
                {op.name}
                {!op.active && <span className="ml-2 text-xs">(hidden)</span>}
              </span>
              <div className="flex gap-2">
                <button
                  onClick={() => setModal({ mode: 'edit', operator: op })}
                  className="px-3 py-1 text-xs font-medium rounded border border-[var(--color-border)] text-[var(--color-foreground)] hover:bg-gray-50"
                >
                  Rename
                </button>
                {op.active ? (
                  <button
                    onClick={() => setConfirmHide(op)}
                    className="px-3 py-1 text-xs font-medium rounded border border-red-200 text-red-600 hover:bg-red-50"
                  >
                    Hide
                  </button>
                ) : (
                  <button
                    onClick={() => handleUnhide(op)}
                    className="px-3 py-1 text-xs font-medium rounded border border-[var(--color-border)] text-[var(--color-foreground)] hover:bg-gray-50"
                  >
                    Unhide
                  </button>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}

      {/* Add / Rename modal */}
      <OperatorEditModal
        open={modal.mode === 'add'}
        mode="add"
        onClose={() => setModal({ mode: 'closed' })}
      />
      <OperatorEditModal
        open={modal.mode === 'edit'}
        mode="edit"
        operatorId={modal.mode === 'edit' ? modal.operator.id : undefined}
        initialName={modal.mode === 'edit' ? modal.operator.name : ''}
        onClose={() => setModal({ mode: 'closed' })}
      />

      {/* Hide-confirm overlay */}
      {confirmHide && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-lg border border-[var(--color-border)] shadow-lg w-full max-w-md mx-4">
            <div className="px-6 py-4 border-b border-[var(--color-border)]">
              <h3 className="text-lg font-semibold text-[var(--color-foreground)]">
                Hide operator
              </h3>
            </div>
            <div className="px-6 py-4">
              {/* eslint-disable-next-line prettier/prettier */}
              <p className="text-sm text-[var(--color-foreground)]">
                {`Hide operator ${confirmHide.name}? Runs that already reference this operator will keep showing their name, but it will no longer appear in the run form dropdown.`}
              </p>
            </div>
            <div className="flex justify-end gap-2 px-6 py-4 border-t border-[var(--color-border)]">
              <button
                onClick={() => setConfirmHide(null)}
                className="px-4 py-2 text-sm font-medium rounded-md border border-[var(--color-border)] bg-white text-[var(--color-foreground)] hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={handleHideConfirm}
                className="px-4 py-2 text-sm font-medium rounded-md bg-red-600 text-white hover:opacity-90"
              >
                Hide
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  )
}
