---
phase: 14-smoke-3-plate-page-input-expansion-ui-cleanup-inserted-2026-
plan: 06
subsystem: ui-layer
tags: [calculator-form, calculator-panel, old-reagent-cap-modal, use-calculator, calculator-store, capPaused, SMK3-02, SMK3-03, SMK3-04, D-01, D-03, D-04, D-05, D-09, D-10]
requires:
  - "Plan 14-01 (floorToTenthML + applyOldReagentSubtraction primitives)"
  - "Plan 14-04 (calculatorStore.oldBeads/oldAntibodies + plateStore.setPlateCount + snapshot fidelity)"
  - "Plan 14-08 (DB persistence — operator inputs round-trip on save/reload)"
  - "Phase 4-02 ConfirmModal primitive (src/renderer/src/features/run/components/ConfirmModal.tsx)"
provides:
  - "calculatorStore.capPaused: boolean + setCapPaused setter (D-10 output-suppression flag)"
  - "calculatorStore.getOutputs() returns null when capPaused === true (D-10 gating)"
  - "useCalculator() exposes 5 new inputs (plateCount, oldBeads, oldAntibodies, numberOfSetups, capPaused) and 5 new setters (setPlateCount, setOldBeads, setOldAntibodies, setNumberOfSetups, setCapPaused)"
  - "OldReagentCapModal — thin ConfirmModal wrapper with cap-exceedance copy (D-10)"
  - "CalculatorForm — 7 inputs in PRD D-01 order + 20%-cap soft-block + override flow + D-10 output-pause wiring"
  - "CalculatorPanel — amber 'Cap exceeded — override or lower the value to resume calculation.' placeholder when capPaused (D-10)"
affects:
  - "Plan 14-07 (integration tests): end-to-end SMK3-02/03/04 operator workflow (input → store → calculator output)"
  - "Phase 16 Windows UAT: 20%-cap override modal + capPaused placeholder are visual surfaces requiring manual verification"
tech-stack:
  added: []
  patterns:
    - "Two-state numeric input (Pattern S7) — displayValue: string local state + commit on blur / Enter (mirrors SampleCountInput)"
    - "Confirm-once override (D-10) — local React accepted-flag survives the focused session; resets when input value changes (re-prompts on next exceedance)"
    - "UI-derived store flag (capPaused) pushed via useEffect — keeps store in sync with live UI state without duplicating cap-formula logic into the store layer"
    - "Defense-in-depth output gating — getOutputs() returns null AND CalculatorPanel checks capPaused (two layers, same intent)"
    - "Amber semantic register — bg-amber-50 / border-amber-200 / text-amber-800 for the 'override warning' rendering state, distinct from gray (neutral) and red (error)"
key-files:
  created:
    - "src/renderer/src/features/plate/components/OldReagentCapModal.tsx (52 lines — thin ConfirmModal wrapper)"
    - "src/renderer/src/stores/__tests__/calculatorStore.capPaused.test.ts (60 lines — 6 vitest cases)"
  modified:
    - "src/renderer/src/stores/calculatorStore.ts (354 lines total; +33 lines for capPaused field, setCapPaused setter, getOutputs guard, initialState extension)"
    - "src/renderer/src/features/calculator/hooks/useCalculator.ts (129 lines total; +30 lines — destructure 6 new store members + plateStore.setPlateCount, extend return shape)"
    - "src/renderer/src/features/calculator/components/CalculatorForm.tsx (374 lines total; +300 lines — full restructure to D-01 7-input order + 20%-cap UX + modal wiring + capPaused useEffect)"
    - "src/renderer/src/features/calculator/components/CalculatorPanel.tsx (60 lines total; +28 lines — three-branch ternary with capPaused priority)"
