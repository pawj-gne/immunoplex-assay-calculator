/**
 * Diluent resolution result for Beads and Antibodies, per Smoke 3 PRD SMK3-07.
 *
 * Discriminated union with three branches:
 *
 * 1. `premix` — a selected premix with concentration === 1 was found.
 *    That premix is the diluent for BOTH Beads and Antibodies.
 *
 * 2. `values_table` — no 1× premix in the selection. Fall back to the
 *    per-reagent diluent strings from the panel's Values block.
 *    Strings are stored VERBATIM (per SMK3-DIL-01: open-ended free text,
 *    no enum, no normalization). May contain "L-AB", "n/a", "Assay Buffer",
 *    or anything else the lab author typed.
 *
 * 3. `legacy` — the current panel was imported by the pre-Smoke-3 parser
 *    and has no per-reagent diluent data. Caller decides display fallback.
 *    (Will go away after Phase 13 reparses all panels under SMK3-08.)
 */
export type DiluentKind = 'premix' | 'values_table' | 'legacy'

export type DiluentResult =
  | { kind: 'premix'; name: string }
  | { kind: 'values_table'; beads: string; antibodies: string }
  | { kind: 'legacy'; beads: null; antibodies: null }

/**
 * Minimal premix shape the resolver needs. The full PremixPanel type lives
 * in shared/types/panel.ts; the resolver accepts a structural subset so it
 * can be tested with plain objects (no DB fixture needed) and so future
 * schema growth in Phase 13 (per-reagent rows on master_panels) won't break
 * the resolver's input contract.
 */
export interface SelectedPremixForDiluent {
  name: string
  /** Premix Concentration (sub-panel concentration). 1 = "1×" (the diluent
   *  candidate); >1 = concentrated premix that won't serve as diluent. */
  concentration: number
}

/**
 * Per-reagent Values-table diluent strings, as authored in the panel's xlsx.
 * Phase 13 SMK3-08 will populate these from the new master_panels schema.
 * In Phase 12, panels imported by the v0.7.0 parser do NOT have this field —
 * the resolver caller passes undefined and gets back the `legacy` branch.
 */
export interface PanelValuesDiluent {
  beads: string
  antibodies: string
}
