---
phase: 12-smoke-3-calculator-rules
verified: 2026-05-11T21:05:00Z
status: gaps_found
score: 9/11 must-haves verified
overrides_applied: 0
gaps:
  - truth: "Loading a persisted run (runStore.loadRun) does NOT recompute the run's volumes under new rules — persisted finalVolume / deadVolume are surfaced as-is (snapshot-frozen per SMK3-16 carryover)"
    status: partial
    reason: "loadRun threads numberOfSetups but does NOT restore the persisted volumePerWell. Any run saved with a non-default volumePerWell (e.g. the PRD worked example uses 50 µL/well; the v1.0 default is 25 µL) silently recomputes against 25 on reload, producing a different displayed total volume than was persisted. The integration test (Group F) exercises setNumberOfSetups directly on the store and never the runStore.loadRun cascade, so the regression bar for the snapshot-frozen contract is currently untested."
    artifacts:
      - path: "src/renderer/src/stores/runStore.ts"
        issue: "loadRun (lines 88-155) reapplies replicateMode, sampleCount, numberOfSetups — but never volumePerWell. Falls back to DEFAULT_VOLUME_PER_WELL (25 µL) on reload."
      - path: "src/renderer/src/stores/calculatorStore.ts"
        issue: "No public setVolumePerWell action — would need to be added (or runStore must call setState directly) for loadRun to restore the field."
      - path: "src/renderer/src/lib/__tests__/calculator.integration.test.ts"
        issue: "Group F (T-F1 / T-F1b / T-F2 / T-F3) drives the store via setNumberOfSetups / setSampleCount / setState. It never invokes useRunStore.getState().loadRun(...). The must_have on snapshot-frozen behavior is documented in the test file's header comment but not actually asserted end-to-end."
    missing:
      - "Add setVolumePerWell action (or equivalent setState path) on calculatorStore so runStore.loadRun can restore the persisted per-well volume."
      - "In runStore.loadRun, restore run.volumePerWell BEFORE setNumberOfSetups (so getOutputs() — if called in between — uses the persisted value, not the default)."
      - "Add an integration test that mocks window.electronAPI.run.getById and exercises useRunStore.getState().loadRun(...) end-to-end, asserting that a run saved with volumePerWell=50 + numberOfSetups=3 reloads with the same finalVolumeML on getOutputs()."
  - truth: "calculatorStore.getOutputs() passes numberOfSetups (NOT the old deadVolume runtime number) as the 5th argument to createCalculatorInputs — the defensive sanity-cap from Plan 12-01 never triggers because the value is always 1..N where N << 1000"
    status: partial
    reason: "The wiring of numberOfSetups → createCalculatorInputs is correct (lines 184-190 of calculatorStore.ts pass numberOfSetups). However setNumberOfSetups (lines 122-133) accepts arbitrarily large integers with no upper bound at the store layer, while createCalculatorInputs throws when numberOfSetups > 1000 (calculator.ts:158-162). A user (or future code path) calling setNumberOfSetups(1500) then getOutputs() triggers an uncaught synchronous throw inside React render — surfacing as a white-screen unless an ErrorBoundary catches it. Code review WR-04 flagged this; the must_have is still partially met (no current code path hits >1000) but the boundary mismatch leaves an unguarded exception path."
    artifacts:
      - path: "src/renderer/src/stores/calculatorStore.ts"
        issue: "setNumberOfSetups validates Number.isInteger && >= 1 but no upper bound; comment on lines 37-39 acknowledges the mismatch but doesn't guard it. getOutputs() does not wrap the createCalculatorInputs call in try/catch."
      - path: "src/renderer/src/lib/calculator.ts"
        issue: "Lines 158-162 throw on numberOfSetups > 1000; this throw propagates uncaught through getOutputs() → React render."
    missing:
      - "Either align bounds (enforce >= 1 && <= 1000 in setNumberOfSetups) OR wrap getOutputs() in try/catch and convert the throw into validationError + null return."
      - "Add a test (Group F extension) covering setNumberOfSetups(1500); should either be rejected (preferred) or produce a validationError without throwing."
