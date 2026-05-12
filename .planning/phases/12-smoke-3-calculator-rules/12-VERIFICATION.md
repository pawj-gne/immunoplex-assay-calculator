---
phase: 12-smoke-3-calculator-rules
verified: 2026-05-11T22:30:00Z
status: passed
score: 11/11 must-haves verified
overrides_applied: 0
re_verification:
  previous_status: gaps_found
  previous_score: 9/11
  gaps_closed:
    - "Truth #11 — runStore.loadRun does NOT restore volumePerWell; integration tests never exercise the loadRun cascade end-to-end (WR-01 + WR-03)"
    - "Truth #10 — setNumberOfSetups bound mismatch; lib throws at >1000 but store accepts arbitrary integers (WR-04)"
  gaps_remaining: []
  regressions: []
deferred:
  - truth: "Run document advisory marker 'Computed under previous calculation rules' for pre-Smoke-3 historical runs"
    addressed_in: "Phase 15"
    evidence: "Phase 15 success criteria 4 (SMK3-16): historical runs reload showing the volumes that were persisted at save time + advisory note"
  - truth: "Number of Setups numeric input on the Plate page"
    addressed_in: "Phase 14"
    evidence: "Phase 14 success criteria 1 (SMK3-04): Plate page renders Number of Setups input (default 1, min 1, no upper bound at UI layer)"
  - truth: "Diluent resolver wired into calculatorStore + run document display"
    addressed_in: "Phase 13/14/15"
    evidence: "Plan 12-03 §Out-of-scope defers; Phase 15 success criteria 1 covers run-doc diluent decision display"
  - truth: "Per-reagent panel data (Values-table diluent strings) populated from xlsx parser"
    addressed_in: "Phase 13"
    evidence: "Phase 13 success criteria 2 (SMK3-08): per-reagent rows with Concentration / Diluent / Volume per well"
---

# Phase 12: Smoke 3 Calculator Rules Migration — Verification Report (Re-verification)

**Phase Goal:** Migrate three locked calculator rules from v1/v2 baselines to the Smoke 3 PRD spec — all in pure calculator logic. Volume rounding 0.1 mL ceiling (SMK3-06), dead volume `numberOfSetups × 2 mL` (SMK3-05), concentration-keyed diluent resolution (SMK3-07), and explicit CALC-05 max-5-singles cap retention.

