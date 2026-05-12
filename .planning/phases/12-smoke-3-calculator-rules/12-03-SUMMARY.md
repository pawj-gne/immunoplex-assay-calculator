---
phase: 12-smoke-3-calculator-rules
plan: 03
subsystem: calculator
tags: [calculator, store-wiring, smoke-3, integration-tests, calc-05, state-hygiene]
requires:
  - "12-01 (createCalculatorInputs 5th arg = numberOfSetups; defensive > 1000 sanity cap)"
  - "12-02 (resolveDiluent — consumable as-is via import; NOT wired into calculatorStore in this plan, deferred to Phase 13/14/15)"
provides:
  - "src/renderer/src/stores/calculatorStore.ts: numberOfSetups: number field (default 1) + setNumberOfSetups(n) validating action + corrected getOutputs() call passing numberOfSetups (not the stale deadVolume runtime number) as createCalculatorInputs 5th arg"
  - "src/renderer/src/features/run/hooks/useRunSnapshot.ts: snapshot JSON gains numberOfSetups field; deadVolume now derived from numberOfSetups × 2000 (SMK3-16 enabler — historical runs round-trip dead volume on reload)"
  - "src/renderer/src/stores/runStore.ts: loadRun reapplies calculator.setNumberOfSetups(run.numberOfSetups ?? 1) so Smoke 3 runs preserve their setups count; pre-Smoke-3 runs default to 1 (equivalent to v1.0)"
  - "src/shared/types/run.ts: RunRecord + RunCreate gain optional numberOfSetups?: number"
  - "src/shared/validation/run.ts: runCreateSchema accepts numberOfSetups as integer ≥ 1 with default 1 (backwards-compatible with legacy payloads)"
  - "src/renderer/src/lib/__tests__/calculator.integration.test.ts: 20 tests across 6 groups locking in PRD worked example + boundary rounding + CALC-05 cap regression (lib + store) + numberOfSetups round-trip"
  - ".planning/STATE.md: decisions 02-01 annotated SUPERSEDED (SMK3-06) + 02-03 annotated EXTENDED (SMK3-05)"
affects:
  - "src/renderer/src/features/calculator/hooks/useCalculator.ts (Rule-3 deviation — destructured the renamed store field; swapped deadVolume → numberOfSetups; no external consumer of useCalculator() reads .deadVolume so safe rename)"
tech-stack:
  added: []
  patterns:
    - "Optional snapshot-schema growth (numberOfSetups?: number on RunCreate + RunRecord) — backwards-compatible additive field; runs-table DB schema untouched, Phase 13 owns the column-level delta"
    - "Zod schema default-fill (z.number().int().min(1).default(1)) so legacy payloads round-trip without explicit numberOfSetups"
    - "Store-action validation (Number.isInteger + min 1 with descriptive validationError) mirrored at the pure-math layer in 12-01's createCalculatorInputs — defense in depth for SMK3-05"
    - "Zustand store action invoked headlessly in vitest via useCalculatorStore.getState() / setState() — no React render; pattern matches the existing test discipline in Plans 12-01/12-02"
key-links:
  - from: "src/renderer/src/stores/calculatorStore.ts (getOutputs)"
    to: "src/renderer/src/lib/calculator.ts (createCalculatorInputs)"
    via: "5th positional arg = numberOfSetups (NOT deadVolume); sanity cap from 12-01 never triggers"
key-files:
  created:
    - "src/renderer/src/lib/__tests__/calculator.integration.test.ts (20 tests, 6 groups)"
    - ".planning/phases/12-smoke-3-calculator-rules/12-03-SUMMARY.md (this file)"
  modified:
    - "src/renderer/src/stores/calculatorStore.ts (drop deadVolume field + DEAD_VOLUME_PER_SETUP_UL import; add numberOfSetups + setNumberOfSetups; fix getOutputs() call)"
    - "src/renderer/src/features/run/hooks/useRunSnapshot.ts (emit numberOfSetups; derive deadVolume from setups × 2000)"
    - "src/renderer/src/stores/runStore.ts (loadRun reapplies setNumberOfSetups with ?? 1 fallback)"
    - "src/shared/types/run.ts (RunRecord + RunCreate gain numberOfSetups?: number)"
    - "src/shared/validation/run.ts (runCreateSchema accepts numberOfSetups with default 1)"
    - "src/renderer/src/features/calculator/hooks/useCalculator.ts (Rule-3 deviation — swap destructured deadVolume → numberOfSetups; swap return-shape field)"
    - ".planning/STATE.md (decisions 02-01 SUPERSEDED + 02-03 EXTENDED)"
