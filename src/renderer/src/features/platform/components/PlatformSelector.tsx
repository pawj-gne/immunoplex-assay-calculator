import { usePlatforms } from '../hooks/usePlatforms'
import { PlatformCard } from './PlatformCard'

export function PlatformSelector() {
  const { platforms, selectedPlatformId, selectedPlatform, isLoading, error, selectPlatform } =
    usePlatforms()

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[var(--color-primary)]"></div>
        <span className="ml-3 text-[var(--color-muted)]">Loading platforms...</span>
      </div>
    )
  }

  if (error) {
    return (
      <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
        <p className="text-red-700">Failed to load platforms: {error}</p>
      </div>
    )
  }

  if (platforms.length === 0) {
    return (
      <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
        <p className="text-yellow-700">No platforms configured. Please contact administrator.</p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Platform selection grid */}
      <div>
        <h2 className="text-lg font-medium mb-4">Select Platform</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {platforms.map((platform) => (
            <PlatformCard
              key={platform.id}
              platform={platform}
              isSelected={platform.id === selectedPlatformId}
              onSelect={selectPlatform}
            />
          ))}
        </div>
      </div>

      {/* Selected platform summary */}
      {selectedPlatform && (
        <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
          <h3 className="font-medium text-green-800 mb-2">
            Platform Selected: {selectedPlatform.name}
          </h3>
        </div>
      )}
    </div>
  )
}
