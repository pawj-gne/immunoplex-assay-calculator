---
status: partial
phase: 04-run-documentation-persistence-deployment
source: [04-VERIFICATION.md, 04-03-SUMMARY.md]
started: 2026-04-23T08:30:00Z
updated: 2026-04-23T08:30:00Z
---

## Current Test

[awaiting human testing on Windows workstation]

## Tests

### 1. HUMAN-UAT-04-03-01 Step 1 — Transfer installer
expected: Installer `dist/immunoplex-assay-calculator-0.5.0-x64-setup.exe` (87 MB) transferred to the target Windows PC
result: [pending]

### 2. HUMAN-UAT-04-03-01 Step 2 — Install
expected: Double-click installer; NSIS wizard completes with defaults; SmartScreen unrecognized-app click-through accepted per D-26; desktop + Start Menu shortcuts created
result: [pending]

### 3. HUMAN-UAT-04-03-01 Step 3 — Launch
expected: App launches from shortcut within ~5 s; main UI renders; no native-module flash-and-die
result: [pending]

### 4. HUMAN-UAT-04-03-01 Step 4 — Wizard step 1 (Platform & Species)
expected: Pick platform (e.g. Milliplex) + species; Next button enables
result: [pending]

### 5. HUMAN-UAT-04-03-01 Step 5 — Wizard step 2 (Analytes)
expected: Pick premix panel OR toggle >=1 single; selections render in sidebar
result: [pending]

### 6. HUMAN-UAT-04-03-01 Step 6 — Wizard step 3 (Calculations)
expected: Enter sample count (e.g. 40); plate grid auto-fills; itemized volumes display
result: [pending]

### 7. HUMAN-UAT-04-03-01 Step 7 — Wizard step 4 (Document & Save)
expected: Fill all fields (Request 9421, User, Operator=Joven, today, Supernatant, DF 5, Hamilton 1, RunPlate 1, Standard 1, Trough 1, Comments "smoke test run"); click Save; auto-nav to step 5 with no toast
result: [pending]

### 8. HUMAN-UAT-04-03-01 Step 8 — Wizard step 5 (Finalized Run View)
expected: Metadata header shows "Request 09421" (5-digit padded); PrepSheet + ReagentChecklist + BeadRegionList sections visible; plate grid(s) read-only; plate label "Request 09421 — Plate 1 of N"; click Print, Windows print dialog appears, cancel
result: [pending]

### 9. HUMAN-UAT-04-03-01 Step 9 — Edit-warning modal
expected: Click Back; modal "This run is saved. Going back to edit will modify the saved record. Continue?" appears with "Keep viewing" (primary) and "Edit anyway" (destructive); click "Edit anyway" returns to step 4
result: [pending]

### 10. HUMAN-UAT-04-03-01 Step 10 — Edit + re-save (UPDATE not INSERT)
expected: Change Comments to "edited after save"; Save; navigate to step 5; back to step 4 via warning; RunList has EXACTLY ONE row for Request 09421 (proves UPDATE semantics)
result: [pending]

### 11. HUMAN-UAT-04-03-01 Step 11 — Full close
expected: Alt+F4 or X; process exits cleanly
result: [pending]

### 12. HUMAN-UAT-04-03-01 Step 12 — Relaunch + Load round-trip
expected: Relaunch; Past Runs shows Request 09421 with edited comment; Load populates wizard with stored state; plate grid matches saved layout exactly (D-02 round-trip)
result: [pending]

### 13. HUMAN-UAT-04-03-01 Step 13 — Operators Manage CRUD
expected: Top-nav Manage > Operators > add "TestUser", rename one seeded name, soft-delete another; return to step 4 dropdown reflects changes; relaunch app, changes persist
result: [pending]

### 14. HUMAN-UAT-04-03-01 Step 14 — Start New Run
expected: On Finalized View click Start New Run; all stores reset; wizard returns to step 1; operator dropdown + RunList still populated (app-wide state)
result: [pending]

## Summary

total: 14
passed: 0
issues: 0
pending: 14
skipped: 0
blocked: 0

## Gaps
