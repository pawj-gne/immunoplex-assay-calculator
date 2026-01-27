import { useSpecies } from '../hooks/useSpecies'

export function SpeciesSelector() {
  const { species, selectedSpeciesId, selectedSpecies, isLoading, error, selectSpecies } =
    useSpecies()

  if (isLoading) {
    return (
      <div className="flex items-center p-4">
        <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-[var(--color-primary)]"></div>
        <span className="ml-2 text-sm text-[var(--color-muted)]">Loading species...</span>
      </div>
    )
  }

  if (error) {
    return (
      <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
        <p className="text-sm text-red-700">Failed to load species: {error}</p>
      </div>
    )
  }

  if (species.length === 0) {
    return (
      <div className="p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
        <p className="text-sm text-yellow-700">No species available for this platform.</p>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      <h3 className="text-sm font-medium text-[var(--color-foreground)]">Select Species</h3>

      <div className="flex flex-wrap gap-2">
        {species.map((s) => (
          <button
            key={s.id}
            type="button"
            onClick={() => selectSpecies(s.id)}
            className={`
              px-4 py-2 rounded-lg border-2 text-sm font-medium transition-all duration-150
              hover:border-[var(--color-primary)] hover:shadow-sm
              focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)] focus:ring-offset-2
              ${
                s.id === selectedSpeciesId
                  ? 'border-[var(--color-primary)] bg-blue-50 text-[var(--color-primary)]'
                  : 'border-[var(--color-border)] bg-white text-[var(--color-foreground)]'
              }
            `}
          >
            {s.name}
          </button>
        ))}
      </div>

      {selectedSpecies && (
        <p className="text-sm text-green-600">
          Species selected: <strong>{selectedSpecies.name}</strong>
        </p>
      )}
    </div>
  )
}
