function App(): JSX.Element {
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
        <div className="max-w-4xl mx-auto">
          <div className="bg-white rounded-lg border border-[var(--color-border)] p-6">
            <h2 className="text-lg font-medium mb-4">Welcome</h2>
            <p className="text-[var(--color-muted)]">
              Select a platform to begin calculating reagent volumes.
            </p>
            {/* Platform selector will be added in Plan 03 */}
            <div className="mt-6 p-4 bg-[var(--color-background)] rounded border border-dashed border-[var(--color-border)]">
              <p className="text-sm text-[var(--color-muted)]">
                Platform selection coming soon...
              </p>
            </div>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-[var(--color-border)] px-6 py-3">
        <p className="text-sm text-[var(--color-muted)]">
          Phase 1: Foundation
        </p>
      </footer>
    </div>
  )
}

export default App
