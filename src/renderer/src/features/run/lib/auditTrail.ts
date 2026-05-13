import { Decimal } from 'decimal.js'
import { ceilToTenthML } from '../../../lib/decimal'
import {
  calculateTotalWells,
  calculateRawVolume,
  applyOldReagentSubtraction
} from '../../../lib/calculator'
import type { DiluentResult } from '../../../lib/diluentResolver'
import type { ReplicateMode } from '../../../../../shared/constants/calculator'

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

/**
 * Phase 15.1 WR-06 (D-15.1-05/06/07): derive Raw {bead,antibody} volume in
 * mL for the audit-trail render. Composes the live-calculator helpers
 * (calculateTotalWells + calculateRawVolume) against snapshotted RunRecord
 * fields, applying ceilToTenthML at the LAST µL step before converting back
 * to mL (Pitfall 4: never apply ceiling at intermediate steps — compound
 * rounding drifts the displayed value upward from the live calculator).
 *
 * Unit asymmetry on the RunRecord (Pitfall 1 / PATTERNS §"mL/µL boundary"):
 *   - `r.volumePerWell`    is µL (calculator domain)
 *   - `r.beadsVolumePerWell` / `r.antibodiesVolumePerWell` are mL
 *     (master-panel snapshot fields). Pass the mL field as
 *     `volumePerWellML`; the helper converts to µL internally.
 *   - `r.deadVolume` is µL (= numberOfSetups × 2000).
 *
 * Null guard (D-15.1-07; Pitfall 6): returns null when volumePerWellML is
 * null/undefined/0, or when sampleCount/plateCount is <= 0. The
 * AuditTrailSection consumer renders the em-dash placeholder when null,
 * matching SMK3-16 historical-run behavior.
 *
 * @param sampleCount     whole number from RunRecord
 * @param replicateMode   'singles' | 'duplicates'
 * @param plateCount      whole number from RunRecord
 * @param volumePerWellML mL number from RunRecord master-panel snapshot
 * @param deadVolumeUL    µL number from RunRecord (= numberOfSetups × 2000)
 * @returns Raw reagent volume in mL (0.1-mL ceiling-rounded) or null
 */
export function computeRawReagentVolumeML(
  sampleCount: number,
  replicateMode: ReplicateMode,
  plateCount: number,
  volumePerWellML: number | null | undefined,
  deadVolumeUL: number
): number | null {
  if (
    volumePerWellML === null ||
    volumePerWellML === undefined ||
    volumePerWellML === 0 ||
    sampleCount <= 0 ||
    plateCount <= 0
  ) {
    return null
  }
  const { totalWells } = calculateTotalWells(sampleCount, replicateMode, plateCount)
  const volumePerWellUL = new Decimal(volumePerWellML).times(1000)
  const rawUL = calculateRawVolume(
    totalWells,
    volumePerWellUL,
    new Decimal(deadVolumeUL)
  )
  const ceilUL = ceilToTenthML(rawUL)
  return ceilUL.dividedBy(1000).toNumber()
}

/**
 * Phase 15.1 WR-06 (D-15.1-05/06/07): derive New {beads,antibodies} volume
 * in mL for the audit-trail render. Composes applyOldReagentSubtraction
 * (which already clamps newReagentUL to 0 per D-11 / Pitfall 5 — verified at
 * calculator.ts:128-129), then applies ceilToTenthML at the LAST µL step.
 *
 * Both inputs are mL (from the helper layer above plus the persisted
 * `r.oldBeads` / `r.oldAntibodies` operator-typed values). Null raw → null
 * return so the em-dash placeholder propagates. Null/undefined old is
 * treated as 0 (legacy pre-Phase-14 rows lack these fields).
 *
 * @param rawReagentML mL number from computeRawReagentVolumeML (or null)
 * @param oldReagentML mL number from RunRecord (`r.oldBeads` / `r.oldAntibodies`)
 * @returns New reagent volume in mL (0.1-mL ceiling-rounded, clamped at 0)
 *          or null when rawReagentML is null.
 */
export function computeNewReagentVolumeML(
  rawReagentML: number | null,
  oldReagentML: number | null | undefined
): number | null {
  if (rawReagentML === null) {
    return null
  }
  const old = oldReagentML ?? 0
  const rawUL = new Decimal(rawReagentML).times(1000)
  const oldUL = new Decimal(old).times(1000)
  const { newReagentUL } = applyOldReagentSubtraction(rawUL, oldUL)
  const ceilUL = ceilToTenthML(newReagentUL)
  return ceilUL.dividedBy(1000).toNumber()
}

/**
 * Phase 15.1 WR-06 (D-15.1-05/06/07): derive Total {bead,antibody} volume
 * in mL for the audit-trail render. Adds `new + old` directly — both inputs
 * are already 0.1-mL ceiling-rounded from the upstream helpers, so no
 * additional ceilToTenthML is needed at this layer (Pitfall 4).
 *
 * On the override-clamp path (newReagentML === 0, oldReagentML > rawReagent),
 * this returns oldReagentML — matching the operator's snapshotted "Old
 * Beads" value as the total (T-P14; matches applyOldReagentSubtraction's
 * post-clamp semantics at calculator.ts:128-130 where total = old + 0).
 *
 * @param newReagentML mL number from computeNewReagentVolumeML (or null)
 * @param oldReagentML mL number from RunRecord (`r.oldBeads` / `r.oldAntibodies`)
 * @returns Total reagent volume in mL, or null when newReagentML is null.
 */
export function computeTotalReagentVolumeML(
  newReagentML: number | null,
  oldReagentML: number | null | undefined
): number | null {
  if (newReagentML === null) {
    return null
  }
  return newReagentML + (oldReagentML ?? 0)
}