decisions:
  - "Snapshot-schema additive growth (numberOfSetups on RunCreate + RunRecord) IS the right place — without it, SMK3-16 (snapshot-frozen historical runs) cannot be satisfied: the dead-volume on disk would not be reproducible from the on-disk state. This is an enabling tweak, NOT Phase 15's work (Phase 15 owns the advisory-marker UI + audit-trail BREAKDOWN). DB schema is untouched — repository ignores unknown payload fields, and pre-Smoke-3 rows surface numberOfSetups=undefined which the loader defaults to 1."
  - "Rule-3 deviation in src/renderer/src/features/calculator/hooks/useCalculator.ts: the renamed store field broke the hook's destructure + return shape. Swapped deadVolume → numberOfSetups in both spots. No external consumer of useCalculator() reads .deadVolume — confirmed via grep — so the rename is dead-surface preservation, not a behavior change. Phase 14 may rework this hook's input surface when the Plate page exposes the numberOfSetups field; tracking as a non-blocking note."
  - "Diluent resolver (Plan 12-02) is NOT wired into calculatorStore in this plan. The plan's <objective> explicitly defers that to Phase 13/14/15: needs per-reagent panel data shape from SMK3-08 + the selectionStore's premix-concentration surface, both of which are outside Phase 12. The resolver is consumable as-is via `import { resolveDiluent } from '../lib/diluentResolver'` (renderer-side). No code in Phase 12 currently calls it; this is by design."
  - "Group F (numberOfSetups store round-trip) tests use a direct setState({ volumePerWell: 50 }) to override the default 25 µL/well so the assertions land on the canonical PRD worked-example fixture (9.4 / 13.4 mL). The store does not currently expose a setVolumePerWell action — Phase 14 may add one if the UI surface needs it; for now, calculator inputs default to 25 (DEFAULT_VOLUME_PER_WELL) and tests that need the PRD 50 µL override it imperatively."
  - "T-F2 (invalid input rejection) asserts validationError matches /setups/i rather than the exact string — keeps the test resilient to minor copy edits on the error message while still pinning the semantic content. Mirrors the calculator.ts 12-01 pattern of toThrow(/numberOfSetups/)."
metrics:
  duration: "~5m 24s"
  date_completed: "2026-05-12"
  tasks_completed: 2
  files_changed: 8
  tests_added: 20
  commits:
    - "66a665c: feat(12-03): wire numberOfSetups into calculatorStore + run snapshot"
    - "87dbbcf: test(12-03): PRD-worked-example integration suite + CALC-05 regression"
---

# Phase 12 Plan 03: calculatorStore numberOfSetups Wiring + PRD Integration Tests Summary

Renderer state-layer integration of Smoke 3 calculator rules: `calculatorStore` swaps its legacy `deadVolume: number` field for `numberOfSetups: number` (default 1) with a validating `setNumberOfSetups` action, and `getOutputs()` now passes `numberOfSetups` (not the stale 2000) as the 5th arg to `createCalculatorInputs` — repairing the defensive sanity-cap throw that Plan 12-01 deliberately left as a forcing function. Run-snapshot serialization gains a `numberOfSetups` field for SMK3-16 snapshot-fidelity (deadVolume derived from setups × 2000 at snapshot time; reload reapplies the setups count via `runStore.loadRun`). 20 new vitest cases lock in the PRD worked example end-to-end (148 wells / setups=1 → 9.4 mL; setups=3 → 13.4 mL), 0.1-mL rounding boundaries through the full pipeline, and the CALC-05 max-5-singles cap regression at both the lib (canAddSingle) and store (addSingle action) layers. STATE.md decisions 02-01 (round-to-nearest-mL) and 02-03 (DEFAULT_DEAD_VOLUME=2000) annotated SUPERSEDED / EXTENDED respectively. Full suite: 94/94 pass (74 → 94); typecheck clean. Phase 12 functionally complete.

## Objective Recap

Wire `numberOfSetups` into the renderer state layer so Plan 12-01's pure-math changes are reachable from the actual app, lock in the Smoke 3 PRD worked example end-to-end via integration tests, regress-test the CALC-05 max-5-singles cap at both lib and store layers, and retire STATE.md decision 02-01 as superseded by SMK3-06.

## What Shipped

### Task 1 — `calculatorStore` numberOfSetups field + run-snapshot serialization (commit `66a665c`)