decisions:
  - "Task 4 split across two commits (Task 4a = store + tests, Task 4b = panel). The plan's task numbering is preserved in commit messages; the split is a Rule 3 blocking-issue resolution for the mutual hook<->store<->panel dependency (each commit must typecheck independently)."
  - "CalculatorForm useEffect drives setCapPaused with the derived (beadsExceedsCap || antibodiesExceedsCap). Alternative considered: compute the cap inside the store via a getter, drop the useEffect. Rejected because the cap formula references DEAD_VOLUME_PER_SETUP_UL — keeping the UI as the single source of truth for cap-related UX prevents the store from growing UI concerns. Defense in depth: getOutputs() ALSO returns null when paused so the two-layer invariant holds even if a future refactor breaks one half."
  - "Modal reagent label fallback uses 'Old Beads' as the default for closed-modal renders (open=false). Avoids an undefined branch in the JSX; harmless because the modal renders nothing when closed."
  - "Cap-paused placeholder uses amber styling, not red. Red is reserved for hard validation errors (validationError banner); amber signals 'awaiting operator decision' which is closer to the override flow's semantic register."
  - "Override flag is local React state, NOT persisted to the store. Per CONTEXT D-10 the override 'sticks within the focused session, re-prompts on next focus' — runStore.loadRun should NOT restore an override flag. If a saved run reloads with oldBeads > cap, the next operator decision starts fresh (re-prompts on first edit)."
metrics:
  duration_minutes: 25
  completed: 2026-05-12
  tasks_completed: 5
  files_created: 2
  files_modified: 4
  tests_added: 6
  test_total_after: 362
  test_total_before: 356
---

# Phase 14 Plan 06: CalculatorForm UI Rewrite + OldReagentCapModal + capPaused Output Suppression Summary

Wired the Phase-14 store extensions into the operator-visible UI surface: extended `useCalculator` to expose 5 new inputs + 5 new setters; built `OldReagentCapModal` as a thin `ConfirmModal` wrapper; restructured `CalculatorForm` to the PRD D-01 7-input order (Plates → Replicate Mode → Samples → Old Beads → Old Antibodies → Setups → Request Type) with the SMK3-02/03 20%-cap soft-block + override flow; added the D-10 output-suppression contract (`capPaused` store state + setter + `getOutputs()` guard + CalculatorPanel amber placeholder) so calculator output pauses while any over-cap old-reagent input is awaiting decision. 6 vitest tests pin the store-level capPaused contract.

## Tasks Completed

| Task    | Description                                                                          | Commit    |
| ------- | ------------------------------------------------------------------------------------ | --------- |
| Task 4a | calculatorStore: capPaused field + setCapPaused + getOutputs guard + 6 vitest tests  | `424a034` |
| Task 1  | useCalculator hook extended with 5 new inputs + 5 new setters                        | `493d447` |
| Task 2  | OldReagentCapModal — thin ConfirmModal wrapper (D-10 override modal)                 | `7c124bd` |
| Task 3  | CalculatorForm rewrite — D-01 7-input order + 20%-cap UX + capPaused wiring          | `ee31285` |
| Task 4b | CalculatorPanel — three-branch ternary, capPaused → amber placeholder (priority)     | `40c9cbf` |

Note: Task 4 from the plan was split across commits `424a034` (Step A + C — store + tests) and `40c9cbf` (Step B — panel). See "Deviations" §1 below for the rationale.

## D-01 Input Ordering (CalculatorForm.tsx — verified line numbers)

| # | Control                | Label / component                | Line(s)        |
|---|------------------------|----------------------------------|----------------|
| 1 | Number of Plates       | `<input type="number" min={1}>`  | 193-210        |
| 2 | Replicate Mode         | Singles / Duplicates radios      | 212-240        |
| 3 | Number of Samples      | `<SampleCountInput>`             | 244            |
| 4 | Old Beads (mL)         | `<input type="number" step={0.1}>` + helper | 246-281 |
| 5 | Old Antibodies (mL)    | `<input type="number" step={0.1}>` + helper | 283-318 |
| 6 | Number of Setups       | `<input type="number" min={1}>`  | 320-339        |
| 7 | Request Type           | Read-only badge                  | 342-352        |

## 20%-Cap Formula (D-09)

