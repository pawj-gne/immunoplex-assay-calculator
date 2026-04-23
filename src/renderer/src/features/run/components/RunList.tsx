import { useEffect, useState } from 'react'
import type { RunRecord } from '../../../../../shared/types/run'
import { useRunStore } from '../../../stores/runStore'
import { useOperatorsStore } from '../../../stores/operatorsStore'
import { usePlatformStore } from '../../../stores/platformStore'
import { ConfirmModal } from './ConfirmModal'
import type { MetadataFields } from '../hooks/useRunSnapshot'

interface RunListProps {
  currentMetadata: MetadataFields
}

type ModalState =
  | { kind: 'none' }
  | { kind: 'dirty-load'; run: RunRecord }
  | { kind: 'delete'; run: RunRecord }

/**
 * Format a run's request number for display per CONTEXT.md §Specific Ideas.
 * Numbered runs render as "Request 09421" (padStart(5, '0')); ad-hoc runs
 * substitute "Ad-hoc run" wholesale. Used by row cells AND both modal bodies.
 */
function displayRequestNumber(run: RunRecord): string {
  if (run.requestOverrideAdHoc || run.requestNumber === null) {
    return 'Ad-hoc run'
  }
  return `Request ${String(run.requestNumber).padStart(5, '0')}`
}

export function RunList({ currentMetadata }: RunListProps): JSX.Element {
  const runs = useRunStore((s) => s.runs)
  const isLoading = useRunStore((s) => s.isLoading)
  const error = useRunStore((s) => s.error)
  const operators = useOperatorsStore((s) => s.operators)
  const platforms = usePlatformStore((s) => s.platforms)

  const [modal, setModal] = useState<ModalState>({ kind: 'none' })

  useEffect(() => {
    void useRunStore.getState().fetchRuns()
  }, [])

  function handleLoadClick(run: RunRecord): void {
    // D-14: if the form has unsaved changes, confirm before loading. If the
    // current state is clean OR is the loaded run's baseline, load silently.
    const isDirty = useRunStore.getState().isDirtyNow(currentMetadata)
    if (isDirty) {
      setModal({ kind: 'dirty-load', run })
    } else {
      void useRunStore.getState().loadRun(run.id)
    }
  }

  function handleDeleteClick(run: RunRecord): void {
    setModal({ kind: 'delete', run })
  }

  async function confirmLoad(): Promise<void> {
    if (modal.kind !== 'dirty-load') return
    await useRunStore.getState().loadRun(modal.run.id)
    setModal({ kind: 'none' })
  }

  async function confirmDelete(): Promise<void> {
    if (modal.kind !== 'delete') return
    await useRunStore.getState().deleteRun(modal.run.id)
    setModal({ kind: 'none' })
  }

  const operatorName = (id: string): string =>
    operators.find((o) => o.id === id)?.name ?? '—'

  const platformName = (id: string): string =>
    platforms.find((p) => p.id === id)?.name ?? '—'

  if (isLoading && runs.length === 0) {
    return <p className="text-sm text-[var(--color-muted)]">Loading saved runs...</p>
  }

  if (error) {
    return (
      <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded px-3 py-2">
        {error}
      </p>
    )
  }

  if (runs.length === 0) {
    return <p className="text-sm text-[var(--color-muted)]">No saved runs yet.</p>
  }

  return (
    <div className="space-y-2">
      {runs.map((run) => (
        <div
          key={run.id}
          className="flex items-center justify-between gap-3 px-3 py-2 border border-[var(--color-border)] rounded-md bg-white"
        >
          <div className="grid grid-cols-6 gap-3 flex-1 text-xs">
            <div>
              <div className="text-[var(--color-muted)]">Request #</div>
              <div className="text-[var(--color-foreground)] font-medium">
                {run.requestOverrideAdHoc || run.requestNumber === null
                  ? 'Ad-hoc'
                  : String(run.requestNumber).padStart(5, '0')}
              </div>
            </div>
            <div>
              <div className="text-[var(--color-muted)]">Date</div>
              <div className="text-[var(--color-foreground)]">{run.runDate}</div>
            </div>
            <div>
              <div className="text-[var(--color-muted)]">Operator</div>
              <div className="text-[var(--color-foreground)]">{operatorName(run.operatorId)}</div>
            </div>
            <div>
              <div className="text-[var(--color-muted)]">User</div>
              <div className="text-[var(--color-foreground)]">{run.userName}</div>
            </div>
            <div>
              <div className="text-[var(--color-muted)]">Sample Type</div>
              <div className="text-[var(--color-foreground)]">{run.sampleType}</div>
            </div>
            <div>
              <div className="text-[var(--color-muted)]">Platform</div>
              <div className="text-[var(--color-foreground)]">{platformName(run.platformId)}</div>
            </div>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => handleLoadClick(run)}
              className="px-3 py-1 text-xs font-medium rounded border border-[var(--color-border)] text-[var(--color-foreground)] hover:bg-gray-50"
            >
              Load
            </button>
            <button
              onClick={() => handleDeleteClick(run)}
              className="px-3 py-1 text-xs font-medium rounded border border-red-200 text-red-600 hover:bg-red-50"
            >
              Delete
            </button>
          </div>
        </div>
      ))}

      {/* Dirty-load confirm (D-14) */}
      <ConfirmModal
        open={modal.kind === 'dirty-load'}
        title="Unsaved changes"
        body={
          modal.kind === 'dirty-load'
            ? `You have unsaved changes. Discard and load ${displayRequestNumber(modal.run)}?`
            : ''
        }
        primaryLabel="Discard and load"
        secondaryLabel="Cancel"
        primaryStyle="destructive"
        onPrimary={confirmLoad}
        onSecondary={() => setModal({ kind: 'none' })}
      />

      {/* Delete confirm (D-15) */}
      <ConfirmModal
        open={modal.kind === 'delete'}
        title="Delete run"
        body={
          modal.kind === 'delete'
            ? `Delete saved run for ${displayRequestNumber(modal.run)}? This cannot be undone.`
            : ''
        }
        primaryLabel="Delete"
        secondaryLabel="Cancel"
        primaryStyle="destructive"
        onPrimary={confirmDelete}
        onSecondary={() => setModal({ kind: 'none' })}
      />
    </div>
  )
}