deferred:
  - truth: "Run document advisory marker 'Computed under previous calculation rules' for pre-Smoke-3 historical runs"
    addressed_in: "Phase 15"
    evidence: "Phase 15 success criteria 4: 'Historical runs (saved before Smoke 3 ships) reload showing the volumes that were persisted at save time. No retroactive recompute. Run document carries a small advisory note when reopening a pre-Smoke-3 run: \"Computed under previous calculation rules.\"' (SMK3-16)"
  - truth: "Number of Setups numeric input on the Plate page"
    addressed_in: "Phase 14"
    evidence: "Phase 14 success criteria 1: 'Plate page renders three numeric inputs above the existing sample-count field: Old Beads (mL), Old Antibodies (mL), Number of Setups. Defaults: 0, 0, 1. Min: 0, 0, 1. No upper bound.' (SMK3-04)"
  - truth: "Diluent resolver wired into calculatorStore + run document display"
    addressed_in: "Phase 13/14/15"
    evidence: "Plan 12-03 §Out-of-scope: 'Diluent resolver wiring into store state (Phase 13/14/15 — needs per-reagent panel data shape from SMK3-08 first; Phase 12's resolver works in isolation)'. Phase 15 success criteria 1 covers run-document display of diluent decision."
  - truth: "Per-reagent panel data (Values-table diluent strings) populated from xlsx"
    addressed_in: "Phase 13"
    evidence: "Phase 13 success criteria 2: 'Each parsed sheet exposes: panel metadata ... per-reagent rows (Beads / Antibodies / SAPE — each with Concentration / Diluent / Volume per well; variable cells ignored)' (SMK3-08)"
---

# Phase 12: Smoke 3 Calculator Rules Migration — Verification Report

**Phase Goal:** Migrate three locked calculator rules from v1/v2 baselines to the Smoke 3 PRD spec — all in pure calculator logic. Volume rounding 0.1 mL ceiling (SMK3-06), dead volume `numberOfSetups × 2 mL` (SMK3-05), concentration-keyed diluent resolution (SMK3-07), and explicit CALC-05 max-5-singles cap retention.

