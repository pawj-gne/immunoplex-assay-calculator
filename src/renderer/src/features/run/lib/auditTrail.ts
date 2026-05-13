import { Decimal } from 'decimal.js'
import { ceilToTenthML } from '../../../lib/decimal'
import type { DiluentResult } from '../../../lib/diluentResolver'

/**
 * Phase 15 SMK3-17 (D-15-13/14/16): PE volume = finalVolume ÷ SAPE concentration,
 * ceiling-rounded UP to 0.1 mL. Silent fallback to 1× when sapeConcentration is
 * null, undefined, or 0 (PRD: "typically 1×"). Ceiling applies AFTER division
 * so non-integer divisors still round to the operator-friendly 0.1-mL step.
 *
 * Input: finalVolumeML (already 0.1-mL ceiling-rounded total assay volume).
 * Output: peVolumeML (0.1-mL ceiling-rounded number, suitable for direct render).
 *
 * Edge cases (Group M): see Phase 15 CONTEXT.md `<specifics>` table.
 */
export function computePeVolumeML(
  finalVolumeML: number,
  sapeConcentration: number | null | undefined
): number {
  const concentration =
    sapeConcentration === null ||
    sapeConcentration === undefined ||
    sapeConcentration === 0
      ? 1
      : sapeConcentration
  const finalUL = new Decimal(finalVolumeML).times(1000)
  const peUL = finalUL.dividedBy(concentration)
  const ceilUL = ceilToTenthML(peUL)
  return ceilUL.dividedBy(1000).toNumber()
}

/**
 * Phase 15 D-15-09: derive the branch label rendered above the per-reagent
 * diluent rows. Reads the snapshotted premixConcentration to disambiguate the
 * two "fallback" sub-cases.
 *
 * Cases (verbatim from CONTEXT.md <specifics>):
 *   diluent.kind === 'premix'                       → "Concentration-keyed (<name> @ 1× wins)"
 *   diluent.kind === 'values_table' && premixConc!==null → "Per-reagent fallback (no 1× premix in selection)"
 *   diluent.kind === 'values_table' && premixConc===null → "Per-reagent fallback (no premix selected)"
 *   diluent.kind === 'legacy'                       → "Per-reagent fallback (no premix selected)"
 */
export function deriveDiluentBranchLabel(
  diluent: DiluentResult,
  premixConcentration: number | null
): string {
  if (diluent.kind === 'premix') {
    return `Concentration-keyed (${diluent.name} @ 1× wins)`
  }
  if (premixConcentration === null) {
    return 'Per-reagent fallback (no premix selected)'
  }
  return 'Per-reagent fallback (no 1× premix in selection)'
}
