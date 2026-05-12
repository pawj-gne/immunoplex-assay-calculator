---
status: partial
phase: 14-smoke-3-plate-page-input-expansion-ui-cleanup
source: [14-VERIFICATION.md]
started: 2026-05-12T15:05:00Z
updated: 2026-05-12T15:05:00Z
target_milestone: Phase 16 (Windows UAT)
---

## Current Test

[awaiting Phase 16 Windows UAT — build .exe via `npm run build:win` → install on Windows workstation → run through each item below]

## Tests

### 1. Plate-page input rendering, ordering, defaults, mins, steps
expected: Wizard renders 7 inputs in D-01 order — Number of Plates → Replicate Mode → Number of Samples → Old Beads → Old Antibodies → Number of Setups → Request Type. Defaults: Plates=1, Old Beads=0.0, Old Antibodies=0.0, Number of Setups=1. Step=0.1 on Old Beads/Antibodies; step=1 on Plates/Setups. Min enforced on type/blur.
result: [pending]

### 2. 20%-cap soft-block + confirm-once override flow
expected: Typing Old Beads > 20% of total reaction volume opens OldReagentCapModal once. "Yes, override" sets amber 'overridden' badge and resumes ItemizedVolumeDisplay. "Cancel" snaps input to floor-rounded cap and re-resumes. While capPaused, CalculatorPanel shows the amber "Cap exceeded — override or lower the value to resume calculation." placeholder. Retyping a still-over value re-prompts the modal (D-10 re-prompt contract — covered by WR-01 fix and 12 oldReagentCommit regression tests).
result: [pending]

### 3. Duplicate plate layout visual confirmation
expected: With Replicate Mode = Duplicates and Sample Count = 36, plate 1 shows samples 1-4 in col 4 as adjacent-row vertical pairs (A4,B4)(C4,D4)(E4,F4)(G4,H4), then 5-8 in col 5, …, 33-36 in col 12. The retired col-12 special case (A↔E / B↔F / C↔G / D↔H) is gone.
result: [pending]

### 4. Premix deselection UX flow
expected: Pick premix → singles pool excludes its members. Add a single from the pool. Deselect premix → previously-picked single survives in "Selected Analytes" (D-18). Premix members return to pool as selectable but NOT auto-added (D-19). Switching to a new premix prunes only the new premix's members from selectedSingleIds; non-overlap singles survive (D-20).
result: [pending]

### 5. Bead-region display: flat list, sorted ascending, member badges, conditional remove
expected: Selected Analytes panel shows ONE flat list (premix members + singles together), sorted ascending by numeric bead region. Each row has analyte name + bead-region badge. Singles rows show an X-remove on hover; premix-member rows do NOT show the X-remove.
result: [pending]

### 6. Stock-concentration UI cleanup visual
expected: Platform-selection step (wizard step 0): each PlatformCard renders title + optional "Selected" badge + optional description ONLY (no `Stock Concentration: Xx` footer; no `border-t` separator). The green-bordered "Platform Selected: {name}" box shows only the heading (no `Stock concentration: Xx` line; no `Ready to proceed with reagent calculations.` line).
result: [pending]

### 7. SMK3-16 snapshot fidelity end-to-end through SQLite
expected: Save a run with oldBeads=1.5, oldAntibodies=2.0, numberOfSetups=3 → close app → re-open → load the saved run → calculator inputs restore exactly to 1.5 / 2.0 / 3. A run saved BEFORE Phase 14 (no oldBeads/oldAntibodies columns populated) reloads with oldBeads=0, oldAntibodies=0, numberOfSetups=1 (DB DEFAULT values).
result: [pending]

## Summary

total: 7
passed: 0
issues: 0
pending: 7
skipped: 0
blocked: 0

## Gaps