```
totalReactionVolumeML = (sampleCount × volumePerWell + numberOfSetups × DEAD_VOLUME_PER_SETUP_UL) / 1000
                     // (µL → mL conversion via /1000; DEAD_VOLUME_PER_SETUP_UL = 2000 µL = 2 mL per setup)

capML = 0.2 × totalReactionVolumeML

beadsExceedsCap        = !beadsOverrideAccepted        && oldBeads        > capML && capML > 0
antibodiesExceedsCap   = !antibodiesOverrideAccepted   && oldAntibodies   > capML && capML > 0
```

The cap is recomputed live as sampleCount / volumePerWell / numberOfSetups change. When `capML === 0` (sampleCount = 0 OR volumePerWell = 0), the cap UX is suppressed entirely — no helper text rendered, no modal opened.

## Override Modal Flow (D-10)

```
                                                 ┌──────────────────────────────────┐
operator types value → commit (blur/Enter):      │ OldReagentCapModal (open=true)   │
                                                 │ Title: "Old Reagent Exceeds      │
  oldBeads = parseFloat(raw)                     │   Recommended Limit"             │
  if (n !== prev) override-flag = false  ──► ──► │ Body: "{label}: {typed} mL.      │
  if (capML > 0 && n > capML && !override)       │   Recommended max: {cap} mL      │
    setActiveModal('beads') ─────────────────┐   │   (20% of {total} mL total)..."  │
                                              │  │                                  │
                                              └► │ [Cancel]  [Yes, override]        │
                                                 └──────────────────────────────────┘
                                                           │             │
                                                   onCancel│             │onOverride
                                                           ▼             ▼
                                  ┌─────────────────────────┐  ┌──────────────────────┐
                                  │ snap input to capML:    │  │ override-flag = true │
                                  │   setOldBeads(capML)    │  │ amber 'overridden'   │
                                  │   setOldBeadsDisplay(   │  │   badge renders      │
                                  │     capML.toFixed(1))   │  │ red border clears    │
                                  └─────────────────────────┘  │ capPaused → false    │
                                                               └──────────────────────┘
```

Modal is single-instance: `activeModal: 'beads' | 'antibodies' | null` — only one cap-exceedance can be pending at a time. `pendingTypedValue` snapshots the typed value at modal-open so a fast operator can't race the input.

## D-10 Output-Pause Wiring (End-to-End)

```
CalculatorForm                                       calculatorStore                       CalculatorPanel
──────────────                                       ───────────────                       ────────────────
useEffect(() => {                                                                          const { capPaused } =
  setCapPaused(                  ────────────►       set({ capPaused: paused })            useCalculator()
    beadsExceedsCap ||
    antibodiesExceedsCap                             getOutputs():                         {capPaused
  )                                                    if (capPaused)                       ? <amber placeholder>
}, [beadsExceedsCap,                                     return null            ◄────       : isValid && outputs
   antibodiesExceedsCap,                              // ItemizedVolumeDisplay              ? <ItemizedVolume...>
   setCapPaused])                                     // gated downstream                   : <neutral placeholder>}
```

Defense in depth: BOTH layers check `capPaused`. `getOutputs()` returns null at the data source, AND `CalculatorPanel`'s ternary checks `capPaused` first. If a future refactor breaks one invariant, the other still suppresses output.

## capPaused Test Coverage (6 vitest cases)

`src/renderer/src/stores/__tests__/calculatorStore.capPaused.test.ts`:

| Case | Assertion                                                                            |
| ---- | ------------------------------------------------------------------------------------ |
| T-1  | Initial `capPaused === false`                                                        |
| T-2  | `setCapPaused(true)` flips the flag → true                                           |
| T-3  | `setCapPaused(false)` flips it back → false                                          |
| T-4  | `getOutputs()` returns null when paused, even with valid sampleCount (D-10 gating)   |
| T-5  | `getOutputs()` returns CalculatorOutputs when NOT paused (Phase 12 contract preserved) |
| T-6  | `reset()` restores `capPaused` to false (cascade preserved)                          |

All 6 pass; full suite 362/362 (356 baseline + 6 new).

## Verification Results

