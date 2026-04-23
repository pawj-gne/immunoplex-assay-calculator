import { useState, useEffect, useRef } from 'react'
import type { Platform } from '../../shared/types/platform'
import { PlatformSelector } from './features/platform/components/PlatformSelector'
import { SpeciesSelector } from './features/selection/components/SpeciesSelector'
import { AnalyteSelectionPanel } from './features/selection/components/AnalyteSelectionPanel'
import { CalculatorPanel } from './features/calculator/components/CalculatorPanel'
import { DocumentAndSavePage, FinalizedRunView, EditWarningModal } from './features/run'

import { ImportButton } from './features/import/ImportButton'
import { ManagePage } from './features/manage/ManagePage'
import { usePlatforms } from './features/platform/hooks/usePlatforms'
import { useSpecies } from './features/selection/hooks/useSpecies'
import { useOperatorsStore } from './stores/operatorsStore'
import { useRunStore } from './stores/runStore'

type AppMode = 'calculator' | 'manage'

// Wizard page labels. Plan 04-02 extended from 3 to 4 pages (added
// 'Document & Save' at index 3). Plan 04-04 pushes this to 5 by appending
// the Finalized Run View page at index 4. Step chrome and Next-button
// gating use PAGE_LABELS.length so both plans compose cleanly.
const PAGE_LABELS = [
  'Platform & Species',
  'Analytes',
  'Calculations',
  'Document & Save',
  'Finalized Run View'
]

/**
 * Render the content for a given wizard page index.
 */
function renderPage(
  pageIndex: number,
  selectedPlatform: Platform | null,
  onAfterSave: () => void,
  onStartNewRun: () => void
): JSX.Element {
  switch (pageIndex) {
    case 0:
      return (
        <>
          <div className="bg-white rounded-lg border border-[var(--color-border)] p-6">
            <PlatformSelector />
          </div>
          {selectedPlatform && (
            <div className="bg-white rounded-lg border border-[var(--color-border)] p-6">
              <SpeciesSelector />
            </div>
          )}
        </>
      )
    case 1:
      return (
        <div className="bg-white rounded-lg border border-[var(--color-border)] p-6">
          <AnalyteSelectionPanel />
        </div>
      )
    case 2:
      return (
        <div className="bg-white rounded-lg border border-[var(--color-border)] p-6">
          <CalculatorPanel />
        </div>
      )
    case 3:
      return (
        <div className="bg-white rounded-lg border border-[var(--color-border)] p-6">
          <DocumentAndSavePage onAfterSave={onAfterSave} />
        </div>
      )
    case 4:
      return (
        <div className="bg-white rounded-lg border border-[var(--color-border)] p-6">
          <FinalizedRunView onStartNewRun={onStartNewRun} />
        </div>
      )
    default:
      return <></>
  }
}

/**
 * Get the animation class for entering/exiting pages during transitions.
 */
function getEnterClass(direction: 'forward' | 'backward'): string {
  return direction === 'forward'
    ? 'animate-in slide-in-from-right fade-in duration-300'
    : 'animate-in slide-in-from-left fade-in duration-300'
}

function getExitClass(direction: 'forward' | 'backward'): string {
  return direction === 'forward'
    ? 'animate-out slide-out-to-left fade-out duration-300'
    : 'animate-out slide-out-to-right fade-out duration-300'
}

