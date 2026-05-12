import type {
  DiluentResult,
  SelectedPremixForDiluent,
  PanelValuesDiluent
} from '../../../shared/types/diluent'

/**
 * Resolve which diluent applies to Beads and Antibodies for the current
 * selection, per Smoke 3 PRD SMK3-07.
 *
 * Algorithm:
 *   1. Scan `selectedPremixes` in input-array order. If ANY has
 *      `concentration === 1`, return `{ kind: 'premix', name: that.name }`.
 *      Tiebreaker for multiple 1× premixes: FIRST in array wins
 *      (deterministic; caller controls ordering — see Plan 12-02
 *      §Tiebreaker decision in the plan file).
 *   2. No 1× premix found:
 *      a. If `valuesTable` is provided, return
 *         `{ kind: 'values_table', beads: valuesTable.beads,
 *            antibodies: valuesTable.antibodies }` — strings returned
 *         VERBATIM (no normalization, no enum check, no trim, no case
 *         fold per SMK3-DIL-01).
 *      b. Else (legacy v0.7.0 panel — no per-reagent diluent data)
 *         return `{ kind: 'legacy', beads: null, antibodies: null }`.
 *         The caller decides display fallback (e.g., the existing v1
 *         "Assay Buffer" string, or a "(legacy panel — diluent
 *         unspecified)" advisory).
 *
 * The resolver is pure: no I/O, no mutation, no Decimal math. Testable
 * in isolation against plain objects. Decoupled from PremixPanel /
 * Analyte / calculator types — accepts a structural input shape so
 * Phase 13's master_panels schema growth won't break this contract.
 *
 * Why input-array-order (not panel-defined order, alphabetical, or
 * first-selected): keeps the resolver decoupled from panel-data shape.
 * The CALLER (Plan 12-03 calculatorStore) is responsible for passing
 * premixes in a stable order. In Phase 12 that order is panel-authored
 * (panel.analytes preserves source-of-truth ordering); future
 * multi-premix selection state will be order-preserving in the same way.
 */
export function resolveDiluent(args: {
  selectedPremixes: ReadonlyArray<SelectedPremixForDiluent>
  valuesTable: PanelValuesDiluent | undefined
}): DiluentResult {
  const { selectedPremixes, valuesTable } = args

  // Step 1: any 1× premix wins (first in input order on tiebreak)
  for (const premix of selectedPremixes) {
    if (premix.concentration === 1) {
      return { kind: 'premix', name: premix.name }
    }
  }

  // Step 2a: per-reagent Values-table fallback (verbatim strings, no normalization)
  if (valuesTable !== undefined) {
    return {
      kind: 'values_table',
      beads: valuesTable.beads,
      antibodies: valuesTable.antibodies
    }
  }

  // Step 2b: legacy panel — no per-reagent diluent data available
  return { kind: 'legacy', beads: null, antibodies: null }
}

// Re-export types so downstream callers can import everything from one path
export type {
  DiluentResult,
  DiluentKind,
  SelectedPremixForDiluent,
  PanelValuesDiluent
} from '../../../shared/types/diluent'
