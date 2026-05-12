import { describe, it, expect } from 'vitest'
import { validateAndResolve } from '../validator'
import type { ParsedPanel } from '../parser'

const PLATFORMS = [
  { id: 'plat-millipore', name: 'Millipore' },
  { id: 'plat-biorad', name: 'Bio-Rad' }
]

const SPECIES = [
  { id: 'spec-human-millipore', name: 'Human', platformId: 'plat-millipore' },
  { id: 'spec-mouse-millipore', name: 'Mouse', platformId: 'plat-millipore' },
  { id: 'spec-human-biorad', name: 'Human', platformId: 'plat-biorad' }
]

function makeParsedPanel(overrides: Partial<ParsedPanel> = {}): ParsedPanel {
  return {
    sheetName: 'Test Sheet',
    platform: 'Millipore',
    species: 'Human',
    panelNameRaw: 'Panel 1',
    panelNameNormalized: 'Panel 1',
    panelDescription: null,
    sapeName: null,
    reagents: [
      { kind: 'beads', concentration: null, diluent: 'L-AB', volumePerWell: 0.025 },
      { kind: 'antibodies', concentration: null, diluent: 'L-AB', volumePerWell: 0.025 },
      { kind: 'sape', concentration: 1, diluent: 'n/a', volumePerWell: 0.025 }
    ],
    analytes: [{ name: 'IL-6', beadRegion: 12, concentration: 50 }],
    premixes: [],
    ...overrides
  }
}