**Store changes (`src/renderer/src/stores/calculatorStore.ts`):**
- Removed the broken `DEAD_VOLUME_PER_SETUP_UL` import that Plan 12-01 left behind transitionally.
- Replaced `deadVolume: number` field with `numberOfSetups: number` (default 1) in both the `CalculatorState` interface and `initialState`.
- Added a validating `setNumberOfSetups(n)` action: rejects non-integers and `n < 1` with a descriptive `validationError`; state stays unchanged on invalid input. No upper bound at the store layer (calculator pure-math caps > 1000 as a defensive sanity check, per Plan 12-01).
- Fixed the broken `getOutputs()` call site: destructure `numberOfSetups` from state and pass it as the 5th positional arg to `createCalculatorInputs`. The sanity-cap throw from Plan 12-01 no longer triggers because the value is always 1..N where N << 1000.
- `reset()` implicitly resets `numberOfSetups` to 1 via `initialState`.

**Snapshot fidelity (`useRunSnapshot.ts`, `runStore.ts`, `shared/types/run.ts`, `shared/validation/run.ts`):**
- `useRunSnapshot` emits `deadVolume: calculator.numberOfSetups * 2000` (computed for the persisted µL value) AND `numberOfSetups: calculator.numberOfSetups` so a Smoke 3 run round-trips its dead volume on reload (SMK3-16 enabler).
- `RunRecord` + `RunCreate` interfaces gain optional `numberOfSetups?: number`. Pre-Smoke-3 saved runs lack the field; loaders default to 1.
- `runCreateSchema` accepts `numberOfSetups` as integer ≥ 1 with `.default(1)` — backwards-compatible with legacy payloads.
- `runStore.loadRun` reapplies `calculator.setNumberOfSetups(run.numberOfSetups ?? 1)` after `setReplicateMode` + `setSampleCount`. Smoke 3 runs reload with their saved setups count; pre-Smoke-3 runs fall through to 1 (equivalent to v1.0 single-setup behavior).
- DB schema is **untouched** — `numberOfSetups` is a JSON-snapshot-only field for Phase 12. The runs-table column delta is owned by Phase 13. The run repository explicitly names the columns it writes; unknown payload fields are silently ignored.

**Rule-3 deviation (`src/renderer/src/features/calculator/hooks/useCalculator.ts`):**
- The store-field rename broke the hook's destructure + return shape. Swapped `deadVolume` → `numberOfSetups` in both spots. No external consumer of `useCalculator()` reads `.deadVolume` (confirmed via grep), so this is dead-surface preservation, not a behavior change. Phase 14 may rework this hook's input surface when the Plate page exposes the new field.

### Task 2 — Integration tests + STATE.md decision hygiene (commit `87dbbcf`)

**New test file `src/renderer/src/lib/__tests__/calculator.integration.test.ts` (20 tests, 6 groups):**

| Group | # Tests | Purpose |
|---|---|---|
| A | 1 | PRD worked example, setups=1 → 148 wells / 9400 µL / 9.4 mL (matches Plan 12-01 calculator.test.ts Group C exactly — same fixture from the consumer surface) |
| B | 1 | setups=3 variant → 13400 µL / 13.4 mL (dead-volume scaling proof) |
| C | 3 | 0.1-mL ceiling boundary cases through the full pipeline: 50.7 µL/well → 9.6 mL (rounds 9503.6 up), 50.001 → 9.5 mL (any fractional past 9.4 ceils to 9.5), minimal valid 1-sample → 3.3 mL |
| D | 9 | CALC-05 lib-level — `canAddSingle` / `getRemainingSingles` / `getMaxSingles` cap behavior across premix / premix_singles / custom; includes constant guard for `getMaxSingles('premix_singles') === 5` |
| E | 2 | CALC-05 store-level — `addSingle` action blocks the 6th single under premix_singles (silent no-op per existing implementation); 4→5 transition still works |
| F | 4 | `numberOfSetups` round-trips through the store — setNumberOfSetups(3)+volumePerWell=50+sampleCount=100 → store-derived 13400 µL / 13.4 mL match; setups=1 mirror → 9.4 mL; invalid input (0, -1, 1.5) rejected with validationError; large integers (100) accepted (no upper bound at store layer) |

**STATE.md hygiene (`.planning/STATE.md`):**
- Decision **02-01** (round to nearest mL) annotated `SUPERSEDED 2026-05-11 by Phase 12-03 + SMK3-06: final volumes round UP to nearest 0.1 mL`. Strikethrough preserved for trace.
- Decision **02-03** (DEFAULT_DEAD_VOLUME = 2000) annotated `EXTENDED 2026-05-11 by Phase 12 + SMK3-05: dead volume now numberOfSetups × 2 mL; constant renamed DEFAULT_DEAD_VOLUME → DEAD_VOLUME_PER_SETUP_UL`. Default setups = 1 preserves v1.0 backwards-compat.