| Check                                                                          | Result                                        |
| ------------------------------------------------------------------------------ | --------------------------------------------- |
| `npm run typecheck` exits 0                                                    | PASS                                          |
| `npm run test -- --run` exits 0                                                | PASS — 362/362 (356 + 6 new)                  |
| capPaused/setCapPaused in calculatorStore.ts                                   | 8 matches (≥ 4 required)                      |
| "Cap exceeded — override or lower" in CalculatorPanel.tsx                      | 2 matches (≥ 1 required; text + comment)      |
| OldReagentCapModal in CalculatorForm.tsx                                       | 3 matches (import + 2 references)             |
| D-01 input ordering — Plates/Replicate/SampleCount/OldBeads/OldAntibodies/Setups/RequestType | Confirmed lines 196 → 215 → 244 → 249 → 286 → 323 → 345 |
| 6 vitest capPaused cases (T-1..T-6)                                            | All 6 listed in `npx vitest list`             |

## Deviations from Plan

### 1. [Rule 3 — Blocking issue] Split Task 4 across two commits

- **Found during:** Task ordering planning, before Task 1.
- **Issue:** Plan Task 4's CalculatorPanel rewrite destructures `capPaused` from `useCalculator()`, which doesn't expose it until Task 1 extends the hook. Meanwhile, Task 1's destructure of `capPaused`/`setCapPaused` from `useCalculatorStore()` requires Task 4's Step A (store fields + setter). This is a cycle: Task 1 needs Task 4a; Task 4b needs Task 1.
- **Fix:** Split the plan's Task 4 into two atomic commits:
  - **Task 4a** (`424a034`): Store changes only (capPaused field + setCapPaused + getOutputs guard) + 6 vitest tests. Each commit typechecks cleanly (the panel hasn't been touched yet, so its existing `useCalculator()` destructure still works; the hook hasn't been touched yet so it ignores the new store fields).
  - **Task 4b** (`40c9cbf`): CalculatorPanel rewrite with the amber placeholder. Now safe because Task 1 has already extended `useCalculator()` to expose `capPaused`.
- **Why this is a deviation:** The plan's `<tasks>` block lists Task 4 as a single atomic unit. Splitting it produces 5 commits instead of 4. The spirit (and the SUMMARY criteria) is preserved — all of Task 4's contract is implemented; the split is purely about per-commit typecheck integrity, not about scope or behavior.
- **Files modified:** see commit hashes above.

### 2. [Cosmetic] Modal `reagentLabel` defaults to "Old Beads" when modal closed

- **Found during:** Task 3 CalculatorForm JSX.
- **Issue:** The plan's JSX shows `reagentLabel={activeModal === 'beads' ? 'Old Beads' : 'Old Antibodies'}` which means when `activeModal === null` (modal closed), the label would erroneously be "Old Antibodies".
- **Fix:** Used `reagentLabel={activeModal === 'antibodies' ? 'Old Antibodies' : 'Old Beads'}` instead. Default falls through to "Old Beads" which is fine — the modal renders nothing when `open === false`, so the prop value is never visible.
- **Files modified:** `src/renderer/src/features/calculator/components/CalculatorForm.tsx` line 359.

### 3. [Cosmetic — non-issue] grep for `primaryStyle="destructive"` returns 2 instead of 1

- **Found during:** Task 2 acceptance criteria check.
- **Issue:** The plan's acceptance criterion expects exactly 1 occurrence, but the docstring inside OldReagentCapModal.tsx references `primaryStyle="destructive"` as part of the JSDoc explanation. The grep returns 2 (docstring + actual JSX).
- **Fix:** None — the intent (single destructive primary button in JSX) is preserved. The docstring reference is intentional documentation, not a logical duplicate.
- **Files modified:** none.

No other deviations. All other plan steps executed verbatim.

## Self-Check: PASSED

Verified:
- `[ -f src/renderer/src/stores/__tests__/calculatorStore.capPaused.test.ts ]` → FOUND
- `[ -f src/renderer/src/features/plate/components/OldReagentCapModal.tsx ]` → FOUND
- `git log` includes commits `424a034, 493d447, 7c124bd, ee31285, 40c9cbf` → FOUND
- `npm run typecheck` → 0
- `npm run test -- --run` → 362/362
