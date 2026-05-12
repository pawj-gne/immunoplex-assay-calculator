# Phase 12: Smoke 3 — Calculator Rules Migration — Context

**Gathered:** 2026-05-11
**Status:** Ready for planning
**Source:** Auto-generated from [INGEST-RESOLUTIONS.md](../../INGEST-RESOLUTIONS.md) (Phase-12-relevant decisions only) — bypasses /gsd-discuss-phase per the 2026-05-11 Smoke 3 PRD ingest.

<domain>
## Phase Boundary

Migrate three locked calculator rules from v1/v2 baselines to the Smoke 3 PRD specification — all in **pure calculator logic** (no schema, no DB, no UI changes, no parser changes). The rules ship as a coherent set so that subsequent phases (13 parser v3, 14 plate page inputs, 15 run-doc audit trail) can build on a calculator that already speaks Smoke 3 math.

**In-scope:**
1. Volume rounding: change ceiling precision from 1 mL to 0.1 mL (SMK3-06; supersedes CALC-06 + STATE decision 02-01)
2. Dead volume: change from constant `2 mL` to `number_of_setups × 2 mL` (SMK3-05; extends CALC-03)
3. Diluent selection: swap from request-type-keyed rule (premix-only / premix+singles / full-custom uses Assay Buffer) to **concentration-keyed** rule — if ANY selected premix is 1×, that premix is the diluent for Beads + Antibodies; else fall back to per-reagent Values-table diluent (SMK3-07; supersedes PROJECT §Domain Rules diluent rule)
4. Explicit CALC-05 retention: preserve the existing max-5-singles cap (R-05 — silence in PRD ≠ removal)

**Out-of-scope (covered by later phases):**
- Plate-page UI inputs for Old Beads / Old Antibodies / Number of Setups (Phase 14, SMK3-02/03/04). For Phase 12, the calculator MUST accept a `numberOfSetups` parameter; the UI passes `1` as a default until Phase 14 ships.
- Parser rewrite for the Smoke 3 sectioned xlsx format (Phase 13, SMK3-08..11). Phase 12 reads `reagent_volume_per_well` and diluent strings from whatever shape the current data model exposes; if per-reagent rows aren't yet available, fall back to platform defaults and emit a marker (the per-reagent schema lands in Phase 13).
- Per-reagent diluent + concentration storage in `master_panels` (Phase 13 schema delta).
- PE volume / SAPE Name (Phase 15 run-doc).
- Bead region display flat list, premix deselection UX, stock-concentration label removal (Phase 14 UI).

The calculator's external surface (the calls renderer code makes into `lib/calculator.ts` / `lib/decimal.ts`) MUST stay backwards-compatible for any callsite that hasn't been updated yet — pass-through of `numberOfSetups = 1` and a fallback diluent string when the new fields are missing.

</domain>

<decisions>
## Implementation Decisions

### Rounding (R-03 / SMK3-06)

- **Direction:** Ceiling — always rounds UP, never down. `7.41` → `7.5`, `7.40` → `7.4`, `0.05` → `0.1`, `0` → `0` (exactly zero stays zero).
- **Precision:** 0.1 mL. Implemented as `Decimal.toDP(1, ROUND_CEIL)` from the existing decimal.js dependency, or equivalent.
- **Scope:** All "final volumes" reported to the operator — total bead volume, total antibody volume, total reaction volume, new-bead volume, new-antibody volume, PE volume. Intermediate values used in further math (e.g., `wells × volume_per_well` before adding dead volume) stay unrounded to avoid double-rounding error.
- **Supersedes:** REQUIREMENTS.md CALC-06 ("round up to nearest mL"), STATE.md decision 02-01 ("Final volume always rounds UP to nearest mL").
- **Test fixture target:** PRD worked example — 148 wells × 0.05 mL/well = 7.4 mL total bead, 148 × 0.025 = 3.7 mL total antibody. These already terminate at 0.1 mL precision; verify they pass through unchanged. Add fixtures for 7.41 → 7.5, 0.041 → 0.1, etc.

### Dead Volume (R-07 / SMK3-05)

- **Formula:** `dead_volume_mL = number_of_setups × 2`. Default `number_of_setups = 1` when not supplied.
- **Validation:** `number_of_setups >= 1`, integer. `0` or negative is rejected at the input boundary. No upper bound enforced by the calculator (UI will not gate it in Phase 14).
- **Extends:** CALC-03 ("dead volume is included in volume calculations"). Replaces the prior single-constant model with a `× setups` multiplier.
- **Calculator surface change:** Accept `numberOfSetups: number` as an input. Existing callsites that don't supply it default to 1 (backwards-compatible).
- **No UI work in Phase 12.** Phase 14 adds the Plate-page input.

