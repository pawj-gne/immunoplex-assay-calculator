import { create } from 'zustand'
import type { RunRecord } from '../../../shared/types/run'
import { usePlatformStore } from './platformStore'
import { useSelectionStore } from './selectionStore'
import { useCalculatorStore, registerRunStoreResetHook } from './calculatorStore'
import { usePlateStore } from './plateStore'
import { buildRunSnapshot, type MetadataFields } from '../features/run/hooks/useRunSnapshot'
import { computeCleanSnapshot } from '../features/run/hooks/useDirtyTracking'

interface RunState {
  // State
  runs: RunRecord[]
  currentRunId: string | null
  isLoading: boolean
  saveStatus: 'idle' | 'saving' | 'success' | 'error'
  error: string | null
  lastCleanSnapshot: string | null

  // Actions
  fetchRuns: () => Promise<void>
  saveCurrentRun: (metadata: MetadataFields) => Promise<RunRecord | null>
  loadRun: (id: string) => Promise<void>
  deleteRun: (id: string) => Promise<void>
  clearCurrentRun: () => void
  markClean: (metadata: MetadataFields) => void
  isDirtyNow: (metadata: MetadataFields) => boolean
}

/**
 * Orchestrator store for run save/load/update/delete across the 4 upstream
 * stores (platform / selection / calculator / plate). Does NOT duplicate
 * any of their state — reads via .getState() on save, writes via their
 * action methods on load. Owns currentRunId + lastCleanSnapshot dirty
 * tracking per D-11 / D-13 / D-22 / D-24.
 */
