import { describe, it, expect } from 'vitest'
import { normalizePanelName, canonReagentKind, isSapeNameLabel } from '../normalize'
import { ParseError } from '../parser'

describe('normalizePanelName (D-18, D-19, D-20)', () => {
  it('T-1: Panel I -> Panel 1', () => {
    expect(normalizePanelName('Panel I', 'sheet')).toBe('Panel 1')
  })
  it('T-2: Panel II -> Panel 2', () => {
    expect(normalizePanelName('Panel II', 'sheet')).toBe('Panel 2')
  })
  it('T-3: Panel V -> Panel 5', () => {
    expect(normalizePanelName('Panel V', 'sheet')).toBe('Panel 5')
  })
  it('T-4: Panel VII -> Panel 7', () => {
    expect(normalizePanelName('Panel VII', 'sheet')).toBe('Panel 7')
  })
  it('T-5: Panel X -> Panel 10', () => {
    expect(normalizePanelName('Panel X', 'sheet')).toBe('Panel 10')
  })
  it('T-6: Panel 1 passthrough', () => {
    expect(normalizePanelName('Panel 1', 'sheet')).toBe('Panel 1')
  })
  it('T-7: Panel 7 passthrough', () => {
    expect(normalizePanelName('Panel 7', 'sheet')).toBe('Panel 7')
  })
  it('T-8: whitespace tolerant ("  Panel III  ")', () => {
    expect(normalizePanelName('  Panel III  ', 'sheet')).toBe('Panel 3')
  })
  it('T-9: case-fold ("panel iv")', () => {
    expect(normalizePanelName('panel iv', 'sheet')).toBe('Panel 4')
  })
  it('T-10: out of range Roman ("Panel XI") rejected', () => {
    expect(() => normalizePanelName('Panel XI', 'sheet')).toThrow(/I through X/)
  })
  it('T-11: invalid suffix ("Panel III-A") rejected with D-20 message', () => {
    expect(() => normalizePanelName('Panel III-A', 'sheet')).toThrow(
      /must be "Panel <number>" or "Panel <I\.\.X>"/
    )
  })
  it('T-12: missing Panel prefix rejected', () => {
    expect(() => normalizePanelName('Cytokines Human', 'sheet')).toThrow(/must be "Panel/)
  })
  it('T-13: empty string rejected', () => {
    expect(() => normalizePanelName('', 'sheet')).toThrow(ParseError)
  })
  it('T-14: ParseError carries sheetName', () => {
    let caught: unknown
    try {
      normalizePanelName('Panel XI', 'Bio-Rad Human Panel 1')
    } catch (err) {
      caught = err
    }
    expect(caught).toBeInstanceOf(ParseError)
    expect((caught as ParseError).sheetName).toBe('Bio-Rad Human Panel 1')
    expect((caught as ParseError).message).toContain('[Bio-Rad Human Panel 1]')
  })
})

describe('canonReagentKind (D-03)', () => {
  it('T-15: Beads -> beads', () => {
    expect(canonReagentKind('Beads')).toBe('beads')
  })
  it('T-16: Bead -> beads', () => {
    expect(canonReagentKind('Bead')).toBe('beads')
  })
  it('T-17: "Antibodies " (trailing whitespace) -> antibodies (Pitfall A)', () => {
    expect(canonReagentKind('Antibodies ')).toBe('antibodies')
  })
  it('T-18: "Ab " (Bio-Rad trailing whitespace) -> antibodies', () => {
    expect(canonReagentKind('Ab ')).toBe('antibodies')
  })
  it('T-19: Antibody -> antibodies', () => {
    expect(canonReagentKind('Antibody')).toBe('antibodies')
  })
  it('T-20: SAPE -> sape', () => {
    expect(canonReagentKind('SAPE')).toBe('sape')
  })
  it('T-21: SA-PE -> sape', () => {
    expect(canonReagentKind('SA-PE')).toBe('sape')
  })
  it('T-22: Streptavidin-PE -> sape', () => {
    expect(canonReagentKind('Streptavidin-PE')).toBe('sape')
  })
  it('T-23: streptavidin-pe (lower) -> sape', () => {
    expect(canonReagentKind('streptavidin-pe')).toBe('sape')
  })
  it('T-24: Fluoroantibody -> null', () => {
    expect(canonReagentKind('Fluoroantibody')).toBeNull()
  })
  it('T-25: empty -> null', () => {
    expect(canonReagentKind('')).toBeNull()
  })
  it('T-26: SAPE Name -> null (label marker, not a kind)', () => {
    expect(canonReagentKind('SAPE Name')).toBeNull()
  })
})

describe('isSapeNameLabel', () => {
  it('T-27: "SAPE Name" -> true', () => {
    expect(isSapeNameLabel('SAPE Name')).toBe(true)
  })
  it('T-28: "sape name" -> true', () => {
    expect(isSapeNameLabel('sape name')).toBe(true)
  })
  it('T-29: " SAPE Name " -> true', () => {
    expect(isSapeNameLabel(' SAPE Name ')).toBe(true)
  })
  it('T-30: SAPE -> false', () => {
    expect(isSapeNameLabel('SAPE')).toBe(false)
  })
  it('T-31: empty -> false', () => {
    expect(isSapeNameLabel('')).toBe(false)
  })
})