**Verified:** 2026-05-11
**Status:** gaps_found
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | Final volumes round UP to nearest 0.1 mL (ceiling at 0.1 mL precision) | VERIFIED | `ceilToTenthML` in decimal.ts:44-48 uses `Decimal.toDecimalPlaces(1, ROUND_CEIL)`. calculator.ts:75-77 `calculateFinalVolume` consumes it. 9 cases in decimal.test.ts + 3 in calculator.test.ts Group A + 3 in calculator.integration.test.ts Group C all green. |
| 2 | Exactly-zero raw volume stays exactly zero after rounding (no upward bump from 0) | VERIFIED | decimal.test.ts test case `ceilToTenthML(createVolume(0, 'uL'))` → 0 µL (passing). |
| 3 | Dead volume scales with number_of_setups: dead = setups × 2 mL | VERIFIED | calculator.ts:163 `deadVolumeUL = numberOfSetups * DEAD_VOLUME_PER_SETUP_UL`. Constant DEAD_VOLUME_PER_SETUP_UL = 2000 µL in shared/constants/calculator.ts:22. Group B (setups=3 → 13.4 mL) and Group F (T-F1 store-level 13.4 mL) both green. |
| 4 | createCalculatorInputs accepts numberOfSetups parameter that defaults to 1 (backwards-compatible) | VERIFIED | calculator.ts:151 — signature `numberOfSetups: number = 1`. Validation lines 153-162 rejects non-integer / <1 / >1000 with descriptive errors. calculator.test.ts Group B exhausts the boundary. |
| 5 | When ANY selected premix has concentration === 1, that premix is returned as the diluent for both Beads and Antibodies (1× premix wins) | VERIFIED | diluentResolver.ts:48-52 — first-1×-in-array wins. diluentResolver.test.ts Group A (6 cases — T-A1..T-A6) verifies: single 1× wins, multi-premix-with-1× wins, reverse-order, beats values_table fallback. |
| 6 | When NO 1× premix selected, resolver returns kind='values_table' with verbatim per-reagent strings (no normalization) | VERIFIED | diluentResolver.ts:55-61 returns valuesTable.beads / .antibodies unchanged. diluentResolver.test.ts T-B3 explicitly locks whitespace `'  L-AB '` and case `'N/A'` preservation. |
| 7 | When panel has no Values-table data (legacy v0.7.0), resolver returns kind='legacy' with beads=null, antibodies=null | VERIFIED | diluentResolver.ts:64 — `return { kind: 'legacy', beads: null, antibodies: null }`. T-C1 + T-C2 cases assert. |
| 8 | When multiple selected premixes are 1×, resolver picks FIRST in input array (deterministic, caller-controlled) | VERIFIED | T-A4 and T-A5 in diluentResolver.test.ts opposing-order pair proves input-array-order, not alphabetical. |
| 9 | calculatorStore exposes numberOfSetups: number (default 1, integer ≥ 1) and setNumberOfSetups action that validates and rejects invalid input | VERIFIED | calculatorStore.ts:40 (field), :70 (initialState default 1), :122-133 (action with Number.isInteger + min 1 validation; sets validationError on reject). Test T-F2 covers 0/-1/1.5 rejection. |
| 10 | calculatorStore.getOutputs() passes numberOfSetups (NOT the old deadVolume runtime number) as 5th arg to createCalculatorInputs | PARTIAL | Wiring is correct (calculatorStore.ts:184-190). However setNumberOfSetups has no upper bound while createCalculatorInputs throws at >1000 — an uncaught throw path through React render exists (WR-04). |
| 11 | Loading a persisted run (runStore.loadRun) does NOT recompute the run's volumes under new rules — persisted finalVolume / deadVolume surfaced as-is (SMK3-16 carryover) | PARTIAL | runStore.ts:133 reapplies numberOfSetups (good for Smoke 3 runs that round-trip 6000 → 6000 via the formula). But volumePerWell is never restored on load — any run with non-default volumePerWell (e.g. the PRD 50 µL/well) silently rewrites to 25 µL on reload. No integration test exercises the loadRun cascade end-to-end. |
| 12 | The PRD worked example (148 wells × 0.05 mL/well + 2 mL dead, setups=1) produces totalWells=148 / finalVolumeML=9.4 end-to-end | VERIFIED | calculator.integration.test.ts T-A1 (lib layer) + T-F1b (store layer) both assert exact values: totalWells=148, rawVolume=9400 µL, finalVolume=9400 µL, finalVolumeML≈9.4. With setups=3: 13400 µL / 13.4 mL (T-B1 + T-F1). |
| 13 | CALC-05 max-5-singles cap still blocks a 6th single under premix_singles | VERIFIED | calculator.ts:207-210 `canAddSingle` returns false at cap. calculatorStore.ts:138 `addSingle` short-circuits via canAddSingle. Group D (T-D1..T-D9 lib-level — 9 cases) + Group E (T-E1 / T-E2 store-level — 6th-blocked, 4→5 allowed) all green. |
| 14 | STATE.md decision 02-01 annotated SUPERSEDED with reference to phase 12 + SMK3-06 | VERIFIED | STATE.md line 95: `02-01: ~~Final volume always rounds UP to nearest mL~~ — SUPERSEDED 2026-05-11 by Phase 12-03 + SMK3-06`. Line 99 also annotates 02-03 EXTENDED by SMK3-05. |

