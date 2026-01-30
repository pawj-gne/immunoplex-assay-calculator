import { useState } from 'react'
import { PlatformSelector } from './features/platform/components/PlatformSelector'
import { SpeciesSelector } from './features/selection/components/SpeciesSelector'
import { AnalyteSelectionPanel } from './features/selection/components/AnalyteSelectionPanel'
import { CalculatorPanel } from './features/calculator/components/CalculatorPanel'
import { PlatePanel } from './features/plate/components/PlatePanel'
import { ImportButton } from './features/import/ImportButton'
import { ManagePage } from './features/manage/ManagePage'
import { usePlatforms } from './features/platform/hooks/usePlatforms'
import { useSpecies } from './features/selection/hooks/useSpecies'

type AppMode = 'calculator' | 'manage'

const PAGE_LABELS = ['Platform & Species', 'Analytes', 'Calculations']

function App(): JSX.Element {
  const [mode, setMode] = useState<AppMode>('calculator')
  const [currentPage, setCurrentPage] = useState(0)
  const { selectedPlatform } = usePlatforms()
  const { selectedSpecies } = useSpecies()

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
              {/* Page 0: Platform & Species */}
              {currentPage === 0 && (
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
              )}

              {/* Page 1: Analytes */}
              {currentPage === 1 && (
                <div className="bg-white rounded-lg border border-[var(--color-border)] p-6">
                  <AnalyteSelectionPanel />
                </div>
              )}

              {/* Page 2: Calculations */}
              {currentPage === 2 && (
                <>
                  <div className="bg-white rounded-lg border border-[var(--color-border)] p-6">
                    <CalculatorPanel />
                  </div>
                  <div className="bg-white rounded-lg border border-[var(--color-border)] p-6">
                    <div className="flex items-center justify-between mb-4">
                      <h2 className="text-lg font-semibold text-[var(--color-foreground)]">
                        Plate Preview
                      </h2>
                    </div>
                    <PlatePanel />
                  </div>
                </>
              )}

              {/* Navigation */}
              <div className="flex items-center justify-between pt-2">
                <div>
                  {currentPage > 0 && (
                    <button
                      onClick={() => setCurrentPage((p) => p - 1)}
                      className="px-4 py-2 text-sm font-medium rounded-md border border-[var(--color-border)] bg-white text-[var(--color-foreground)] hover:bg-gray-50"
                    >
                      ← Previous
                    </button>
                  )}
                </div>

                <span className="text-sm text-[var(--color-muted)]">
                  Step {currentPage + 1} of 3 — {PAGE_LABELS[currentPage]}
                </span>

                <div>
                  {currentPage < 2 && (
                    <button
                      onClick={() => setCurrentPage((p) => p + 1)}
                      disabled={!canGoNext}
                      className="px-4 py-2 text-sm font-medium rounded-md bg-[var(--color-primary)] text-white hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                      Next →
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
          Immunoplex Assay Calculator v0.4.2
        </p>
      </footer>
    </div>
  )
}

export default App
