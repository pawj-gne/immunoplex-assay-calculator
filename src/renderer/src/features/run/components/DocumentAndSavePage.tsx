import { useEffect, useMemo, useState } from 'react'
import { useRunStore } from '../../../stores/runStore'
import { useRunSnapshot, type MetadataFields } from '../hooks/useRunSnapshot'
import { RunSourceCard } from './RunSourceCard'
import { RunMetadataForm, DEFAULT_METADATA } from './RunMetadataForm'
import { RunList } from './RunList'

interface DocumentAndSavePageProps {
  /**
   * Called after a successful save. The wizard uses this to auto-navigate
   * to step 5 (Finalized Run View) per D-08. Parent owns the navigation
   * side-effect so App.tsx stays authoritative over currentPage.
   */
  onAfterSave: () => void
}

/**
 * Map a loaded RunRecord's metadata-relevant fields into MetadataFields.
 * The non-metadata fields (platform/species/panel/sampleCount/...) are
 * rehydrated via runStore.loadRun into the upstream stores — only the
 * form fields need to land here.
 */
function runToMetadata(
  run: NonNullable<ReturnType<typeof findLoadedRun>>
): MetadataFields {
  return {
    requestNumber: run.requestNumber,
    requestOverrideAdHoc: run.requestOverrideAdHoc,
    userName: run.userName,
    operatorId: run.operatorId,
    runDate: run.runDate,
    sampleType: run.sampleType,
    dilutionFactor: run.dilutionFactor,
    hamilton: run.hamilton,
    runPlatePosition: run.runPlatePosition,
    standardPosition: run.standardPosition,
    troughPosition: run.troughPosition,
    comments: run.comments ?? ''
  }
}

function findLoadedRun(
  runs: ReturnType<typeof useRunStore.getState>['runs'],
  id: string | null
) {
  if (!id) return null
  return runs.find((r) => r.id === id) ?? null
}

/**
 * Wizard step 4 page per D-05. Top-to-bottom:
 *   1. Run Source card
 *   2. Metadata form
 *   3. Save button (disabled + helper text when canSave is false)
 *   4. Collapsible Past Runs (RunList)
 *
 * When currentRunId flips from null to a value (a run is loaded via
 * RunList), populate the form from the RunRecord and call markClean
 * with the populated metadata so the dirty baseline matches the
 * loaded state. Until markClean fires, isDirtyNow returns true so
 * a fast "Load another run" click falls into the confirm modal.
 */
export function DocumentAndSavePage({ onAfterSave }: DocumentAndSavePageProps): JSX.Element {
  const currentRunId = useRunStore((s) => s.currentRunId)
  const saveStatus = useRunStore((s) => s.saveStatus)
  const saveError = useRunStore((s) => s.error)
  const runs = useRunStore((s) => s.runs)

  const [metadata, setMetadata] = useState<MetadataFields>(DEFAULT_METADATA)
  const [pastRunsOpen, setPastRunsOpen] = useState<boolean>(false)

  // When a run is loaded (currentRunId set from null), repopulate the form
  // from the loaded RunRecord. The load triggers a fetchRuns in runStore
  // so `runs` will contain the hydrated record.
  const loadedRun = useMemo(() => findLoadedRun(runs, currentRunId), [runs, currentRunId])
  const loadedMetadata = useMemo<Partial<MetadataFields> | undefined>(
    () => (loadedRun ? runToMetadata(loadedRun) : undefined),
    [loadedRun]
  )

  // After the form has repopulated from a loaded run, baseline the dirty
  // tracker so subsequent edits register as dirty. Runs on the tick AFTER
  // metadata has been updated with the loaded values (keying on the
  // resolved RunRecord id closes the load-gap).
  useEffect(() => {
    if (loadedRun) {
      // Defer to next tick so the RunMetadataForm's internal effect has
      // merged initialValues into metadata by the time we baseline.
      const handle = setTimeout(() => {
        useRunStore.getState().markClean(metadata)
      }, 0)
      return () => clearTimeout(handle)
    }
    return undefined
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loadedRun?.id])

  const { canSave, reason } = useRunSnapshot(metadata)
  const isSaving = saveStatus === 'saving'

  async function handleSave(): Promise<void> {
    const saved = await useRunStore.getState().saveCurrentRun(metadata)
    if (saved) {
      // D-08: auto-navigate to step 5 (Finalized Run View) on successful save.
      // App.tsx wires onAfterSave to setCurrentPage(4) — the 0-indexed
      // wizard step for the post-save Finalized View (Plan 04-04).
      onAfterSave()
    }
  }

  return (
    <div className="space-y-6">
      <RunSourceCard />

      <RunMetadataForm
        value={metadata}
        onChange={setMetadata}
        initialValues={loadedMetadata}
      />

      <div className="space-y-2">
        <button
          onClick={handleSave}
          disabled={!canSave || isSaving}
          className="px-4 py-2 text-sm font-medium rounded-md bg-[var(--color-primary)] text-white hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {currentRunId ? 'Update run' : 'Save run'}
        </button>
        {!canSave && reason && <p className="text-sm text-gray-500">{reason}</p>}
        {saveStatus === 'error' && saveError && (
          <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded px-3 py-2">
            {saveError}
          </p>
        )}
      </div>

      <div className="rounded-lg border border-[var(--color-border)] bg-white">
        <button
          type="button"
          onClick={() => setPastRunsOpen((v) => !v)}
          className="w-full flex items-center justify-between px-4 py-3 text-sm font-semibold text-[var(--color-foreground)]"
        >
          <span>Past Runs</span>
          <span className="text-[var(--color-muted)]">{pastRunsOpen ? '▾' : '▸'}</span>
        </button>
        {pastRunsOpen && (
          <div className="px-4 pb-4 border-t border-[var(--color-border)]">
            <RunList currentMetadata={metadata} />
          </div>
        )}
      </div>
    </div>
  )
}

