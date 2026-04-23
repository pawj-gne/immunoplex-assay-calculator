import { useEffect, useState } from 'react'
import type { Operator } from '../../../../shared/types/operator'
import { useOperatorsStore } from '../../stores/operatorsStore'

interface OperatorEditModalProps {
  open: boolean
  mode: 'add' | 'edit'
  initialName?: string
  operatorId?: string
  onClose: () => void
  onSuccess?: (op: Operator) => void
}

export function OperatorEditModal({
  open,
  mode,
  initialName = '',
  operatorId,
  onClose,
  onSuccess
}: OperatorEditModalProps): JSX.Element | null {
  const [name, setName] = useState(initialName)
  const [submitting, setSubmitting] = useState(false)
  const error = useOperatorsStore((s) => s.error)
  const createOperator = useOperatorsStore((s) => s.createOperator)
  const renameOperator = useOperatorsStore((s) => s.renameOperator)

  // Reset form state when the modal re-opens or inputs change.
  useEffect(() => {
    if (open) {
      setName(initialName)
      setSubmitting(false)
    }
  }, [open, initialName, mode, operatorId])

  if (!open) return null

  const trimmed = name.trim()
  const isAdd = mode === 'add'
  const isEdit = mode === 'edit'
  // Title branches on mode: 'Add operator' for add, 'Rename operator' for edit.
  const title = isAdd
    ? 'Add operator'
    : 'Rename operator'
  const saveDisabled =
    submitting || trimmed === '' || (isEdit && trimmed === initialName.trim())

  async function handleSave(): Promise<void> {
    if (saveDisabled) return
    setSubmitting(true)
    try {
      let op: Operator | null = null
      if (isAdd) {
        op = await createOperator(trimmed)
      } else if (isEdit && operatorId) {
        op = await renameOperator(operatorId, trimmed)
      }
      // After the store action resolves, read latest error from the store.
      const latestError = useOperatorsStore.getState().error
      if (op && !latestError) {
        onSuccess?.(op)
        onClose()
      }
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-lg border border-[var(--color-border)] shadow-lg w-full max-w-md mx-4">
        <div className="flex items-center justify-between px-6 py-4 border-b border-[var(--color-border)]">
          <h3 className="text-lg font-semibold text-[var(--color-foreground)]">{title}</h3>
          <button
            onClick={onClose}
            className="text-[var(--color-muted)] hover:text-[var(--color-foreground)]"
          >
            X
          </button>
        </div>

        <div className="px-6 py-4 space-y-4">
          {error && (
            <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded px-3 py-2">
              {error}
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-[var(--color-foreground)] mb-1">
              Name
            </label>
            <input
              type="text"
              maxLength={100}
              autoFocus
              value={name}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  void handleSave()
                }
              }}
              className="w-full px-3 py-2 border border-[var(--color-border)] rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]"
            />
          </div>
        </div>

        <div className="flex justify-end gap-2 px-6 py-4 border-t border-[var(--color-border)]">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium rounded-md border border-[var(--color-border)] bg-white text-[var(--color-foreground)] hover:bg-gray-50"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={saveDisabled}
            className="px-4 py-2 text-sm font-medium rounded-md bg-[var(--color-primary)] text-white hover:opacity-90 disabled:opacity-40"
          >
            {submitting ? 'Saving...' : 'Save'}
          </button>
        </div>
      </div>
    </div>
  )
}