**Verified:** 2026-05-11T22:30:00Z
**Status:** passed
**Re-verification:** Yes — after Plan 12-04 gap closure. Supersedes the prior `gaps_found / 9 of 11` report dated 2026-05-11T21:05:00Z. Both `partial` truths (#10 and #11) are now `VERIFIED`.

## Re-verification Note

This report overwrites the prior 12-VERIFICATION.md. Plan 12-04 landed three surgical edits in commit `83fa6ed feat(12-04): close Phase 12 gaps — setVolumePerWell + setNumberOfSetups bounds`:

1. **`calculatorStore.setVolumePerWell` action added** (calculatorStore.ts:152–160). Validates finite + > 0; rejects with `validationError = "Volume per well must be a finite positive number (got N)"`. State unchanged on reject.
2. **`calculatorStore.setNumberOfSetups` upper bound tightened** to `[1, 1000]` inclusive (calculatorStore.ts:131). Error phrasing: `"Number of setups must be an integer between 1 and 1000 (got N)"`. Aligns with the createCalculatorInputs sanity cap so the throw at calculator.ts:158–162 is unreachable from any in-store code path.
3. **`runStore.loadRun` cascade restores `volumePerWell`** (runStore.ts:137) BETWEEN `setSampleCount` and `setNumberOfSetups`. Snapshot-frozen contract: a Smoke 3 run saved with 50 µL/well now round-trips correctly.
4. **Group G integration tests added** (calculator.integration.test.ts:367–551). Two end-to-end loadRun cascade tests (T-G1 Smoke 3 round-trip, T-G2 legacy `numberOfSetups: undefined` fallback) plus Group F bounds tests T-F4/T-F5/T-F6 and `setVolumePerWell` tests T-F7..T-F12 — 11 new tests total (94 → 105).

A post-fix code review (`892ea26 docs(12): code review after gap closure`) was run by the orchestrator and reported clean. No SUMMARY.md was produced for 12-04 (gap-closure plans skip the templated SUMMARY in this workflow) — the PLAN frontmatter + the implementation commit constitute the closure record.

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | Final volumes round UP to nearest 0.1 mL (ceiling at 0.1 mL precision) | VERIFIED | `ceilToTenthML` in decimal.ts:44–48 uses `Decimal.toDecimalPlaces(1, ROUND_CEIL)`. calculator.ts:75–77 `calculateFinalVolume` consumes it. 9 cases in decimal.test.ts + 3 in calculator.test.ts Group A + 3 in calculator.integration.test.ts Group C all green. |
| 2 | Exactly-zero raw volume stays exactly zero after rounding (no upward bump from 0) | VERIFIED | decimal.test.ts test case `ceilToTenthML(createVolume(0, 'uL'))` → 0 µL (passing). |
| 3 | Dead volume scales with number_of_setups: dead = setups × 2 mL | VERIFIED | calculator.ts:163 `deadVolumeUL = numberOfSetups * DEAD_VOLUME_PER_SETUP_UL`. Constant DEAD_VOLUME_PER_SETUP_UL = 2000 µL at shared/constants/calculator.ts:22. Group B (setups=3 → 13.4 mL) + Group F (T-F1 store-level 13.4 mL) + Group G (T-G1 loadRun cascade 13.4 mL) all green. |
| 4 | createCalculatorInputs accepts numberOfSetups parameter that defaults to 1 (backwards-compatible) | VERIFIED | calculator.ts:151 — signature `numberOfSetups: number = 1`. Validation lines 153–162 rejects non-integer / <1 / >1000 with descriptive errors. calculator.test.ts Group B exhausts the boundary. |
| 5 | When ANY selected premix has concentration === 1, that premix is returned as the diluent for both Beads and Antibodies (1× premix wins) | VERIFIED | diluentResolver.ts:48–52 — first-1×-in-array wins. diluentResolver.test.ts Group A (T-A1..T-A6) verifies. |
| 6 | When NO 1× premix selected, resolver returns kind='values_table' with verbatim per-reagent strings (no normalization) | VERIFIED | diluentResolver.ts:55–61 returns valuesTable.beads / .antibodies unchanged. T-B3 explicitly locks whitespace `'  L-AB '` and case `'N/A'` preservation. |
| 7 | When panel has no Values-table data (legacy v0.7.0), resolver returns kind='legacy' with beads=null, antibodies=null | VERIFIED | diluentResolver.ts:64 — `return { kind: 'legacy', beads: null, antibodies: null }`. T-C1 + T-C2 assert. |
| 8 | When multiple selected premixes are 1×, resolver picks FIRST in input array (deterministic, caller-controlled) | VERIFIED | T-A4 + T-A5 opposing-order pair proves input-array-order, not alphabetical. |
| 9 | calculatorStore exposes numberOfSetups: number (default 1, integer ≥ 1) and setNumberOfSetups action that validates and rejects invalid input | VERIFIED | calculatorStore.ts:42 (field), :73 (initialState default 1), :125–138 (action with bounded `[1, 1000]` validation). T-F2 (0/-1/1.5 rejected), T-F3 (100 accepted), T-F4 (1000 accepted at boundary). |
| 10 | calculatorStore.getOutputs() passes numberOfSetups (NOT the old deadVolume runtime number) as 5th arg to createCalculatorInputs AND the bound-mismatch trap is unreachable | **VERIFIED** (was PARTIAL) | calculatorStore.ts:211–217 passes numberOfSetups as 5th arg. **Bound alignment closed in 12-04:** setNumberOfSetups (line 131) now rejects `n > 1000` with descriptive validationError before the lib throw can trigger. Tests T-F4 (1000 OK), T-F5 (1001 rejected), T-F6 (1500 rejected + getOutputs() does NOT throw) — explicit assertion `expect(() => useCalculatorStore.getState().getOutputs()).not.toThrow()` at line 316. |
| 11 | Loading a persisted run (runStore.loadRun) does NOT recompute the run's volumes under new rules — persisted finalVolume / deadVolume surfaced as-is (SMK3-16 carryover) | **VERIFIED** (was PARTIAL) | **Restoration gap closed in 12-04:** runStore.ts:137 now calls `calculator.setVolumePerWell(run.volumePerWell)` BETWEEN setSampleCount and setNumberOfSetups. **End-to-end test added:** Group G T-G1 stubs `window.electronAPI.run.getById` via `vi.stubGlobal`, drives `useRunStore.getState().loadRun(...)` with a PRD-shaped RunRecord (volumePerWell=50, numberOfSetups=3, sampleCount=100), and asserts `outputs.finalVolumeML ≈ 13.4`. T-G2 covers the legacy `numberOfSetups: undefined` → `?? 1` fallback path. Both tests also assert `validationError === null` before the math assertions — a regression in the cascade fails on that contract line. |
| 12 | The PRD worked example (148 wells × 0.05 mL/well + 2 mL dead, setups=1) produces totalWells=148 / finalVolumeML=9.4 end-to-end | VERIFIED | calculator.integration.test.ts T-A1 (lib layer) + T-F1b (store layer) + T-G2 (loadRun cascade via legacy fallback path) all assert: totalWells=148, rawVolume=9400 µL, finalVolume=9400 µL, finalVolumeML≈9.4. With setups=3: 13400 µL / 13.4 mL (T-B1 + T-F1 + T-G1). |
| 13 | CALC-05 max-5-singles cap still blocks a 6th single under premix_singles | VERIFIED | calculator.ts:207–210 `canAddSingle` returns false at cap. calculatorStore.ts:165 `addSingle` short-circuits via canAddSingle. Group D (T-D1..T-D9 — 9 cases) + Group E (T-E1 / T-E2) all green. |
| 14 | STATE.md decision 02-01 annotated SUPERSEDED with reference to Phase 12 + SMK3-06 | VERIFIED | STATE.md line 95: `02-01: ~~Final volume always rounds UP to nearest mL~~ — SUPERSEDED 2026-05-11 by Phase 12-03 + SMK3-06`. Line 99 also annotates 02-03 EXTENDED by SMK3-05. |

**Score: 11/11 must-haves fully verified.** Both prior `partial` truths (#10 and #11) closed by Plan 12-04 — no remaining gaps, no regressions in the previously-passing truths.

Note: the truths above are de-duplicated from 3 plans + ROADMAP success criteria. Some are split (e.g. truth #1 covers ROADMAP SC #1; truths #5–#8 cover ROADMAP SC #3).

### Deferred Items

Items not yet met but explicitly addressed in later milestone phases (out of scope per Phase 12 contract).

| # | Item | Addressed In | Evidence |
|---|------|--------------|----------|
| 1 | "Computed under previous calculation rules" advisory marker on pre-Smoke-3 run-doc reopen | Phase 15 | Phase 15 SC #4 (SMK3-16): advisory note on pre-Smoke-3 run reload. |
| 2 | Number of Setups UI input on Plate page | Phase 14 | Phase 14 SC #1 (SMK3-04): explicit numeric input with default 1, min 1. |
| 3 | Diluent resolver wired into calculatorStore + run document display | Phase 13/14/15 | Plan 12-03 §Out-of-scope explicitly defers; Phase 15 SC #1 covers run-doc diluent decision. |
| 4 | Per-reagent panel data (Values-table) from xlsx parser | Phase 13 | Phase 13 SC #2 (SMK3-08): per-reagent rows including Concentration / Diluent / Volume per well. |

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `src/renderer/src/lib/decimal.ts` | exports ceilToTenthML; roundUpToNearestML deleted | VERIFIED | ceilToTenthML at line 44; roundUpToNearestML gone (grep returns 0 hits across src/). |
| `src/renderer/src/lib/calculator.ts` | calculateFinalVolume uses ceilToTenthML; createCalculatorInputs accepts numberOfSetups (default 1); sanity cap >1000 | VERIFIED | Line 19 import; line 76 caller; line 151 sig; lines 158–162 sanity cap. |
| `src/renderer/src/lib/diluentResolver.ts` | resolveDiluent + DiluentResult; concentration-keyed; verbatim strings | VERIFIED | 74 lines incl. JSDoc; pure function; zero imports from panel.ts / analyte.ts / calculator.ts (decoupled). |
| `src/shared/types/diluent.ts` | DiluentResult discriminated union exported | VERIFIED | DiluentKind + DiluentResult + SelectedPremixForDiluent + PanelValuesDiluent. |
| `src/shared/types/calculator.ts` | CalculatorInputs.numberOfSetups: number | VERIFIED | Lines 14–15. CalculatorState.deadVolume legacy field still present (unused — info IN-06). |
| `src/shared/constants/calculator.ts` | DEAD_VOLUME_PER_SETUP_UL = 2000; no DEFAULT_DEAD_VOLUME | VERIFIED | Line 22; old constant fully removed (grep zero hits). |
| `src/renderer/src/stores/calculatorStore.ts` | numberOfSetups field + setNumberOfSetups (bounded [1,1000]) + setVolumePerWell action + getOutputs threading | **VERIFIED** (was PARTIAL on missing setVolumePerWell) | Field line 42, default 1 line 73, setNumberOfSetups bounded `[1,1000]` lines 125–138, **new setVolumePerWell action** lines 152–160, getOutputs lines 201–220. |
| `src/renderer/src/stores/runStore.ts` | loadRun threads numberOfSetups AND volumePerWell | **VERIFIED** (was PARTIAL) | Line 137 `calculator.setVolumePerWell(run.volumePerWell)` between setSampleCount (line 129) and setNumberOfSetups (line 141). Cascade order matches the comment block at lines 130–136 (SMK3-16 snapshot-frozen contract). |
| `src/renderer/src/features/run/hooks/useRunSnapshot.ts` | emits numberOfSetups | VERIFIED | Line 106 emits numberOfSetups; line 105 derives deadVolume from setups × 2000 (info IN-01: hardcoded 2000 instead of imported constant). |
| `src/renderer/src/lib/__tests__/calculator.integration.test.ts` | PRD worked example 9.4 / 13.4 mL + CALC-05 regression + snapshot-frozen loadRun group | **VERIFIED** (was PARTIAL) | 31 tests pass (Group A–G). **Group G** drives `useRunStore.getState().loadRun(mockRun.id)` via `vi.stubGlobal('window', { electronAPI: ... })` — T-G1 (Smoke 3 round-trip 13.4 mL) + T-G2 (legacy `numberOfSetups: undefined` → 9.4 mL via `?? 1` fallback). Group F extended with T-F4..T-F12 (bounds + setVolumePerWell). |
| `src/renderer/src/lib/__tests__/decimal.test.ts` | ceilToTenthML tests | VERIFIED | 9 tests passing. |
| `src/renderer/src/lib/__tests__/calculator.test.ts` | ceiling + setups tests | VERIFIED | 13 tests passing. |
| `src/renderer/src/lib/__tests__/diluentResolver.test.ts` | 14 tests covering 4 fixture scenarios + edge cases | VERIFIED | 14 tests passing, 5 describe groups. |
| `.planning/STATE.md` | decision 02-01 SUPERSEDED annotation | VERIFIED | Lines 95 (02-01 SUPERSEDED) + 99 (02-03 EXTENDED). |

### Key Link Verification

| From | To | Via | Status | Details |
|------|-----|-----|--------|---------|
| calculator.ts (calculateFinalVolume) | decimal.ts (ceilToTenthML) | direct import; replaces roundUpToNearestML | WIRED | Line 19 import, line 76 call. roundUpToNearestML fully deleted (grep zero hits). |
| calculator.ts (createCalculatorInputs) | shared CalculatorInputs.numberOfSetups | function-sig parameter with default 1 | WIRED | Line 151 `numberOfSetups: number = 1`; line 168 placed in returned object. |
| calculatorStore.ts (getOutputs) | calculator.ts (createCalculatorInputs) | 5th positional arg is numberOfSetups; bound alignment prevents the throw path | WIRED | calculatorStore.ts:211–217 passes numberOfSetups. setNumberOfSetups (line 131) catches n>1000 BEFORE getOutputs() can reach the lib throw — verified by T-F6 `expect(() => getOutputs()).not.toThrow()`. |
| calculatorStore.ts | shared/constants/calculator.ts | removed import of DEAD_VOLUME_PER_SETUP_UL | WIRED | Store imports only DEFAULT_VOLUME_PER_WELL + types; the dead-volume constant is consumed inside calculator.ts. |
| diluentResolver.ts | shared/types/diluent.ts | type re-export so renderer + main share one source of truth | WIRED | Lines 1–5 type imports; lines 67–73 re-export. |
| diluentResolver.ts | (panel.ts / analyte.ts / calculator.ts) | **MUST NOT import these — decoupling check** | WIRED (decoupled) | grep returns ZERO hits. Resolver works against structural SelectedPremixForDiluent input. |
| useRunSnapshot.ts | calculatorStore.numberOfSetups | snapshot JSON emission | WIRED | Line 106 emits `numberOfSetups: calculator.numberOfSetups`. |
| runStore.loadRun | calculatorStore.setNumberOfSetups | rehydration after setReplicateMode + setSampleCount + setVolumePerWell | WIRED | Line 141 calls `calculator.setNumberOfSetups(run.numberOfSetups ?? 1)`. |
| runStore.loadRun | calculatorStore.setVolumePerWell | rehydration of persisted per-well volume BEFORE setNumberOfSetups | **WIRED** (was NOT WIRED) | Line 137 calls `calculator.setVolumePerWell(run.volumePerWell)`. Cascade order verified: setReplicateMode (128) → setSampleCount (129) → setVolumePerWell (137) → setNumberOfSetups (141). Integration test T-G1 asserts `calculator.volumePerWell === 50` after loadRun. |
| calculator.integration.test.ts (Group G) | runStore.loadRun | `vi.stubGlobal('window', { electronAPI: ... })` + `useRunStore.getState().loadRun(id)` | WIRED | calculator.integration.test.ts:439 stubs the full electronAPI surface (run / platform / species / panel / analyte namespaces); :496 + :532 drive loadRun. |

### Data-Flow Trace (Level 4)

Phase 12 is pure calculator logic; the integration tests verify data flows end-to-end at the store + cascade level.

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|--------------|--------|--------------------|--------|
| calculatorStore.getOutputs() | finalVolumeML, rawVolume | createCalculatorInputs → calculateVolumes | Real (Decimal math through pure functions, validated by 31 integration tests) | FLOWING |
| useRunSnapshot.buildRunSnapshot | numberOfSetups, deadVolume | calculatorStore state read at snapshot time | Real | FLOWING |
| runStore.loadRun cascade | numberOfSetups | run.numberOfSetups (DB JSON snapshot) with `?? 1` legacy fallback | Real | FLOWING |
| runStore.loadRun cascade | volumePerWell | run.volumePerWell → calculator.setVolumePerWell (NEW in 12-04) | **Real** (was DISCONNECTED) | **FLOWING** — T-G1 asserts 50 µL persists across loadRun; T-G2 asserts the 50 µL is preserved even when numberOfSetups falls back. |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| Full vitest suite passes | `npm test` | 12 files, 105 passed (105) — was 94 in prior verification; +11 from 12-04 | PASS |
| TypeScript clean | `npm run typecheck` | clean exit (node + web) | PASS |
| Old constants fully removed | `grep -rn "DEFAULT_DEAD_VOLUME\|roundUpToNearestML" src/` | zero hits | PASS |
| New dead-volume constant referenced | `grep -rn "DEAD_VOLUME_PER_SETUP_UL" src/` | 6 hits (constant decl + calc.ts × 3 + types × 2 + store comment × 1) | PASS |
| setVolumePerWell present in store | `grep -rn "setVolumePerWell" src/` | 17 hits (interface + impl in store, caller in runStore.ts, 13 test references) | PASS |
| loadRun calls setVolumePerWell with run.volumePerWell | `grep -nE "calculator\.setVolumePerWell\(run\.volumePerWell\)" runStore.ts` | 1 hit (line 137) | PASS |
| setNumberOfSetups upper-bound aligned with lib | `grep -nE "n > 1000" calculatorStore.ts` | 1 hit (line 131) — store-layer reject before lib throw | PASS |
| Group G plumbing wired | `grep -nE "vi\.stubGlobal" calculator.integration.test.ts` | 2 hits (comment + actual stub at line 439) | PASS |
| Group G drives loadRun cascade | `grep -nE "useRunStore\.getState\(\)\.loadRun" calculator.integration.test.ts` | 2 hits (T-G1 line 496, T-G2 line 532) | PASS |

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|------------|-------------|-------------|--------|----------|
| SMK3-05 | 12-01, 12-03 | Dead volume = `numberOfSetups × 2 mL`; default 1; rejects <1 | SATISFIED | calculator.ts:163; store action validation 125–138 (now bounded [1,1000]); test coverage in calculator.test.ts Group B + integration Groups B/F/G. |
| SMK3-06 | 12-01, 12-03 | Final volumes round UP to nearest 0.1 mL | SATISFIED | ceilToTenthML in decimal.ts:44; calculator.ts:76; decimal.test.ts (9 cases) + integration Group C boundary tests. |
| SMK3-07 | 12-02, 12-03 | Diluent: any 1× premix wins; else Values-table per reagent; else legacy | SATISFIED | diluentResolver.ts:48–64; 14 tests across 4 groups in diluentResolver.test.ts. **Note: resolver decoupled — not yet wired into calculatorStore, deferred to Phase 13/14/15.** |
| CALC-03 (extended) | 12-01, 12-03 | App includes dead volume in all volume calculations | SATISFIED | calculator.ts:64 calculateRawVolume; calculator.ts:163 deadVolume derivation. REQUIREMENTS.md annotated EXTENDED by SMK3-05. |
| CALC-05 (retained) | 12-03 | Max 5 singles cap when premix selected | SATISFIED | calculator.ts:207–210 canAddSingle; calculatorStore.ts:165 addSingle short-circuit; integration Group D (9 cases) + Group E (2 cases). REQUIREMENTS.md annotated RETAINED 2026-05-11. |
| CALC-06 (superseded) | 12-01 | OLD rule "round up to nearest mL" | SATISFIED via supersession | REQUIREMENTS.md strikethrough + SUPERSEDED annotation; STATE 02-01 SUPERSEDED. No code path remains. |

All Phase 12 requirements per ROADMAP and PLAN frontmatter accounted for. No orphaned requirements.

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| useRunSnapshot.ts | 105 | Hardcoded `2000` instead of `DEAD_VOLUME_PER_SETUP_UL` import | Info | If constant changes in future SMK3 amendment, this drifts silently (IN-01 in 12-REVIEW.md) |
| diluentResolver.ts | 49 | Strict `=== 1` float equality on `concentration` | Info | Preventive only — if Phase 13 parser produces `1.0000000001`, the 1× premix would be missed (IN-02) |
| calculator.integration.test.ts | 265–282 | Missing test for validationError clear on valid setNumberOfSetups | Info | Uncovered branch in calculatorStore (IN-03). Partially addressed by T-F12 (validationError-clear path for setVolumePerWell), not setNumberOfSetups. |
| useRunSnapshot.ts | 138–144 | useMemo dep list omits calculator slices that buildRunSnapshot reads | Info | Disabled exhaustive-deps lint hides stale-data risk (IN-04) |
| useRunSnapshot.ts + validation/run.ts | 101–106 + 24, 28 | No superRefine cross-field check that `deadVolume === numberOfSetups × 2000` | Info | Possible disagreement at round-trip if schema defaults differ (IN-05) |
| shared/types/calculator.ts | 86 | `CalculatorState.deadVolume: number` declared in legacy unused type shape | Info | Dead surface; no consumer reads CalculatorState directly (IN-06) |
| shared/constants/calculator.ts | 28 | `MAX_SINGLES_CUSTOM = Infinity` sentinel | Info | v1.0 carry-over; works but exposes Infinity to UI display code (IN-07) |
| runStore.ts | 141 | `setNumberOfSetups` is the SOLE source of dead-volume restoration; legacy persisted `deadVolume` is silently dropped if it diverges from `numberOfSetups × 2000` | Info (was Warning) | Smoke 3 runs round-trip faithfully via the formula; pre-Smoke-3 runs without numberOfSetups now reload with `?? 1` default + correctly-restored volumePerWell. Phase 15 advisory marker remains the planned UX mitigation. Downgraded from Warning because the volumePerWell restoration in 12-04 closes the most-likely silent-rewrite path. |

**No Warning- or Blocker-level findings remain after Plan 12-04.** All Warning items in the prior verification (WR-01 / WR-02 / WR-03 / WR-04) are either closed or downgraded to Info based on the gap-closure scope.

### Human Verification Required

None. The calculator math layer is fully testable; all 11 must-haves verify programmatically. Phase 14 will introduce the UI input for numberOfSetups (deferred), and Phase 16 will perform the full Windows-build manual UAT walkthrough.

### Gaps Summary

**No gaps.** Phase 12 ships the calculator-rules migration completely at the pure-math + state-store + persistence layers:

- ceilToTenthML helper + calculateFinalVolume call-site swap (SMK3-06): correctly supersedes STATE decision 02-01.
- numberOfSetups parameter + dead-volume formula (SMK3-05): correctly extends CALC-03; bounds aligned `[1, 1000]` between store and lib (closed in 12-04).
- Concentration-keyed diluent resolver (SMK3-07): correctly supersedes the request-type-keyed rule. Decoupled from panel/analyte/calculator imports.
- CALC-05 max-5-singles cap regression at both lib and store layers: correctly retained per R-05.
- STATE.md 02-01 / 02-03 annotated.
- **NEW (12-04):** Snapshot-frozen contract honored end-to-end. `runStore.loadRun` now restores `volumePerWell` between `setSampleCount` and `setNumberOfSetups`. Group G integration tests prove the PRD worked example (148 wells × 50 µL/well, setups=3) round-trips through save+load with bit-for-bit display fidelity (13.4 mL on both sides).
- **NEW (12-04):** Bound mismatch between store and lib closed. `setNumberOfSetups(1500)` followed by `getOutputs()` no longer throws — the store catches at validation time and `getOutputs()` returns null due to `validationError` short-circuit at calculatorStore.ts:205.

Phase 12 is complete. Ready for Phase 13 (Panel XLSX Parser v3).

---

_Verified: 2026-05-11T22:30:00Z (re-verification after Plan 12-04 gap closure)_
_Prior verification: 2026-05-11T21:05:00Z (status: gaps_found, score: 9/11)_
_Verifier: Claude (gsd-verifier)_
