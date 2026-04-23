import { useState, useEffect } from 'react'
import type { Platform } from '../../../../shared/types/platform'
import type { Species } from '../../../../shared/types/species'
import { AnalyteTable } from './AnalyteTable'
import { PanelList } from './PanelList'
import { OperatorsSection } from './OperatorsSection'

const api = (window as any).electronAPI

type Tab = 'analytes' | 'panels'

export function ManagePage(): JSX.Element {
  const [platforms, setPlatforms] = useState<Platform[]>([])
  const [species, setSpecies] = useState<Species[]>([])
  const [platformId, setPlatformId] = useState<string>('')
  const [speciesId, setSpeciesId] = useState<string>('')
  const [activeTab, setActiveTab] = useState<Tab>('analytes')

  useEffect(() => {
    api.platform.getAll().then(setPlatforms)
  }, [])

  useEffect(() => {
    setSpeciesId('')
    setSpecies([])
    if (platformId) {
      api.species.getByPlatformId(platformId).then(setSpecies)
    }
  }, [platformId])

  const filtersSelected = platformId && speciesId

  return (
    <div className="space-y-6">
      {/* Filters */}
      <div className="flex items-center gap-4">
        <label className="text-sm font-medium text-[var(--color-foreground)]">
          Platform
          <select
            value={platformId}
            onChange={(e) => setPlatformId(e.target.value)}
            className="ml-2 rounded-md border border-[var(--color-border)] px-3 py-1.5 text-sm bg-white"
          >
            <option value="">Select platform...</option>
            {platforms.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </label>
        <label className="text-sm font-medium text-[var(--color-foreground)]">
          Species
          <select
            value={speciesId}
            onChange={(e) => setSpeciesId(e.target.value)}
            disabled={!platformId}
            className="ml-2 rounded-md border border-[var(--color-border)] px-3 py-1.5 text-sm bg-white disabled:opacity-50"
          >
            <option value="">Select species...</option>
            {species.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </label>
      </div>

      {/* Tab switcher */}
      <div className="flex gap-4 border-b border-[var(--color-border)]">
        {(['analytes', 'panels'] as Tab[]).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`pb-2 px-1 text-sm font-medium capitalize ${
              activeTab === tab
                ? 'border-b-2 border-blue-500 text-blue-600'
                : 'text-[var(--color-muted)] hover:text-[var(--color-foreground)]'
            }`}
          >
            {tab}
          </button>
        ))}
      </div>

      {/* Content */}
      {filtersSelected ? (
        activeTab === 'analytes' ? (
          <AnalyteTable platformId={platformId} speciesId={speciesId} />
        ) : (
          <PanelList platformId={platformId} speciesId={speciesId} />
        )
      ) : (
        <p className="text-sm text-[var(--color-muted)]">
          Select a platform and species to manage data.
        </p>
      )}

      {/* Operators (global — not scoped to platform/species) */}
      <div className="pt-6 border-t border-[var(--color-border)]">
        <OperatorsSection />
      </div>
    </div>
  )
}