**Score: 9/11 must-haves fully verified, 2 partial (truths #10 and #11 — both flagged in 12-REVIEW.md as warnings, not blockers; the wiring works for the in-scope happy path)**

Note: the truths above are de-duplicated from 3 plans + ROADMAP success criteria. Some are split (e.g. truth #1 covers ROADMAP SC #1; truths #5–#8 cover ROADMAP SC #3).

### Deferred Items

Items not yet met but explicitly addressed in later milestone phases.

| # | Item | Addressed In | Evidence |
|---|------|--------------|----------|
| 1 | "Computed under previous calculation rules" advisory marker on pre-Smoke-3 run-doc reopen | Phase 15 | Phase 15 SC #4: "Run document carries a small advisory note when reopening a pre-Smoke-3 run." |
| 2 | Number of Setups UI input on Plate page | Phase 14 | Phase 14 SC #1: explicit numeric input with default 1, min 1. |
| 3 | Diluent resolver wired into calculatorStore + run document display | Phase 13/14/15 | Plan 12-03 §Out-of-scope explicitly defers; Phase 15 SC #1 covers run-doc diluent decision. |
| 4 | Per-reagent panel data (Values-table) from xlsx parser | Phase 13 | Phase 13 SC #2: per-reagent rows including Concentration / Diluent / Volume per well. |

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `src/renderer/src/lib/decimal.ts` | exports ceilToTenthML; roundUpToNearestML deleted | VERIFIED | ceilToTenthML at line 44; roundUpToNearestML gone (grep returns 0 hits across src/). |
| `src/renderer/src/lib/calculator.ts` | calculateFinalVolume uses ceilToTenthML; createCalculatorInputs accepts numberOfSetups (default 1); sanity cap >1000 | VERIFIED | Line 19 import; line 76 caller; line 151 sig; lines 158-162 sanity cap. |
| `src/renderer/src/lib/diluentResolver.ts` | resolveDiluent + DiluentResult; concentration-keyed; verbatim strings | VERIFIED | 74 lines incl. JSDoc; pure function; zero imports from panel.ts / analyte.ts / calculator.ts (decoupled). |
| `src/shared/types/diluent.ts` | DiluentResult discriminated union exported | VERIFIED | DiluentKind + DiluentResult + SelectedPremixForDiluent + PanelValuesDiluent. |
| `src/shared/types/calculator.ts` | CalculatorInputs.numberOfSetups: number | VERIFIED | Lines 14-15 (in CalculatorInputs); line 83 (CalculatorState). Note IN-06: CalculatorState.deadVolume legacy field still present (unused — see info findings). |
| `src/shared/constants/calculator.ts` | DEAD_VOLUME_PER_SETUP_UL = 2000; no DEFAULT_DEAD_VOLUME | VERIFIED | Line 22; old constant fully removed (grep zero hits). |
| `src/renderer/src/stores/calculatorStore.ts` | numberOfSetups field + setNumberOfSetups + getOutputs threading | VERIFIED | Field line 40, default 1 line 70, action 122-133, getOutputs 174-193. |
| `src/renderer/src/stores/runStore.ts` | loadRun threads numberOfSetups | PARTIAL | Line 133 reapplies numberOfSetups. **BUT volumePerWell is NOT restored** (gap — see Truth #11). |
| `src/renderer/src/features/run/hooks/useRunSnapshot.ts` | emits numberOfSetups | VERIFIED | Line 106 emits numberOfSetups; line 105 derives deadVolume from setups × 2000 (note IN-01: hardcoded 2000 instead of imported constant — info-level smell). |
| `src/renderer/src/lib/__tests__/calculator.integration.test.ts` | PRD worked example 9.4 / 13.4 mL + CALC-05 regression + snapshot-frozen loadRun group | PARTIAL | 20 tests pass (Group A-F). **Group F does NOT actually exercise runStore.loadRun**; it drives setNumberOfSetups directly. The "snapshot-frozen loadRun" must_have is documented in the test header but not asserted end-to-end. |
| `src/renderer/src/lib/__tests__/decimal.test.ts` | ceilToTenthML tests | VERIFIED | 9 tests passing. |
| `src/renderer/src/lib/__tests__/calculator.test.ts` | ceiling + setups tests | VERIFIED | 13 tests passing (3 Group A rounding + 8 Group B setups + 2 Group C end-to-end). |
| `src/renderer/src/lib/__tests__/diluentResolver.test.ts` | 14 tests covering 4 fixture scenarios + edge cases | VERIFIED | 14 tests passing, 5 describe groups. |
| `.planning/STATE.md` | decision 02-01 SUPERSEDED annotation | VERIFIED | Lines 95 (02-01 SUPERSEDED) and 99 (02-03 EXTENDED). |

### Key Link Verification

| From | To | Via | Status | Details |
|------|-----|-----|--------|---------|
| calculator.ts (calculateFinalVolume) | decimal.ts (ceilToTenthML) | direct import; replaces roundUpToNearestML | WIRED | Line 19 import, line 76 call. roundUpToNearestML fully deleted (grep zero hits). |
| calculator.ts (createCalculatorInputs) | shared CalculatorInputs.numberOfSetups | function-sig parameter with default 1 | WIRED | Line 151 `numberOfSetups: number = 1`; line 168 placed in returned object. |
| calculatorStore.ts (getOutputs) | calculator.ts (createCalculatorInputs) | 5th positional arg is numberOfSetups | WIRED | calculatorStore.ts:184-190 passes numberOfSetups as 5th arg. Sanity cap never triggered (max in tests = 100). |
| calculatorStore.ts | shared/constants/calculator.ts | removed import of DEAD_VOLUME_PER_SETUP_UL | WIRED | Store imports only DEFAULT_VOLUME_PER_WELL + types; does not surface the dead-volume constant directly. |
| diluentResolver.ts | shared/types/diluent.ts | type re-export so renderer + main share one source of truth | WIRED | Lines 1-5 type imports; lines 67-73 re-export. |
| diluentResolver.ts | (panel.ts / analyte.ts / calculator.ts) | **MUST NOT import these — decoupling check** | WIRED (decoupled) | grep `from.*['"]\\.\\./(panel|analyte|calculator)` returns ZERO hits. Resolver works against structural SelectedPremixForDiluent input. |
| useRunSnapshot.ts | calculatorStore.numberOfSetups | snapshot JSON emission | WIRED | Line 106 emits `numberOfSetups: calculator.numberOfSetups`. |
| runStore.loadRun | calculatorStore.setNumberOfSetups | rehydration after setReplicateMode + setSampleCount | WIRED | Line 133 calls `calculator.setNumberOfSetups(run.numberOfSetups ?? 1)`. |
| runStore.loadRun | calculatorStore.volumePerWell | rehydration of persisted per-well volume | **NOT WIRED** | No call to a setVolumePerWell action (action doesn't exist); no setState fallback. WR-01 in code review. **This is the basis of Truth #11 PARTIAL.** |

### Data-Flow Trace (Level 4)

Phase 12 is pure calculator logic; no UI components ship in this phase that render dynamic data outside what's already covered by the integration test. The relevant data-flow is verified at test level.

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|--------------|--------|--------------------|--------|
| calculatorStore.getOutputs() | finalVolumeML, rawVolume | createCalculatorInputs → calculateVolumes | Real (Decimal math through pure functions, validated by 20 integration tests) | FLOWING |
| useRunSnapshot.buildRunSnapshot | numberOfSetups, deadVolume | calculatorStore state read at snapshot time | Real | FLOWING |
| runStore.loadRun cascade | numberOfSetups | run.numberOfSetups (DB JSON snapshot) | Real (with ?? 1 fallback for legacy) | FLOWING |
| runStore.loadRun cascade | volumePerWell | (NOT RESTORED — falls back to default 25 µL) | **No** | **DISCONNECTED** (basis of Truth #11) |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| Full vitest suite passes | `npm test` | 12 files, 94 passed (94) | PASS |
| TypeScript clean | `npm run typecheck` | clean exit (node + web) | PASS |
| Old constants fully removed | `grep -rn "DEFAULT_DEAD_VOLUME\\|roundUpToNearestML" src/` | zero hits | PASS |
| New constant referenced | `grep -rn "DEAD_VOLUME_PER_SETUP_UL" src/` | 7 hits (constant + calc.ts × 3 + types × 2 + store comment) | PASS |
| ceilToTenthML wired | `grep -rn "ceilToTenthML" src/` | 17 hits (decl + caller + 15 test references) | PASS |
| resolveDiluent wired | `grep -rn "resolveDiluent" src/` | 18 hits (decl + 17 test references) — NO production caller yet (deferred to Phase 13/14/15 by design) | PASS |
| Diluent resolver decoupled | `grep -E "from.*['\"]\\.\\./(.*panel\\|.*analyte\\|.*calculator)" src/renderer/src/lib/diluentResolver.ts` | zero hits | PASS |
| numberOfSetups in store | `grep -nE "numberOfSetups" src/renderer/src/stores/calculatorStore.ts` | 8 hits (interface, default, action body, getOutputs destructure + arg, comments) | PASS |

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|------------|-------------|-------------|--------|----------|
| SMK3-05 | 12-01, 12-03 | Dead volume = `numberOfSetups × 2 mL`; default 1; rejects <1 | SATISFIED | calculator.ts:163; store action validation 122-133; test coverage in calculator.test.ts Group B + integration Group B/F. |
| SMK3-06 | 12-01, 12-03 | Final volumes round UP to nearest 0.1 mL | SATISFIED | ceilToTenthML in decimal.ts:44; calculator.ts:76; decimal.test.ts (9 cases) + integration Group C boundary tests. |
| SMK3-07 | 12-02, 12-03 | Diluent: any 1× premix wins; else Values-table per reagent; else legacy | SATISFIED | diluentResolver.ts:48-64; 14 tests across 4 groups in diluentResolver.test.ts. **Note: resolver is decoupled and consumable but NOT yet wired into calculatorStore — deferred to Phase 13/14/15 by explicit plan design.** |
| CALC-03 (extended) | 12-01, 12-03 | App includes dead volume in all volume calculations | SATISFIED | calculator.ts:64 calculateRawVolume; calculator.ts:163 deadVolume derivation. REQUIREMENTS.md annotated EXTENDED by SMK3-05. |
| CALC-05 (retained) | 12-03 | Max 5 singles cap when premix selected | SATISFIED | calculator.ts:207-210 canAddSingle; calculatorStore.ts:138 addSingle short-circuit; integration Group D (9 cases) + Group E (2 cases). REQUIREMENTS.md annotated RETAINED 2026-05-11. |
| CALC-06 (superseded) | 12-01 | OLD rule "round up to nearest mL" | SATISFIED via supersession | REQUIREMENTS.md strikethrough + SUPERSEDED annotation; STATE 02-01 SUPERSEDED. No code path remains. |

All Phase 12 requirements per ROADMAP and PLAN frontmatter are accounted for. No orphaned requirements detected.

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| useRunSnapshot.ts | 105 | Hardcoded `2000` instead of `DEAD_VOLUME_PER_SETUP_UL` import | Info | If constant changes in future SMK3 amendment, this drifts silently (WR-01 in 12-REVIEW.md → renamed IN-01) |
| diluentResolver.ts | 49 | Strict `=== 1` float equality on `concentration` | Info | Preventive only — if Phase 13 parser produces `1.0000000001`, the 1× premix would be missed (IN-02 in review) |
| calculator.integration.test.ts | 265-282 | Missing test for validationError clear on valid setNumberOfSetups | Info | Uncovered branch in calculatorStore line 132 (IN-03 in review) |
| useRunSnapshot.ts | 138-144 | useMemo dep list omits calculator slices that buildRunSnapshot reads | Info | Disabled exhaustive-deps lint hides stale-data risk for any caller reading `result` (IN-04 in review) |
| useRunSnapshot.ts + validation/run.ts | 101-106 + 24,28 | `RunCreate.deadVolume` and `numberOfSetups` independently validated; no superRefine cross-field check that `deadVolume === numberOfSetups × 2000` | Info | Possible disagreement at round-trip if schema defaults differ (IN-05 in review) |
| shared/types/calculator.ts | 86 | `CalculatorState.deadVolume: number` still declared in legacy unused type shape | Info | Dead surface; no consumer reads `CalculatorState` directly (IN-06 in review) |
| shared/constants/calculator.ts | 28 | `MAX_SINGLES_CUSTOM = Infinity` sentinel | Info | v1.0 carry-over; works but exposes Infinity to UI display code (IN-07 in review) |
| runStore.ts | 133 | `setNumberOfSetups` is the SOLE source of dead-volume restoration; legacy persisted `deadVolume` is silently dropped if it diverges from `numberOfSetups × 2000` | Warning | Smoke 3 runs round-trip faithfully (formula reproduces exact value). Pre-Smoke-3 runs with non-2000 µL legacy deadVolume silently rewrite on reload. WR-02 in review. Phase 15 advisory marker is the planned UX mitigation. |
| runStore.ts | 128-138 | `loadRun` does NOT restore `run.volumePerWell` — falls back to `DEFAULT_VOLUME_PER_WELL` (25 µL) | **Warning** | **Any run saved with non-default volumePerWell (PRD worked example uses 50 µL/well) silently rewrites on reload. WR-01 in review. This is the basis of gap #1 above.** |
| calculatorStore.ts (setNumberOfSetups) + calculator.ts (createCalculatorInputs) | 122-133 + 158-162 | Bound mismatch: store accepts arbitrary integers; lib throws at >1000 | **Warning** | Uncaught synchronous throw path from React render. WR-04 in review. This is the basis of gap #2 above. |
| calculator.integration.test.ts | 222-289 (Group F) | Documented as "Snapshot-frozen historical-run preservation (SMK3-16 enabler)" but never invokes `useRunStore.getState().loadRun(...)` | **Warning** | Cannot catch WR-01 or WR-02. The snapshot-freeze must_have is asserted via documentation comment, not via test code. WR-03 in review. |

### Human Verification Required

None required for an automated verification — the calculator math layer is fully testable, all assertions pass programmatically. The two gaps below are code-level issues that the gap-closure planner can address without human testing. (Human testing would only be required if the gaps are deferred AS-IS to Phase 15, in which case the workflow already calls for manual Windows-build verification at Phase 16.)

### Gaps Summary

Phase 12 ships the calculator-rules migration cleanly at the pure-math layer:
- ceilToTenthML helper + calculateFinalVolume call-site swap (SMK3-06): correctly drops STATE decision 02-01.
- numberOfSetups parameter + dead-volume formula (SMK3-05): correctly extends CALC-03.
- Concentration-keyed diluent resolver (SMK3-07): correctly supersedes the request-type-keyed rule.
- CALC-05 max-5-singles cap regression at both lib and store layers: correctly retained per R-05.
- STATE.md 02-01 / 02-03 annotated.

**Two gaps remain, both flagged in 12-REVIEW.md as warnings:**

**Gap 1 — Snapshot-frozen loadRun is incomplete (WR-01 + WR-03).** Plan 12-03's truth that "Loading a persisted run does NOT recompute the run's volumes under new rules" is only partially honored. `runStore.loadRun` reapplies `numberOfSetups` (correct) but not `volumePerWell` — any run saved with non-default 50 µL/well silently rewrites to 25 on reload. Group F of the integration test never exercises `runStore.loadRun` (it drives `setNumberOfSetups` directly), so the regression bar is documentation-only.

**Why this is a real Phase 12 gap, not deferrable to Phase 15:** Plan 12-03 explicitly listed this truth in its `must_haves.truths` array. The PRD worked example (148 wells × 50 µL/well → 9.4 mL) cannot round-trip through save+load today; saving 9.4 and reloading produces a different displayed value. Phase 15's advisory marker (per ROADMAP SC #4) is the UX layer that says "this was computed under previous rules" — but Phase 15 cannot satisfy SMK3-16 if the values themselves silently change on reload. Phase 12's contract is to provide a faithful snapshot-freeze; Phase 15 layers the advisory marker on top.

**Gap 2 — getOutputs() exception propagation (WR-04).** Plan 12-03's truth that "the defensive sanity-cap from Plan 12-01 never triggers" holds for the in-scope happy path but the boundary between `setNumberOfSetups` (no upper bound) and `createCalculatorInputs` (throws at >1000) is unguarded. A future code path or operator entering numberOfSetups=1500 produces an uncaught synchronous throw inside React render. Phase 14 will introduce a UI input for this field; without alignment, that UI either needs its own bounding logic or the calculator store needs to absorb the cap.

**Both gaps are surgically scoped:** Gap 1 requires adding a `setVolumePerWell` action (or setState fallback) + a loadRun line + 1-2 integration tests with `vi.spyOn` on `window.electronAPI.run.getById`. Gap 2 requires aligning bounds in `setNumberOfSetups` or wrapping `getOutputs()` in try/catch — and a single test asserting the rejection path. Neither requires re-doing any Phase 12 work; they are completion items for the calculator-rules migration contract.

---

_Verified: 2026-05-11_
_Verifier: Claude (gsd-verifier)_