export const useRunStore = create<RunState>((set, get) => ({
  runs: [],
  currentRunId: null,
  isLoading: false,
  saveStatus: 'idle',
  error: null,
  lastCleanSnapshot: null,

  fetchRuns: async () => {
    set({ isLoading: true, error: null })
    try {
      const runs = await window.electronAPI.run.getAll()
      set({ runs, isLoading: false })
    } catch (e) {
      set({ isLoading: false, error: (e as Error).message })
    }
  },

  saveCurrentRun: async (metadata) => {
    set({ saveStatus: 'saving', error: null })
    const payload = buildRunSnapshot(metadata)
    if ('error' in payload) {
      set({ saveStatus: 'error', error: payload.error })
      return null
    }
    try {
      const { currentRunId } = get()
      // D-11/D-13: if a run is already loaded, UPDATE it; else INSERT a new one.
      // prettier-ignore
      const saved = currentRunId ? await window.electronAPI.run.update(currentRunId, payload) : await window.electronAPI.run.create(payload)
      if (!saved) {
        set({ saveStatus: 'error', error: 'Save returned null' })
        return null
      }
      // Refresh the list + lock in the new clean baseline.
      await get().fetchRuns()
      // computeCleanSnapshot reads the 4 delegate stores (calculator/plate/
      // platform/selection) — NOT runs — so its result is not affected by
      // fetchRuns above. Ordering is safe; the await is just to keep the
      // list fresh before the user sees it.
      set({
        currentRunId: saved.id,
        saveStatus: 'success',
        lastCleanSnapshot: computeCleanSnapshot(metadata)
      })
      return saved
    } catch (e) {
      set({ saveStatus: 'error', error: (e as Error).message })
      return null
    }
  },

  loadRun: async (id) => {
    set({ isLoading: true, error: null })
    try {
      const run = await window.electronAPI.run.getById(id)
      if (!run) throw new Error('Run not found')

      // D-24 rehydration order. Each step must complete before the next
      // because downstream steps depend on the data loaded by upstream
      // steps (species depend on platform; panels depend on species;
      // plate layout depends on sampleCount having auto-filled first).
      const platform = usePlatformStore.getState()
      const selection = useSelectionStore.getState()
      const calculator = useCalculatorStore.getState()
      const plate = usePlateStore.getState()

      // 1. Platform
      platform.selectPlatform(run.platformId)

      // 2. Species load + select
      await selection.loadSpecies(run.platformId)
      useSelectionStore.getState().selectSpecies(run.speciesId)

      // 3. Panels + analytes load
      await useSelectionStore.getState().loadPanelsAndAnalytes(run.platformId, run.speciesId)

      // 4. Panel select (if any)
      if (run.panelId) {
        await useSelectionStore.getState().selectPanel(run.panelId)
      }

      // 5. Toggle each saved single analyte. toggleSingleAnalyte no-ops
      //    for IDs already in the selected panel per selectionStore logic.
      const latestSelection = useSelectionStore.getState()
      for (const analyteId of run.singleAnalyteIds) {
        latestSelection.toggleSingleAnalyte(analyteId)
      }

      // 6. Calculator — replicateMode FIRST, sampleCount SECOND. Both
      //    cascade into plateStore.autoFill which generates a default
      //    layout; that default gets overwritten in step 7.
      calculator.setReplicateMode(run.replicateMode)
      calculator.setSampleCount(run.sampleCount)
      // SMK3-16 (snapshot-frozen contract): restore volumePerWell BEFORE
      // setNumberOfSetups so any getOutputs() between the two — or after
      // a setNumberOfSetups validation failure — uses the run's persisted
      // per-well volume, not the 25 µL DEFAULT_VOLUME_PER_WELL fall-back.
      // Closes WR-01 from 12-VERIFICATION.md gap #1 (truth #11 partial:
      // PRD worked example uses 50 µL/well; without this line, reload
      // silently rewrites to 25 µL).
      calculator.setVolumePerWell(run.volumePerWell)
      // SMK3-05/16: reapply numberOfSetups so getOutputs() recomputes the
      // same dead volume the run was saved with. Pre-Smoke-3 runs lack
      // this field; default to 1 (equivalent to v1.0 single-setup behavior).
      calculator.setNumberOfSetups(run.numberOfSetups ?? 1)

      // 7. Plate layout — AFTER setSampleCount so the auto-fill cascade
      //    does not clobber the restored per-plate layout (D-24). This
      //    is the last mutation in the rehydration sequence.
      plate.loadPlates(run.plates)

      // Note: lastCleanSnapshot is intentionally NOT set here. The
      // Document & Save page's effects repopulate the form from the
      // loaded RunRecord and then call markClean(metadata) after the
      // form has baselined. Until that happens, isDirtyNow returns
      // true (because currentRunId !== null and lastCleanSnapshot ===
      // null) — this prevents a fast operator from clicking "Load
      // another run" in the gap between currentRunId being set and
      // the form effect completing.
      set({
        currentRunId: run.id,
        isLoading: false
      })
    } catch (e) {
      set({ isLoading: false, error: (e as Error).message })
    }
  },

  deleteRun: async (id) => {
    try {
      await window.electronAPI.run.delete(id)
      await get().fetchRuns()
      // If the currently-loaded run was the one deleted, clear the loaded
      // pointer + baseline so the form behaves like a fresh run.
      if (get().currentRunId === id) {
        set({ currentRunId: null, lastCleanSnapshot: null })
      }
    } catch (e) {
      set({ error: (e as Error).message })
    }
  },

  clearCurrentRun: () => {
    set({ currentRunId: null, lastCleanSnapshot: null, saveStatus: 'idle' })
  },

  markClean: (metadata) => {
    set({ lastCleanSnapshot: computeCleanSnapshot(metadata) })
  },

  isDirtyNow: (metadata) => {
    const { lastCleanSnapshot, currentRunId } = get()
    // Loaded-but-not-yet-baselined runs count as dirty — err toward the
    // confirm modal if a fast operator clicks Load before the baseline
    // effect fires.
    if (lastCleanSnapshot === null) return currentRunId !== null
    return computeCleanSnapshot(metadata) !== lastCleanSnapshot
  }
}))

// Wire runStore into the calculator Reset cascade without creating an
// import cycle. calculatorStore.reset() calls the registered hook; we
// register it here once at module load so the first time anything pulls
// runStore into the graph (e.g., the first render of RunList), the hook
// is primed. Safe even if Reset fires before the hook runs — calculator-
// Store guards against null.
registerRunStoreResetHook(() => {
  useRunStore.getState().clearCurrentRun()
})