## Test Fixture Inventory (downstream reuse target)

For Phases 14/15 and any future calculator refactor:

| Fixture | Inputs | Outputs |
|---|---|---|
| PRD worked example, setups=1 | 100 samples / singles / 2 plates / 50 µL/well / setups=1 | totalWells=148; rawVolume=9400; finalVolume=9400; finalVolumeML=9.4 |
| PRD setups=3 | same as above with setups=3 | totalWells=148; rawVolume=13400; finalVolume=13400; finalVolumeML=13.4 |
| Rounding 9.5036 → 9.6 | 100/singles/2/50.7/1 | rawVolume=9503.6; finalVolume=9600; finalVolumeML=9.6 |
| Rounding 9.4001 → 9.5 | 100/singles/2/50.001/1 | rawVolume=9400.148; finalVolume=9500; finalVolumeML=9.5 |
| Minimal valid 1-sample | 1/singles/1/50/1 | totalWells=25; rawVolume=3250; finalVolume=3300; finalVolumeML=3.3 |
| CALC-05 cap, 5 of 5 | requestType=premix_singles, singles.length=5, addSingle({name:'Sixth'}) | singles.length stays 5 (silent no-op) |
| CALC-05 cap, 4→5 transition | requestType=premix_singles, singles.length=4, addSingle({name:'Fifth'}) | singles.length becomes 5 |

## PRD Worked Example Re-confirmation (matches Plan 12-01)

Plan 12-01's calculator.test.ts Group C asserted these values at the pure-math layer. This plan's `calculator.integration.test.ts` Groups A + B + F re-assert them through:
1. The pure helpers from outside the store (`createCalculatorInputs` + `calculateVolumes`) — Groups A and B (proves the lib layer is reachable as documented).
2. The actual Zustand store's `getOutputs()` path — Group F T-F1 / T-F1b (proves the renderer-state surface produces the same values once `numberOfSetups` is wired).

Both paths agree on 9.4 mL (setups=1) and 13.4 mL (setups=3). Tolerance: `toBeCloseTo(_, 1)` for `finalVolumeML` to absorb IEEE-754 representation noise; exact `.equals(new Decimal(...))` for `finalVolume` / `rawVolume` (Decimal arithmetic is exact).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 — Blocking issue] `useCalculator.ts` hook destructured the renamed store field**

