import { describe, it, expect } from 'vitest'
import { getDuplicatePair } from '../calculator'

describe('getDuplicatePair (SMK3-RPL-02 — vertical-pair-within-column geometry)', () => {
  describe('Standard columns (0-indexed 0/1/2 = 1-indexed 1/2/3) return null', () => {
    for (const col of [0, 1, 2]) {
      it(`col=${col} (1-indexed ${col + 1}) returns null for every row 0-7`, () => {
        for (let row = 0; row < 8; row++) {
          expect(getDuplicatePair(row, col)).toBeNull()
        }
      })
    }
  })

  describe('Unknown columns 4-12 (0-indexed 3-11): adjacent-row partner in SAME column', () => {
    const UNKNOWN_COLS_ZERO_INDEXED = [3, 4, 5, 6, 7, 8, 9, 10, 11] as const
    // (row → expected partner row); same col on both sides
    const PAIRS: ReadonlyArray<readonly [number, number]> = [
      [0, 1],
      [1, 0],
      [2, 3],
      [3, 2],
      [4, 5],
      [5, 4],
      [6, 7],
      [7, 6]
    ]

    for (const col of UNKNOWN_COLS_ZERO_INDEXED) {
      describe(`col=${col} (1-indexed ${col + 1})`, () => {
        for (const [row, expectedPartnerRow] of PAIRS) {
          it(`row=${row} → partner { row: ${expectedPartnerRow}, col: ${col} }`, () => {
            expect(getDuplicatePair(row, col)).toEqual({ row: expectedPartnerRow, col })
          })
        }
      })
    }
  })

  describe('Symmetry guard — getDuplicatePair is its own inverse on unknown cols', () => {
    it('applying twice returns the original (row, col) for every unknown well', () => {
      for (let col = 3; col <= 11; col++) {
        for (let row = 0; row < 8; row++) {
          const partner = getDuplicatePair(row, col)
          expect(partner).not.toBeNull()
          const back = getDuplicatePair(partner!.row, partner!.col)
          expect(back).toEqual({ row, col })
        }
      }
    })
  })
})
