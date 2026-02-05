import { useState, useEffect, useRef } from 'react'
import type { Platform } from '../../shared/types/platform'
import { PlatformSelector } from './features/platform/components/PlatformSelector'
import { SpeciesSelector } from './features/selection/components/SpeciesSelector'
import { AnalyteSelectionPanel } from './features/selection/components/AnalyteSelectionPanel'
import { CalculatorPanel } from './features/calculator/components/CalculatorPanel'

import { ImportButton } from './features/import/ImportButton'
import { ManagePage } from './features/manage/ManagePage'
import { usePlatforms } from './features/platform/hooks/usePlatforms'
import { useSpecies } from './features/selection/hooks/useSpecies'

type AppMode = 'calculator' | 'manage'

const PAGE_LABELS = ['Platform & Species', 'Analytes', 'Calculations']

/**
 * Render the content for a given wizard page index.
 */
function renderPage(
  pageIndex: number,
  selectedPlatform: Platform | null
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
  const { selectedPlatform } = usePlatforms()
  const { selectedSpecies } = useSpecies()

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
                      {renderPage(displayPage, selectedPlatform)}
                    </div>
                  </div>
                )}

                {/* Entering page (new page sliding in) or current page (no transition) */}
                <div className={isTransitioning ? getEnterClass(direction) : ''}>
                  <div className="space-y-6">
                    {renderPage(
                      isTransitioning ? currentPage : displayPage,
                      selectedPlatform
                    )}
                  </div>
                </div>
              </div>

              {/* Navigation - outside transition container */}
              <div className="flex items-center justify-between pt-2">
                <div>
                  {currentPage > 0 && (
                    <button
                      onClick={() => setCurrentPage((p) => p - 1)}
                      className="px-4 py-2 text-sm font-medium rounded-md border border-[var(--color-border)] bg-white text-[var(--color-foreground)] hover:bg-gray-50"
                    >
                      &larr; Previous
                    </button>
                  )}
                </div>

                <span className="text-sm text-[var(--color-muted)]">
                  Step {currentPage + 1} of 3 &mdash; {PAGE_LABELS[currentPage]}
                </span>

                <div>
                  {currentPage < 2 && (
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
    </div>
  )
}

export default App
