import type { Analyte } from '../../../../../shared/types/analyte'

/**
 * Sort selected analytes by bead region ascending (Smoke 3 D-15).
 *
 * Algorithm:
 *  1. If both bead-region values parse as finite numbers AND differ, return
 *     numeric difference (ascending).
 *  2. Otherwise fall back to lexical compare on the string form of
 *     beadRegion (per D-15 fallback rule for non-numeric values like
 *     '25a' that some panel imports might surface).
 *  3. Final tiebreaker: alphabetic by analyte name (deterministic ordering
 *     for analytes that share the same bead region).
 *
 * Extracted from the SelectedAnalytesList component into its own module so
 * that vitest (configured to include only `*.test.ts`, see vitest.config.ts
 * line 7) can unit-test the sort key. Inline `.tsx` definition would be
 * un-coverable without extending the vitest include glob to `.test.tsx`,
 * which is out of scope for Phase 14.
 */
export function sortByBeadRegion(a: Analyte, b: Analyte): number {
  const aNum = Number(a.beadRegion)
  const bNum = Number(b.beadRegion)
  if (!Number.isNaN(aNum) && !Number.isNaN(bNum) && aNum !== bNum) {
    return aNum - bNum
  }
  const beadCompare = String(a.beadRegion).localeCompare(String(b.beadRegion))
  if (beadCompare !== 0) return beadCompare
  return a.name.localeCompare(b.name)
}
