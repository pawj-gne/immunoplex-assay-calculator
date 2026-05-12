import { describe, it, expect } from 'vitest'
import { resolveDiluent } from '../diluentResolver'

/**
 * Tests for resolveDiluent — Smoke 3 PRD SMK3-07 + SMK3-DIL-01.
 *
 * Fixture groups (13 cases total):
 *   A — `kind: 'premix'` branch (any 1× premix wins; input-array-order tiebreaker)
 *   B — `kind: 'values_table'` branch (no 1× premix → per-reagent fallback)
 *   C — `kind: 'legacy'` branch (v0.7.0 panels with no Values-table data)
 *   D — defensive / boundary (strict-equality of concentration === 1)
 */
describe('resolveDiluent', () => {
  describe('1× premix wins', () => {
    it('T-A1: single 1× premix in selection → returns that premix', () => {
      const result = resolveDiluent({
        selectedPremixes: [{ name: 'JAMmate F', concentration: 1 }],
        valuesTable: undefined
      })
      expect(result).toEqual({ kind: 'premix', name: 'JAMmate F' })
    })

    it('T-A2: 1× premix first, 20× premix second → 1× wins', () => {
      const result = resolveDiluent({
        selectedPremixes: [
          { name: 'JAMmate F', concentration: 1 },
          { name: 'Premix A', concentration: 20 }
        ],
        valuesTable: undefined
      })
      expect(result).toEqual({ kind: 'premix', name: 'JAMmate F' })
    })

    it('T-A3: 20× premix first, 1× premix second → 1× wins regardless of position', () => {
      const result = resolveDiluent({
        selectedPremixes: [
          { name: 'Premix A', concentration: 20 },
          { name: 'JAMmate F', concentration: 1 }
        ],
        valuesTable: undefined
      })
      expect(result).toEqual({ kind: 'premix', name: 'JAMmate F' })
    })

    it('T-A4: tiebreaker — two 1× premixes (F first, A second) → FIRST in array wins (JAMmate F)', () => {
      const result = resolveDiluent({
        selectedPremixes: [
          { name: 'JAMmate F', concentration: 1 },
          { name: 'JAMmate A', concentration: 1 }
        ],
        valuesTable: undefined
      })
      expect(result).toEqual({ kind: 'premix', name: 'JAMmate F' })
    })

    it('T-A5: reverse-order tiebreaker — two 1× premixes (A first, F second) → FIRST in array wins (JAMmate A) — confirms input-array-order, not alphabetical', () => {
      const result = resolveDiluent({
        selectedPremixes: [
          { name: 'JAMmate A', concentration: 1 },
          { name: 'JAMmate F', concentration: 1 }
        ],
        valuesTable: undefined
      })
      expect(result).toEqual({ kind: 'premix', name: 'JAMmate A' })
    })

    it('T-A6: 1× premix beats values_table even when valuesTable IS provided', () => {
      const result = resolveDiluent({
        selectedPremixes: [{ name: 'JAMmate F', concentration: 1 }],
        valuesTable: { beads: 'L-AB', antibodies: 'L-AB' }
      })
      expect(result).toEqual({ kind: 'premix', name: 'JAMmate F' })
    })
  })

  describe('Values-table fallback', () => {
    it('T-B1: all premixes >1×, valuesTable provided → values_table branch', () => {
      const result = resolveDiluent({
        selectedPremixes: [
          { name: 'Premix A', concentration: 20 },
          { name: 'Premix B', concentration: 20 }
        ],
        valuesTable: { beads: 'L-AB', antibodies: 'L-AB' }
      })
      expect(result).toEqual({ kind: 'values_table', beads: 'L-AB', antibodies: 'L-AB' })
    })

    it('T-B2: empty selection (full custom), valuesTable provided → values_table branch', () => {
      const result = resolveDiluent({
        selectedPremixes: [],
        valuesTable: { beads: 'Assay Buffer', antibodies: 'n/a' }
      })
      expect(result).toEqual({
        kind: 'values_table',
        beads: 'Assay Buffer',
        antibodies: 'n/a'
      })
    })

    it('T-B3: free-text returned verbatim — whitespace AND case preserved per SMK3-DIL-01', () => {
      const result = resolveDiluent({
        selectedPremixes: [{ name: 'Premix A', concentration: 20 }],
        valuesTable: { beads: '  L-AB ', antibodies: 'N/A' }
      })
      expect(result.kind).toBe('values_table')
      // Narrow the union so TypeScript admits the field access
      if (result.kind === 'values_table') {
        expect(result.beads).toBe('  L-AB ')
        expect(result.antibodies).toBe('N/A')
      }
    })
  })

  describe('legacy panel (no Values-table data)', () => {
    it('T-C1: no 1× premix, no valuesTable → legacy branch', () => {
      const result = resolveDiluent({
        selectedPremixes: [{ name: 'Premix A', concentration: 20 }],
        valuesTable: undefined
      })
      expect(result).toEqual({ kind: 'legacy', beads: null, antibodies: null })
    })

    it('T-C2: empty selection, no valuesTable → legacy branch', () => {
      const result = resolveDiluent({
        selectedPremixes: [],
        valuesTable: undefined
      })
      expect(result).toEqual({ kind: 'legacy', beads: null, antibodies: null })
    })
  })

  describe('boundary cases', () => {
    it('T-D1: concentration of exactly 1 matches (strict equality)', () => {
      const result = resolveDiluent({
        selectedPremixes: [{ name: 'Exact1x', concentration: 1 }],
        valuesTable: { beads: 'X', antibodies: 'X' }
      })
      expect(result).toEqual({ kind: 'premix', name: 'Exact1x' })
    })

    it('T-D2: concentration of 0 does NOT match (strictly === 1, not <= 1) → values_table', () => {
      const result = resolveDiluent({
        selectedPremixes: [{ name: 'Weird', concentration: 0 }],
        valuesTable: { beads: 'X', antibodies: 'X' }
      })
      expect(result).toEqual({ kind: 'values_table', beads: 'X', antibodies: 'X' })
    })

    it('T-D3: fractional concentration 0.5 does NOT match → falls to legacy when no valuesTable', () => {
      const result = resolveDiluent({
        selectedPremixes: [{ name: 'HalfX', concentration: 0.5 }],
        valuesTable: undefined
      })
      expect(result).toEqual({ kind: 'legacy', beads: null, antibodies: null })
    })
  })
})