function App(): JSX.Element {
  const [mode, setMode] = useState<AppMode>('calculator')
  const [currentPage, setCurrentPage] = useState(0)
  // D-12: wizard Back button from step 5 (with a saved run loaded) opens
  // this modal instead of decrementing currentPage. Top-level mode
  // changes (Calculator <-> Manage) do NOT flip this flag.
  const [editWarningOpen, setEditWarningOpen] = useState(false)
  const { selectedPlatform } = usePlatforms()
  const { selectedSpecies } = useSpecies()

  // Prime the operators store with ALL operators (includeInactive:true) at mount
  // so FinalizedRunHeader (Plan 04-04) can resolve names for hidden operators on
  // historical runs. OperatorsSection's local 'Show hidden' toggle calls
  // loadOperators again and overwrites the list as needed.
  useEffect(() => {
    void useOperatorsStore.getState().loadOperators({ includeInactive: true })
  }, [])

  // Transition state
  const [displayPage, setDisplayPage] = useState(currentPage)
  const [isTransitioning, setIsTransitioning] = useState(false)
  const [direction, setDirection] = useState<'forward' | 'backward'>('forward')
  const prevPage = useRef(currentPage)

  useEffect(() => {
    if (currentPage === prevPage.current) return

    setDirection(currentPage > prevPage.current ? 'forward' : 'backward')
    setIsTransitioning(true)

    const timer = setTimeout(() => {
      setDisplayPage(currentPage)
      setIsTransitioning(false)
    }, 300)

    prevPage.current = currentPage
    return () => clearTimeout(timer)
  }, [currentPage])

  const canGoNext = currentPage === 0 ? !!(selectedPlatform && selectedSpecies) : true

  // D-08: DocumentAndSavePage calls this after a successful save so the
  // wizard auto-navigates to step 5 (Finalized Run View).
  const handleAfterSave = (): void => setCurrentPage(4)

  // D-10: Start New Run on step 5 resets all stores (done inside
  // FinalizedRunView) and returns the wizard to step 1.
  const handleStartNewRun = (): void => setCurrentPage(0)

  // D-12: wizard Back button interception. From step 5, if a run is
  // currently loaded (currentRunId !== null), open the EditWarningModal
  // instead of decrementing. Every other back step behaves as before.
  const handleBack = (): void => {
    if (currentPage === 4 && useRunStore.getState().currentRunId !== null) {
      setEditWarningOpen(true)
    } else {
      setCurrentPage((p) => p - 1)
    }
  }

  return (
    <div className="min-h-screen flex flex-col">
      {/* Header */}
      <header className="bg-white border-b border-[var(--color-border)] px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <h1 className="text-xl font-semibold text-[var(--color-foreground)]">
            Immunoplex Assay Calculator
          </h1>
          <div className="flex rounded-md border border-[var(--color-border)] overflow-hidden">
            <button
              onClick={() => setMode('calculator')}
              className={`px-3 py-1 text-xs font-medium ${
                mode === 'calculator'
                  ? 'bg-[var(--color-primary)] text-white'
                  : 'bg-white text-[var(--color-muted)] hover:bg-gray-50'
              }`}
            >
              Calculator
            </button>
            <button
              onClick={() => setMode('manage')}
              className={`px-3 py-1 text-xs font-medium ${
                mode === 'manage'
                  ? 'bg-[var(--color-primary)] text-white'
                  : 'bg-white text-[var(--color-muted)] hover:bg-gray-50'
              }`}
            >
              Manage Data
            </button>
          </div>
        </div>
        <ImportButton />
      </header>

      {/* Main content area */}
      <main className="flex-1 p-6">
        <div className="max-w-4xl mx-auto space-y-6">
          {mode === 'manage' ? (
            <div className="bg-white rounded-lg border border-[var(--color-border)] p-6">
              <ManagePage />
            </div>
          ) : (
            <>
              {/* Page transition container */}
              <div className="relative overflow-hidden">
                {/* Exiting page (old page sliding out) */}
                {isTransitioning && (
                  <div className={`absolute inset-0 ${getExitClass(direction)}`}>
                    <div className="space-y-6">
                      {renderPage(
                        displayPage,
                        selectedPlatform,
                        handleAfterSave,
                        handleStartNewRun
                      )}
                    </div>
                  </div>
                )}

                {/* Entering page (new page sliding in) or current page (no transition) */}
                <div className={isTransitioning ? getEnterClass(direction) : ''}>
                  <div className="space-y-6">
                    {renderPage(
                      isTransitioning ? currentPage : displayPage,
                      selectedPlatform,
                      handleAfterSave,
                      handleStartNewRun
                    )}
                  </div>
                </div>
              </div>

              {/* Navigation - outside transition container */}
              <div className="flex items-center justify-between pt-2">
                <div>
                  {currentPage > 0 && (
                    <button
                      onClick={handleBack}
                      className="px-4 py-2 text-sm font-medium rounded-md border border-[var(--color-border)] bg-white text-[var(--color-foreground)] hover:bg-gray-50"
                    >
                      &larr; Previous
                    </button>
                  )}
                </div>

                <span className="text-sm text-[var(--color-muted)]">
                  Step {currentPage + 1} of {PAGE_LABELS.length} &mdash;{' '}
                  {PAGE_LABELS[currentPage]}
                </span>

                <div>
                  {currentPage < PAGE_LABELS.length - 1 && (
                    <button
                      onClick={() => setCurrentPage((p) => p + 1)}
                      disabled={!canGoNext}
                      className="px-4 py-2 text-sm font-medium rounded-md bg-[var(--color-primary)] text-white hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                      Next &rarr;
                    </button>
                  )}
                </div>
              </div>
            </>
          )}
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-[var(--color-border)] px-6 py-3">
        <p className="text-sm text-[var(--color-muted)]">
          Immunoplex Assay Calculator v0.5.0
        </p>
      </footer>

      {/* D-12: fired only from the wizard Back button on step 5 when a
          run is currently loaded. "Keep viewing" is primary (stays on
          step 5); "Edit anyway" is secondary (destructive) and proceeds
          to step 4. Top-level mode toggle does NOT open this modal. */}
      <EditWarningModal
        open={editWarningOpen}
        onKeepViewing={() => setEditWarningOpen(false)}
        onEditAnyway={() => {
          setEditWarningOpen(false)
          setCurrentPage(3)
        }}
      />
    </div>
  )
}

export default App
