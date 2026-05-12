import { describe, it, expect } from 'vitest'
import { sortByBeadRegion } from '../sortAnalytes'
import type { Analyte } from '../../../../../../shared/types/analyte'

// Helper to build minimal Analyte fixtures for sort-comparator tests.
// Only id / name / beadRegion are exercised by sortByBeadRegion; remaining
// fields are filled with placeholders to satisfy the Analyte type.
function mk(id: string, name: string, beadRegion: number | string): Analyte {
  return {
    id,
    name,
    beadRegion: beadRegion as Analyte['beadRegion'],
    premixConc: 10,
    singleConc: 20,
    platformId: 'p1',
    speciesId: 's1',
    masterPanelId: null,
    createdAt: '2026-01-01',
    updatedAt: '2026-01-01'
  } as Analyte
}

describe('sortByBeadRegion (Smoke 3 SMK3-14 / D-15)', () => {
  it('T-1: numeric ascending — [33, 12, 38, 25] sorts to [12, 25, 33, 38]', () => {
    const input = [
      mk('a1', 'IL-A', 33),
      mk('a2', 'IL-B', 12),
      mk('a3', 'IL-C', 38),
      mk('a4', 'IL-D', 25)
    ]
    const sorted = [...input].sort(sortByBeadRegion)
    expect(sorted.map((a) => a.beadRegion)).toEqual([12, 25, 33, 38])
  })

  it('T-2: tied numeric bead regions → alphabetic tiebreaker on name', () => {
    const input = [mk('a1', 'IL-Z', 25), mk('a2', 'IL-A', 25)]
    const sorted = [...input].sort(sortByBeadRegion)
    expect(sorted.map((a) => a.name)).toEqual(['IL-A', 'IL-Z'])
  })

  it("T-3: non-numeric bead regions fall back to lexical compare (D-15) — '25' before '25a'", () => {
    // Number('25a') is NaN → numeric path is skipped → lexical compare wins
    const a = mk('a1', 'IL-A', '25a')
    const b = mk('a2', 'IL-B', '25')

    // sortByBeadRegion(a, b) where a.beadRegion='25a' and b.beadRegion='25':
    // numeric path skipped (NaN on '25a') → String('25a').localeCompare(String('25')) > 0
    const result = sortByBeadRegion(a, b)
    expect(result).toBeGreaterThan(0)

    const sorted = [a, b].sort(sortByBeadRegion)
    expect(sorted.map((x) => x.beadRegion)).toEqual(['25', '25a'])
  })

  it('T-4: equal bead region AND equal name returns 0 (stable order)', () => {
    const a = mk('a1', 'IL-Same', 25)
    const b = mk('a2', 'IL-Same', 25)
    expect(sortByBeadRegion(a, b)).toBe(0)
  })
})
