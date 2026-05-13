---
status: partial
phase: 15-smoke-3-run-document-audit-trail-inserted-2026-05-11
source: [15-VERIFICATION.md]
started: 2026-05-12T17:55:00Z
updated: 2026-05-12T17:55:00Z
---

## Current Test

[awaiting human testing on Windows via `npm run build:win` — formal testing happens in Phase 16]

## Tests

### 1. Audit Trail visual render (SMK3-15, SMK3-12)
expected: "Calculation Audit Trail" section renders below the metadata header with 4 labeled blocks. Inputs block shows real values for Plates, Sample count, Replicate mode, Premix selection (panel name + concentration), Old beads, Old antibodies, Number of setups. Intermediates block shows Beads vol/well, Antibodies vol/well, Dead volume with real values. Outputs block shows PE volume as a real number (not `—`). Diluent decision block shows the branch label and verbatim diluent strings. SAPE Name row appears in the metadata header above Sample Type.
result: [pending]

### 2. Historical-run banner render (SMK3-16)
expected: Amber banner appears above the audit trail: "This run was saved under previous calculation rules. Values displayed as recorded — no recompute on reopen." All snapshot-derived audit trail fields show `—`. No recomputation of any output occurs.
result: [pending]

### 3. Override badge render (D-15-08)
expected: "Old beads" row in the Inputs block shows an inline amber chip labeled "OVERRIDE". Hovering (or inspecting) the chip reveals tooltip text: "This value exceeded the 20% recommended cap at save time; operator confirmed override."
result: [pending]

### 4. PE volume formula on real panel data (SMK3-17)
expected: PE volume in the Outputs block equals the total assay volume (since 1÷1 = 1), ceiling-rounded to 0.1 mL.
result: [pending]

## Summary

total: 4
passed: 0
issues: 0
pending: 4
skipped: 0
blocked: 0

## Gaps
