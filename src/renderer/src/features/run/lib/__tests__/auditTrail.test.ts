import { describe, it, expect } from 'vitest'
import {
  computePeVolumeML,
  deriveDiluentBranchLabel,
  computeRawReagentVolumeML,
  computeNewReagentVolumeML,
  computeTotalReagentVolumeML
} from '../auditTrail'

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

  describe('Group P: WR-06 derived audit-trail rows (D-15.1-05..08)', () => {
    describe('computeRawReagentVolumeML (Raw bead/antibody volume)', () => {
      it('T-P1: 100 samples × singles × 1 plate × 0.05 mL/well + 2000 µL dead → 8.2 mL', () => {
        // totalWells = 100 + 24 = 124; raw µL = 124 × 50 + 2000 = 8200 → 8.2 mL
        expect(computeRawReagentVolumeML(100, 'singles', 1, 0.05, 2000)).toBeCloseTo(8.2, 1)
      })
      it('T-P2: volumePerWellML = null (legacy / pre-Phase-15 row) → null', () => {
        expect(computeRawReagentVolumeML(100, 'singles', 1, null, 2000)).toBeNull()
      })
      it('T-P3: volumePerWellML = undefined → null', () => {
        expect(computeRawReagentVolumeML(100, 'singles', 1, undefined, 2000)).toBeNull()
      })
      it('T-P4: volumePerWellML = 0 (malformed row) → null', () => {
        expect(computeRawReagentVolumeML(100, 'singles', 1, 0, 2000)).toBeNull()
      })
      it('T-P5: sampleCount = 0 → null', () => {
        expect(computeRawReagentVolumeML(0, 'singles', 1, 0.05, 2000)).toBeNull()
      })
      it('T-P6: 36 samples × duplicates × 1 plate × 0.025 mL/well + 2000 µL dead → 4.4 mL', () => {
        // totalWells = 36 × 2 + 24 = 96; raw µL = 96 × 25 + 2000 = 4400 → 4.4 mL
        expect(computeRawReagentVolumeML(36, 'duplicates', 1, 0.025, 2000)).toBeCloseTo(4.4, 1)
      })
    })

    describe('computeNewReagentVolumeML (New beads/antibodies)', () => {
      it('T-P7: raw = 8.2 mL, old = 2.5 mL → 5.7 mL', () => {
        expect(computeNewReagentVolumeML(8.2, 2.5)).toBeCloseTo(5.7, 1)
      })
      it('T-P8: raw = null → null', () => {
        expect(computeNewReagentVolumeML(null, 2.5)).toBeNull()
      })
      it('T-P9a: old = null (legacy) → returns raw (treats null as 0)', () => {
        expect(computeNewReagentVolumeML(8.2, null)).toBeCloseTo(8.2, 1)
      })
      it('T-P9b: old = undefined → returns raw (treats undefined as 0)', () => {
        expect(computeNewReagentVolumeML(8.2, undefined)).toBeCloseTo(8.2, 1)
      })
      it('T-P10: raw = 7.4 mL, old = 10.0 mL (over-subtract override) → 0.0 mL (clamp)', () => {
        // applyOldReagentSubtraction clamps negative → 0; ceil(0) = 0.
        expect(computeNewReagentVolumeML(7.4, 10.0)).toBeCloseTo(0, 1)
      })
    })

    describe('computeTotalReagentVolumeML (Total bead/antibody volume)', () => {
      it('T-P11: new = 5.7 mL, old = 2.5 mL → 8.2 mL', () => {
        expect(computeTotalReagentVolumeML(5.7, 2.5)).toBeCloseTo(8.2, 1)
      })
      it('T-P12: new = null → null', () => {
        expect(computeTotalReagentVolumeML(null, 2.5)).toBeNull()
      })
      it('T-P13: old = null → returns new (treats null as 0)', () => {
        expect(computeTotalReagentVolumeML(5.7, null)).toBeCloseTo(5.7, 1)
      })
      it('T-P14: new = 0 (clamped), old = 10.0 mL → 10.0 mL (over-subtract surfaces oldBeads as total)', () => {
        expect(computeTotalReagentVolumeML(0, 10.0)).toBeCloseTo(10.0, 1)
      })
    })
  })
})