### Diluent Rule (R-04 / SMK3-07)

The diluent for Beads and Antibodies is determined at calculation time from the current selection — not from request-type. Algorithm:

```
function resolveDiluent(selectedPremixes, selectedSingles, panelValuesTable):
  # Step 1: check for any 1x premix in the selection
  for premix in selectedPremixes:
    if premix.concentration === 1:
      return { kind: "premix", name: premix.name }    # any 1x premix wins; no ordering

  # Step 2: no 1x premix selected — use per-reagent Values-table diluent
  return {
    kind: "values_table",
    beads: panelValuesTable.beads.diluent,           # e.g., "L-AB"
    antibodies: panelValuesTable.antibodies.diluent
  }
```

- **No ordering / no priority among multiple 1× premixes** — the operator confirmed during ingest that no sequence-dependence exists. If multiple 1× premixes are in the selection, the resolver MUST be deterministic (pick the first one in some stable order — e.g., panel-defined order, or alphabetical). Document the choice.
- **`Values-table` diluent strings are open-ended free text** (SMK3-DIL-01). The resolver returns the string verbatim; no normalization, no enum check.
- **Supersedes:** PROJECT §Domain Rules — "Premix + singles: premix is the diluent / Full custom: Assay Buffer is the diluent." The Assay Buffer fallback is gone. If a Smoke 3 panel's Values-table doesn't supply a diluent for a reagent, that's a panel-data problem to surface in Phase 13 validation — not a calculator default.
- **Backwards compat:** For panels imported under the v0.7.0 parser (which doesn't carry per-reagent diluent), the resolver returns `{ kind: "legacy", beads: null, antibodies: null }`. Caller decides display. Tests should cover this fallback shape.

### CALC-05 Cap (R-05)

- **No code change required.** The cap is already enforced in `calculatorStore` / `selectionStore`. Phase 12's job: add an explicit regression test confirming the cap still blocks a 6th single when a premix is selected, after the diluent + rounding + dead-volume changes ship.

### Claude's Discretion

- File organization: whether to put the diluent resolver in `lib/calculator.ts` (existing volume math) or split into `lib/diluentResolver.ts` (new). Recommendation: new file — diluent resolution is a distinct concern, will grow as Phase 13 lands panel data, easier to test in isolation.
- Test framework: vitest is already in use ([src/main/import/__tests__/parser.test.ts](../../../src/main/import/__tests__/parser.test.ts) is the existing pattern); use it.
- Where to expose the `numberOfSetups` plumbing in the renderer stores (`calculatorStore` is the obvious home, since plate inputs already feed it). For Phase 12, add the field; UI is Phase 14.
- Whether to emit a "computed under previous rules" marker on volumes for runs saved before Phase 12 (per SMK3-16, historical runs are snapshot-frozen). Recommendation: defer the marker UI to Phase 15 run-doc work; for Phase 12, ensure the migration doesn't recompute persisted values on load.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Smoke 3 PRD + ingest trail
- [`.planning/SMOKE-3-PRD.md`](../../SMOKE-3-PRD.md) — canonical product spec; §Calculation describes the math being migrated
- [`.planning/INGEST-RESOLUTIONS.md`](../../INGEST-RESOLUTIONS.md) — full decision trail; R-03, R-04, R-05, R-07 are the Phase 12 inputs; §E SMK3-05/06/07/12-relevant requirements

### Planning-level baselines
- [`.planning/PROJECT.md`](../../PROJECT.md) §Domain Rules — already updated with Smoke 3 rules; calculator must conform
- [`.planning/REQUIREMENTS.md`](../../REQUIREMENTS.md) §v2.1 — SMK3-05/06/07 + §v1 CALC-03/05/06 carryover annotations

### Codebase locations
- [`src/renderer/src/lib/calculator.ts`](../../../src/renderer/src/lib/calculator.ts) — current volume math, dead-volume integration, total-volume computation. Modify here for rounding + dead-volume changes.
- [`src/renderer/src/lib/decimal.ts`](../../../src/renderer/src/lib/decimal.ts) — Decimal.js utilities. May need a new helper like `ceilToTenth(value: Decimal): Decimal`.
- [`src/renderer/src/stores/calculatorStore.ts`](../../../src/renderer/src/stores/calculatorStore.ts) — orchestrator store; surfaces volume_per_well resolution + final outputs. Will need a `numberOfSetups` field (default 1, no UI in Phase 12).
- [`src/renderer/src/stores/selectionStore.ts`](../../../src/renderer/src/stores/selectionStore.ts) — selection state; provides input to the diluent resolver (which premixes + singles are selected; what concentrations).
- Existing tests under `src/renderer/src/lib/__tests__/` (if any) — extend; otherwise create vitest fixtures for the new rules.

### Versioning + history
- STATE.md decision **02-01** ("Final volume always rounds UP to nearest mL") — formally superseded by SMK3-06; new decision entry will reference 02-01.
- The v0.7.0 importer (in [`src/main/import/parser.ts`](../../../src/main/import/parser.ts)) is dead code awaiting Phase 13 — Phase 12 should not modify it.

</canonical_refs>

<specifics>
## Specific Ideas

### Concrete expected outputs (test fixtures)

Calculator should produce these exact values:

| Scenario | Inputs | Expected output |
|---|---|---|
| PRD worked example | Thermofisher/Human/Panel 1; 2 plates × 100 samples = 148 wells; setups=1 | bead = 7.4 mL, antibody = 3.7 mL, dead = 2 mL, total bead reaction = 9.4 mL, total ab reaction = 5.7 mL |
| Rounding edge | 148 × 0.0501 = 7.4148 mL bead | ceil-to-0.1 → 7.5 mL |
| Zero rounding | 0 wells × any vol/well = 0 | 0 mL (no upward bump from 0) |
| Multi-setup | Same example, setups=3 | dead = 6 mL; total bead reaction = 7.4 + 6 = 13.4 mL |
| Diluent (1× premix) | Selection: JAMmate F (1×), Premix A (20×), IL-2 (single) | diluent for beads + antibodies = JAMmate F |
| Diluent (no 1× premix) | Selection: Premix A (20×), Premix B (20×), IL-2 (single) | diluent.kind = values_table; reads from panel Values-table per reagent |
| Diluent (multiple 1× premixes) | Selection: JAMmate F (1×), JAMmate A (1×) | deterministic pick (document the rule); both pass the "1×" filter |

### Coexistence with shipped behavior

Until Phases 13/14/15 ship:
- The Plate-page UI in [src/renderer/src/features/plate/](../../../src/renderer/src/features/plate/) doesn't yet expose `numberOfSetups` or `oldBeads/oldAntibodies` inputs. Phase 12 plumbs the calculator API for these but the UI passes defaults (setups=1, oldBeads=0, oldAntibodies=0) so existing flows continue to work.
- Existing panels in the DB (imported by the v0.7.0 parser) carry only `reagent_volume_per_well` per master panel (single value, not per-reagent). Phase 12's diluent resolver gracefully degrades when per-reagent fields are absent — returns `{ kind: "legacy" }` and the run document falls back to existing display logic.
- The bead/antibody concentration "variable" shorthand (R-13) doesn't affect Phase 12 — that's a parser concern.

### Test discipline

- Vitest under `src/renderer/src/lib/__tests__/` (or wherever vitest is configured for the renderer).
- One test file per concern: `decimal.test.ts` (ceil-to-tenth helper), `calculator.test.ts` (volume math + dead-volume × setups), `diluentResolver.test.ts` (new file). Update existing tests rather than duplicating.
- Snapshot test the PRD worked example end-to-end (148 wells, setups=1, full output object).

</specifics>

<deferred>
## Deferred Ideas

### Punted to later phases (deliberately not in Phase 12)

- **Old Beads + Old Antibodies inputs in the Plate page UI** — Phase 14 (SMK3-02, SMK3-03). Calculator must accept the parameters but the UI work isn't part of Phase 12.
- **Number of Setups input in the Plate page UI** — Phase 14 (SMK3-04). Same as above — calculator surface exists; UI lands in Phase 14.
- **Per-reagent storage in `master_panels`** — Phase 13 (SMK3-08). Calculator works against whatever shape the data model exposes; Phase 13 grows the schema.
- **PE volume formula `Total Assay ÷ SAPE concentration`** — Phase 15 (SMK3-17). Phase 12 doesn't touch PE.
- **Snapshot-frozen historical run display** — Phase 15 (SMK3-16). For Phase 12, ensure persisted-volume rehydration paths don't accidentally recompute under new rules.
- **The "computed under previous rules" advisory on old runs** — Phase 15.

### Open question — multiple 1× premix tiebreaker

The PRD says "any 1× premix wins" with no sequence dependence. If two 1× premixes are selected, the resolver must pick one deterministically. **Phase 12 should pick an unambiguous rule and document it.** Suggested defaults (planner to confirm):
1. Panel-defined order (`master_panels.premixes[0]` ordering as authored in the source xlsx), or
2. Alphabetical by premix name, or
3. First-selected (selection order — requires tracking selection order in the store).

This isn't a deferred decision so much as a 5-minute call the planner should make explicit in the plan.

</deferred>

---

*Phase: 12-smoke-3-calculator-rules*
*Context gathered: 2026-05-11 via auto-generation from INGEST-RESOLUTIONS.md (post-ingest fast path; no /gsd-discuss-phase needed — decisions already locked)*
