import { PlatformSelector } from './features/platform/components/PlatformSelector'
import { CalculatorPanel } from './features/calculator/components/CalculatorPanel'
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
          Immunoplex Assay Calculator v0.1.0 | Phase 2: Calculator Core
        </p>
      </footer>
    </div>
  )
}

export default App
