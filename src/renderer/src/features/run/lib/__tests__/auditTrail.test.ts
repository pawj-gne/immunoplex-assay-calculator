import { describe, it, expect } from 'vitest'
import { computePeVolumeML, deriveDiluentBranchLabel } from '../auditTrail'

describe('Phase 15 audit-trail derivations', () => {
  describe('Group M: PE volume = finalVolume ÷ SAPE concentration (SMK3-17)', () => {
    it('T-M1: 9.8 mL ÷ 1.0× → 9.8 mL', () => {
      expect(computePeVolumeML(9.8, 1.0)).toBeCloseTo(9.8, 1)
    })
    it('T-M2: 9.8 mL ÷ 0.5× → 19.6 mL', () => {
      expect(computePeVolumeML(9.8, 0.5)).toBeCloseTo(19.6, 1)
    })
    it('T-M3: 9.8 mL ÷ 2.0× → 4.9 mL', () => {
      expect(computePeVolumeML(9.8, 2.0)).toBeCloseTo(4.9, 1)
    })
    it('T-M4: 9.8 mL ÷ null (pre-Phase-15) → 9.8 mL (silent 1× fallback)', () => {
      expect(computePeVolumeML(9.8, null)).toBeCloseTo(9.8, 1)
    })
    it('T-M5: 9.8 mL ÷ 0 (malformed panel data) → 9.8 mL (silent fallback)', () => {
      expect(computePeVolumeML(9.8, 0)).toBeCloseTo(9.8, 1)
    })
    it('T-M6: 9.8 mL ÷ undefined → 9.8 mL (silent fallback)', () => {
      expect(computePeVolumeML(9.8, undefined)).toBeCloseTo(9.8, 1)
    })
    it('T-M7: 9.83 pre-ceiling ÷ 1.0× → 9.9 mL (ceiling applied AFTER division)', () => {
      expect(computePeVolumeML(9.83, 1.0)).toBeCloseTo(9.9, 1)
    })
  })

  describe('Group N: deriveDiluentBranchLabel (D-15-09)', () => {
    it('T-N1: premix kind → Concentration-keyed (<name> @ 1× wins)', () => {
      expect(
        deriveDiluentBranchLabel({ kind: 'premix', name: 'Panel I' }, 1)
      ).toBe('Concentration-keyed (Panel I @ 1× wins)')
    })
    it('T-N2: values_table kind + premixConcentration > 1 → no 1× premix in selection', () => {
      expect(
        deriveDiluentBranchLabel(
          { kind: 'values_table', beads: 'L-AB', antibodies: 'L-AB' },
          5
        )
      ).toBe('Per-reagent fallback (no 1× premix in selection)')
    })
    it('T-N3: values_table kind + premixConcentration null → no premix selected', () => {
      expect(
        deriveDiluentBranchLabel(
          { kind: 'values_table', beads: 'L-AB', antibodies: 'L-AB' },
          null
        )
      ).toBe('Per-reagent fallback (no premix selected)')
    })
  })
})