- **Found during:** Task 1 typecheck step
- **Issue:** Removing the `deadVolume: number` field from the calculatorStore broke `src/renderer/src/features/calculator/hooks/useCalculator.ts:18` (destructure) and `:69` (return-shape field), causing `npm run typecheck:web` to error: `Property 'deadVolume' does not exist on type 'CalculatorState'`. This violated plan acceptance criterion (`npm run typecheck` exits 0).
- **Fix:** Swapped `deadVolume` → `numberOfSetups` in both the destructure and the return shape. Verified no external consumer of `useCalculator()` reads `.deadVolume` via grep across `src/renderer/`. Phase 14 may rework this hook's input surface when the Plate page exposes the new field; tracked as a non-blocking note in the decisions block.
- **Files modified:** `src/renderer/src/features/calculator/hooks/useCalculator.ts` (lines 13–24 destructure + 63–70 return shape)
- **Commit:** `66a665c` (folded into Task 1 since it's a direct consequence of the store-field rename in the same commit)

### Plan-allowed scope additions

- **20 tests instead of the ≥ 14 minimum.** The plan's `<behavior>` enumerated ≥ 14 cases across Groups A–E; in practice, splitting boundary rounding into 3 cases (Group C T-C1 / T-C2 / T-C3) and adding a Group F (`numberOfSetups` store round-trip — 4 cases including the rejected-input variants and the setups=1 mirror of T-F1) yielded 20. The extra Group F is a natural complement to Task 1's `setNumberOfSetups` action — without those tests, the action is exercised only via typecheck, not via runtime behavior.
- **Snapshot-schema growth (numberOfSetups on RunCreate + RunRecord) IS in scope per the plan's `<context>` explicit decision** ("FINAL decision for snapshot: This plan WILL add numberOfSetups to the JSON shape returned by useRunSnapshot."). The shared-types update + Zod schema default-fill are the implementation details that decision required. Recording here for trace, not as a deviation.

### Out-of-scope items deliberately left for later phases

- **Diluent resolver wiring into calculatorStore.** Plan 12-02's `resolveDiluent` is consumable as-is (`import { resolveDiluent } from '../lib/diluentResolver'`) but is NOT yet called from any store or component in this plan — that's Phase 13/14/15 work once per-reagent panel data lands (SMK3-08) and the selectionStore exposes the premix-concentration surface required by the resolver's `SelectedPremixForDiluent[]` input shape.
- **`numberOfSetups` UI input on the Plate page.** Phase 14 / SMK3-04 work. The calculator surface exists; the UI is downstream.
- **"Computed under previous rules" advisory marker on historical run-doc display.** Phase 15 / SMK3-16 advisory-marker UI. This plan's snapshot-schema growth is the enabler; the marker UI itself is Phase 15's deliverable.

## Known Stubs

None — every change is fully wired against its input contract.

## Threat Flags

None — Phase 12 is pure offline math + in-memory state-store wiring. No new network surface, no SQL, no HTML, no IPC. The `setNumberOfSetups` action validates input (integer ≥ 1, no upper bound) defensively to prevent NaN/Infinity propagating through decimal.js, but this is correctness-hardening, not adversary defense.

## Important Notes for Phase 13+

1. **DB schema delta is Phase 13's responsibility.** The runs-table currently lacks a `number_of_setups` column. Today, the snapshot's `numberOfSetups` field is dropped at the repository layer (repository inserts/updates only the columns it explicitly names). This is fine for SMK3-16 in Phase 12 because the `deadVolume` column DOES round-trip (we now compute it from setups × 2000 at snapshot time). When Phase 13 adds the column, drop the snapshot-time multiplication in `useRunSnapshot.ts` and let the column persist `numberOfSetups` directly; the loader will see the value flow back through `getById()` automatically.
2. **Phase 14 (Plate page UI):** Wire a numeric input on the Plate page to `useCalculatorStore.getState().setNumberOfSetups`. The action already validates; the UI only needs to call it on change. Default value comes from the store's initial state (1).
3. **Phase 15 (Run-doc advisory marker):** When loading a run where `run.numberOfSetups === undefined`, emit the "Computed under previous rules" marker per SMK3-16. The current `runStore.loadRun` defaults to 1 silently — the marker is the UX layer that says "this run was saved before the setups field existed."

## Verification Evidence

- `npx vitest run src/renderer/src/lib/__tests__/calculator.integration.test.ts`: **20/20 passed.**
- `npm test` (full vitest): **12 files, 94/94 passed** (74 prior → 94 with this plan, +20).
- `npm run typecheck` (node + web): **clean exit.**
- `grep -rE "DEFAULT_DEAD_VOLUME|roundUpToNearestML" src/`: **zero hits.**
- `grep -nE "^\s*numberOfSetups:\s*1" src/renderer/src/stores/calculatorStore.ts`: 1 hit (initialState).
- `grep -c "numberOfSetups" src/renderer/src/stores/calculatorStore.ts`: 8 hits.
- `grep -nE "setNumberOfSetups" src/renderer/src/stores/calculatorStore.ts`: 2 hits (interface + action implementation).
- `grep -nE "createCalculatorInputs\([^)]*numberOfSetups" src/renderer/src/stores/calculatorStore.ts`: matched via multi-line grep — line 190 passes `numberOfSetups` as the 5th positional arg.
- `grep -nE "calculator\.deadVolume" src/renderer/src/features/run/hooks/useRunSnapshot.ts`: **zero hits** (replaced with computed `numberOfSetups * 2000`).
- `grep -nE "numberOfSetups:\s*calculator\.numberOfSetups" src/renderer/src/features/run/hooks/useRunSnapshot.ts`: 1 hit.
- `grep -nE "calculator\.setNumberOfSetups" src/renderer/src/stores/runStore.ts`: 1 hit (in loadRun).
- `grep -c "^\s*it\(" src/renderer/src/lib/__tests__/calculator.integration.test.ts`: 20.
- `grep -E "02-01.*SUPERSEDED.*SMK3-06" .planning/STATE.md`: 1 hit.
- `grep -E "02-03.*EXTENDED.*SMK3-05" .planning/STATE.md`: 1 hit.

## Self-Check: PASSED

Files created (verified present):
- FOUND: `src/renderer/src/lib/__tests__/calculator.integration.test.ts`
- FOUND: `.planning/phases/12-smoke-3-calculator-rules/12-03-SUMMARY.md`

Commits (verified in git log):
- FOUND: `66a665c` (Task 1)
- FOUND: `87dbbcf` (Task 2)
