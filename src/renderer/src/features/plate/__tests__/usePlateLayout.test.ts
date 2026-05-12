import { describe, it, expect, beforeEach } from 'vitest'
import { usePlateStore } from '../../../stores/plateStore'

describe('Duplicate plate layout geometry (SMK3-RPL-02 via plateStore.autoFill — same contract as usePlateLayout)', () => {
  beforeEach(() => {
    usePlateStore.getState().reset()
  })

  describe('sampleCount = 36, replicateMode = duplicates → all 9 unknown cols filled with 4 pairs each', () => {
    beforeEach(() => {
      usePlateStore.getState().setReplicateMode('duplicates')
      usePlateStore.getState().setSampleCount(36)
    })

    it('T-1: plate 1 contains exactly 72 wells (36 samples × 2 wells/sample)', () => {
      const wells = usePlateStore.getState().getPlateWells(1)
      expect(wells.size).toBe(72)
    })

    it('T-2: col 4 contains 8 wells — A4, B4, C4, D4, E4, F4, G4, H4', () => {
      const wells = usePlateStore.getState().getPlateWells(1)
      for (const row of ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H']) {
        expect(wells.has(`${row}4`)).toBe(true)
      }
    })

    it('T-3: col 12 contains 8 wells — A12..H12 (D-21 col-12 NOT special-cased anymore)', () => {
      const wells = usePlateStore.getState().getPlateWells(1)
      for (const row of ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H']) {
        expect(wells.has(`${row}12`)).toBe(true)
      }
    })

    it('T-4: zero wells in standard cols 1-3 across all rows', () => {
      const wells = usePlateStore.getState().getPlateWells(1)
      for (const row of ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H']) {
        for (const col of [1, 2, 3]) {
          expect(wells.has(`${row}${col}`)).toBe(false)
        }
      }
    })

    it('T-5: every unknown col 4-12 has all 8 rows filled (vertical pairs A,B C,D E,F G,H)', () => {
      const wells = usePlateStore.getState().getPlateWells(1)
      for (const col of [4, 5, 6, 7, 8, 9, 10, 11, 12]) {
        for (const row of ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H']) {
          expect(wells.has(`${row}${col}`)).toBe(true)
        }
      }
    })
  })

  describe('sampleCount = 4 → only col 4 filled (one column of 4 pairs)', () => {
    beforeEach(() => {
      usePlateStore.getState().setReplicateMode('duplicates')
      usePlateStore.getState().setSampleCount(4)
    })

    it('T-6: 8 wells filled — all in col 4 (A4..H4)', () => {
      const wells = usePlateStore.getState().getPlateWells(1)
      expect(wells.size).toBe(8)
      for (const row of ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H']) {
        expect(wells.has(`${row}4`)).toBe(true)
      }
      // Col 5 must be empty
      for (const row of ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H']) {
        expect(wells.has(`${row}5`)).toBe(false)
      }
    })
  })

  describe('sampleCount = 1 → only first pair (A4, B4) filled', () => {
    beforeEach(() => {
      usePlateStore.getState().setReplicateMode('duplicates')
      usePlateStore.getState().setSampleCount(1)
    })

    it('T-7: exactly 2 wells filled — A4 and B4', () => {
      const wells = usePlateStore.getState().getPlateWells(1)
      expect(wells.size).toBe(2)
      expect(wells.has('A4')).toBe(true)
      expect(wells.has('B4')).toBe(true)
      // C4 must NOT be filled
      expect(wells.has('C4')).toBe(false)
    })
  })

  describe('sampleCount = 37 → 36 on plate 1, 1 on plate 2 at (A4, B4)', () => {
    beforeEach(() => {
      usePlateStore.getState().setReplicateMode('duplicates')
      usePlateStore.getState().setSampleCount(37)
    })

    it('T-8: plate 1 fully filled (72 wells); plate 2 has 2 wells', () => {
      expect(usePlateStore.getState().getPlateWells(1).size).toBe(72)
      expect(usePlateStore.getState().getPlateWells(2).size).toBe(2)
    })

    it('T-9: plate 2 first pair = (A4, B4) — sample 37', () => {
      const p2 = usePlateStore.getState().getPlateWells(2)
      expect(p2.has('A4')).toBe(true)
      expect(p2.has('B4')).toBe(true)
    })
  })

  describe('Regression — singles mode unchanged', () => {
    it('T-10: sampleCount=72, replicateMode=singles → still 72 wells in cols 4-12, no col-12 special case', () => {
      usePlateStore.getState().setReplicateMode('singles')
      usePlateStore.getState().setSampleCount(72)
      const wells = usePlateStore.getState().getPlateWells(1)
      expect(wells.size).toBe(72)
      for (const col of [4, 5, 6, 7, 8, 9, 10, 11, 12]) {
        for (const row of ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H']) {
          expect(wells.has(`${row}${col}`)).toBe(true)
        }
      }
    })
  })
})
