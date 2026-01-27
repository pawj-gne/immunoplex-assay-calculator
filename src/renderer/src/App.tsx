import { PlatformSelector } from './features/platform/components/PlatformSelector'
import { CalculatorPanel } from './features/calculator/components/CalculatorPanel'
import { PlatePanel } from './features/plate/components/PlatePanel'
import { PrintButton } from './features/plate/components/PrintButton'
import { usePlatforms } from './features/platform/hooks/usePlatforms'

function App(): JSX.Element {
  const { selectedPlatform } = usePlatforms()

  return (
    <div className="min-h-screen flex flex-col">
      {/* Header */}
      <header className="bg-white border-b border-[var(--color-border)] px-6 py-4">
        <h1 className="text-xl font-semibold text-[var(--color-foreground)]">
          Immunoplex Assay Calculator
        </h1>
      </header>

      {/* Main content area */}
      <main className="flex-1 p-6">
        <div className="max-w-4xl mx-auto space-y-6">
          {/* Platform Selection */}
          <div className="bg-white rounded-lg border border-[var(--color-border)] p-6">
            <PlatformSelector />
          </div>

          {/* Calculator - only show if platform selected */}
          {selectedPlatform && (
            <div className="bg-white rounded-lg border border-[var(--color-border)] p-6">
              <CalculatorPanel />
            </div>
          )}

          {/* Plate Preview - only show if platform selected */}
          {selectedPlatform && (
            <div className="bg-white rounded-lg border border-[var(--color-border)] p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-semibold text-[var(--color-foreground)]">
                  Plate Preview
                </h2>
                <PrintButton />
              </div>
              <PlatePanel />
            </div>
          )}

          {!selectedPlatform && (
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-6 text-center">
              <p className="text-yellow-700">Select a platform above to begin calculations</p>
            </div>
          )}
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-[var(--color-border)] px-6 py-3">
        <p className="text-sm text-[var(--color-muted)]">
          Immunoplex Assay Calculator v0.1.0 | Phase 3: Plate Visualization
        </p>
      </footer>
    </div>
  )
}

export default App