describe('validateAndResolve', () => {
  it('T-1: empty parsed[] returns empty resolved + no errors', () => {
    const result = validateAndResolve([], PLATFORMS, SPECIES)
    expect(result.errors).toEqual([])
    expect(result.resolved).toEqual([])
  })

  it('T-2: valid single panel resolves with platformId/speciesId', () => {
    const result = validateAndResolve([makeParsedPanel()], PLATFORMS, SPECIES)
    expect(result.errors).toEqual([])
    expect(result.resolved).not.toBeNull()
    expect(result.resolved).toHaveLength(1)
    expect(result.resolved![0].platformId).toBe('plat-millipore')
    expect(result.resolved![0].speciesId).toBe('spec-human-millipore')
    expect(result.resolved![0].panelNameNormalized).toBe('Panel 1')
  })

  it('T-3: unknown platform -> error attributed to sheetName', () => {
    const parsed = [makeParsedPanel({ platform: 'NotAVendor', sheetName: 'Sheet 1' })]
    const result = validateAndResolve(parsed, PLATFORMS, SPECIES)
    expect(result.resolved).toBeNull()
    expect(result.errors).toHaveLength(1)
    expect(result.errors[0].sheetName).toBe('Sheet 1')
    expect(result.errors[0].message).toMatch(/Unknown platform "NotAVendor"/)
    expect(result.errors[0].message).toMatch(/Valid: Millipore, Bio-Rad/)
  })

  it('T-4: known platform + unknown species -> per-platform species scope error', () => {
    const parsed = [
      makeParsedPanel({
        platform: 'Bio-Rad', // Bio-Rad only has Human (no Mouse)
        species: 'Mouse',
        sheetName: 'BadSpecies'
      })
    ]
    const result = validateAndResolve(parsed, PLATFORMS, SPECIES)
    expect(result.resolved).toBeNull()
    const err = result.errors[0]
    expect(err.sheetName).toBe('BadSpecies')
    expect(err.message).toMatch(/Unknown species "Mouse" for platform "Bio-Rad"/)
    expect(err.message).toMatch(/Valid: Human/)
    // Mouse exists for Millipore but NOT for Bio-Rad — confirm it is NOT in the Valid: list.
    // (Mouse will appear once in the message — echoed back as the unknown species — but never inside "Valid: ...".)
    expect(err.message).not.toMatch(/Valid: [^.]*Mouse/)
  })

  it('T-5: case-insensitive platform/species match', () => {
    const parsed = [
      makeParsedPanel({
        platform: 'milliplex'.toUpperCase() === 'MILLIPLEX' ? 'milliplex' : 'milliplex', // ignore
        species: 'HUMAN'
      })
    ]
    // Actually we want to check that lowercase platform matches; use "millipore" lowercase.
    const parsed2 = [makeParsedPanel({ platform: 'millipore', species: 'HUMAN' })]
    const result = validateAndResolve(parsed2, PLATFORMS, SPECIES)
    expect(result.errors).toEqual([])
    expect(result.resolved).toHaveLength(1)
    expect(result.resolved![0].platformId).toBe('plat-millipore')
    expect(result.resolved![0].speciesId).toBe('spec-human-millipore')
    // Confirm parsed (uppercase) variant unused; lint-friendly noop reference
    expect(parsed.length).toBe(1)
  })

  it('T-6: case-insensitive premix-member match (il-6 matches IL-6)', () => {
    const parsed = [
      makeParsedPanel({
        analytes: [{ name: 'IL-6', beadRegion: 12, concentration: 50 }],
        premixes: [{ name: 'P1', premixConc: 1, memberNames: ['il-6'] }]
      })
    ]
    const result = validateAndResolve(parsed, PLATFORMS, SPECIES)
    expect(result.errors).toEqual([])
    expect(result.resolved).toHaveLength(1)
  })

  it('T-7: premix-member not in analyte block -> error attributed to sheetName', () => {
    const parsed = [
      makeParsedPanel({
        sheetName: 'MismatchSheet',
        analytes: [{ name: 'IL-6', beadRegion: 12, concentration: 50 }],
        premixes: [{ name: 'P1', premixConc: 1, memberNames: ['IL-99'] }]
      })
    ]
    const result = validateAndResolve(parsed, PLATFORMS, SPECIES)
    expect(result.resolved).toBeNull()
    const err = result.errors.find((e) =>
      e.message.includes('Premix "P1" references analyte "IL-99"')
    )
    expect(err).toBeDefined()
    expect(err!.sheetName).toBe('MismatchSheet')
    expect(err!.message).toMatch(
      /Premix "P1" references analyte "IL-99" not in the Single Analytes block/
    )
  })

  it('T-8: SAPE concentration null -> defensive error', () => {
    const parsed = [
      makeParsedPanel({
        sheetName: 'SapeVar',
        reagents: [
          { kind: 'beads', concentration: null, diluent: 'L-AB', volumePerWell: 0.025 },
          { kind: 'antibodies', concentration: null, diluent: 'L-AB', volumePerWell: 0.025 },
          { kind: 'sape', concentration: null, diluent: 'n/a', volumePerWell: 0.025 }
        ]
      })
    ]
    const result = validateAndResolve(parsed, PLATFORMS, SPECIES)
    expect(result.resolved).toBeNull()
    const err = result.errors.find((e) =>
      e.message.includes('SAPE concentration must be a numeric value')
    )
    expect(err).toBeDefined()
    expect(err!.sheetName).toBe('SapeVar')
  })

  it('T-9: multi-sheet errors aggregated (not short-circuited)', () => {
    const parsed = [
      makeParsedPanel({ sheetName: 'A', platform: 'NotAVendor' }),
      makeParsedPanel({ sheetName: 'B', species: 'Martian' })
    ]
    const result = validateAndResolve(parsed, PLATFORMS, SPECIES)
    expect(result.resolved).toBeNull()
    expect(result.errors.some((e) => e.sheetName === 'A')).toBe(true)
    expect(result.errors.some((e) => e.sheetName === 'B')).toBe(true)
  })

  it('T-10: D-21 — two sheets normalizing to same triple -> cross-sheet error', () => {
    const parsed = [
      makeParsedPanel({ sheetName: 'Sheet A', panelNameNormalized: 'Panel 1' }),
      makeParsedPanel({ sheetName: 'Sheet B', panelNameNormalized: 'Panel 1' })
    ]
    const result = validateAndResolve(parsed, PLATFORMS, SPECIES)
    expect(result.resolved).toBeNull()
    const d21 = result.errors.find((e) => e.message.includes('normalize to the same'))
    expect(d21).toBeDefined()
    expect(d21!.sheetName).toBe('') // cross-sheet errors carry empty string sheetName
    expect(d21!.message).toMatch(/Sheets "Sheet A" and "Sheet B" normalize to the same/)
    expect(d21!.message).toMatch(/Resolve duplicate panel names\./)
  })

  it('T-11: three colliding sheets -> at least 2 collision errors recorded', () => {
    const parsed = [
      makeParsedPanel({ sheetName: 'Sheet A', panelNameNormalized: 'Panel 1' }),
      makeParsedPanel({ sheetName: 'Sheet B', panelNameNormalized: 'Panel 1' }),
      makeParsedPanel({ sheetName: 'Sheet C', panelNameNormalized: 'Panel 1' })
    ]
    const result = validateAndResolve(parsed, PLATFORMS, SPECIES)
    expect(result.resolved).toBeNull()
    const collisions = result.errors.filter((e) => e.message.includes('normalize to the same'))
    expect(collisions.length).toBeGreaterThanOrEqual(2)
  })

  it('T-12: any error -> resolved is null', () => {
    const parsed = [makeParsedPanel({ platform: 'NotAVendor' })]
    const result = validateAndResolve(parsed, PLATFORMS, SPECIES)
    expect(result.resolved).toBeNull()
    expect(result.errors.length).toBeGreaterThan(0)
  })
})
