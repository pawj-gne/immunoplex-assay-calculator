---
status: failed
phase: 04-run-documentation-persistence-deployment
source: [smoke test results.pdf]
tester: [colleague — domain expert, immunoplex workflow]
tested: 2026-04-23
recorded: 2026-04-23
artifact: dist/immunoplex-assay-calculator-0.5.0-x64-setup.exe
---

# Phase 4 Smoke Test Results

## Summary

Windows installer built, installed, and launched successfully. Functional walkthrough identified **3 blocking bugs** (one with data loss), **4 feature requests**, and **a data-model gap** (the three-reagent concentration/volume structure is not captured in the current schema).

**v1.0 release is blocked** until the three blocking bugs are fixed. The data-model gap and feature requests feed into v2.

## Result by HUMAN-UAT step

Cross-referenced against the 14 steps in [04-HUMAN-UAT.md](04-HUMAN-UAT.md):

| Step | Flow | Result | Blocking issues |
|------|------|--------|-----------------|
| 1-3 | Transfer, install, launch | PASS | — |
| 4 | Wizard step 1 (Platform & Species) | PASS | — |
| 5 | Wizard step 2 (Analytes) | FAIL | UI-01 |
| 6 | Wizard step 3 (Calculations) | FAIL | BUG-01, BUG-02 |
| 7 | Wizard step 4 (Document & Save) | PARTIAL | BUG-03 |
| 8 | Wizard step 5 (Finalized Run View) | PARTIAL | FEAT-01, FEAT-02, FEAT-03, FEAT-04 |
| 9 | Edit-warning modal | not explicitly verified | — |
| 10 | Edit + re-save (UPDATE) | not explicitly verified | — |
| 11 | Full close | not explicitly verified | — |
| 12 | Relaunch + Load round-trip | not explicitly verified | — |
| 13 | Operators Manage CRUD | not explicitly verified | — |
| 14 | Start New Run | not explicitly verified | — |

Steps 9-14 were not explicitly covered in the returned PDF; we should verify them on the next Windows build.

---

## Blocking bugs (must fix before v1.0 release)

### BUG-01 — Duplicate pair orientation is wrong

**Source:** PDF item 5 + screenshot (page 2)
**Severity:** High (domain-correctness)
**Where:** Plate layout UI, `src/renderer/src/features/plate/` (plateStore + getDuplicatePair utility)

**Observed:** In duplicates mode, samples are numbered horizontally across rows (row A wells 4-5 = sample 1, wells 6-7 = sample 2, wells 8-9 = sample 3, etc.).

**Expected (per domain expert):** Duplicates should run down the column, not across the row. Hamilton robots pipette column-wise, so column-major duplicate pairs match actual lab operation.

**Context / history:** The horizontal orientation was an explicit planning decision from Phase 3.3 (03.3-01 decision: "Duplicate pairs: horizontal (4-5, 6-7, 8-9, 10-11) + vertical (col 12) = 36 samples"). The domain expert's feedback contradicts that choice — the spec was wrong. A walk-through with the domain expert is needed to confirm the exact correct orientation (e.g., are sample 1's two wells A4+B4, or A4+A5, or something else) before we code the fix.

**Acceptance:** Duplicate pair generation matches how a Hamilton robot would pipette (column-major), confirmed with domain expert. 36-sample total remains correct.

---

### BUG-02 — Adding a new plate wipes the previous plate's data

**Source:** PDF item 6
**Severity:** **Critical — data loss**
**Where:** `src/renderer/src/stores/plateStore.ts` — plate-count / plate-switching logic

**Observed:** When the operator adds a second plate, plate 1's layout is lost.

**Expected:** Each plate stores its own well assignments independently (per the Phase 3 design — `Record<plateNumber, Set<WellId>>`). Adding a plate adds a new slot; previous plates persist.

**Context:** This is likely a regression introduced between Phase 3 (multi-plate support) and Phase 3.3 (interactive plate redesign). Worth a quick `git log` through plateStore to find where the reset-on-add was introduced.

**Acceptance:** Start with 1 plate, fill it, add plate 2, fill it, navigate back to plate 1 → original data is still there. Verified via `npm run build:win` installer.

---

### BUG-03 — Species missing from summary input

**Source:** PDF item 7a
**Severity:** Medium
**Where:** `src/renderer/src/features/run/components/FinalizedRunHeader.tsx` or `RunMetadataForm.tsx`

**Observed:** Species value doesn't carry over into the summary/metadata shown on the Document & Save or Finalized Run View steps.

**Expected:** Species should be visible in the metadata header alongside Platform, Panel, etc. Plan 04-04 frontmatter expected this.

**Acceptance:** Species appears in the FinalizedRunHeader metadata block.

---

## UI bug (block v1.0 release or defer to 4.1 — discuss)

### UI-01 — Analyte picker doesn't scope to selected panel

**Source:** PDF item 4 + screenshot (page 1)
**Severity:** Medium (correctness — can select invalid combinations)
**Where:** `src/renderer/src/features/analyte-selection/` (selection UI from Phase 3.3)

**Observed:** After selecting "Milliplex Mouse Premix Panel I 32-Plex", the analyte grid shows both Panel I analytes AND Panel II (23-Plex) analytes side-by-side. Both are selectable.

**Expected:** Selecting a premix panel should scope the visible/selectable analytes to that panel only. Panel I and Panel II must be mutually exclusive.

**Context:** Tension with 03.3 "unified analyte view" design — this was a deliberate choice at that phase to show all analytes as a single grid. Domain expert considers this an error, not a feature.

**Acceptance:** When a premix panel is selected, only that panel's analytes render. Switching between premix panels replaces the visible analyte set.

---

## Feature requests (v2 scope)

### FEAT-01 — Panel name visible on summary / finalized view

**Source:** PDF item 7b
**Why:** Traceability — reader needs to know which premix each selected analyte came from.

### FEAT-02 — Metadata block included in Finalized Run View

**Source:** PDF item 8a
**Why:** Operators read the finalized view as a bench sheet; they shouldn't have to flip back to check which operator/date/request the run belongs to.
**Current state:** FinalizedRunHeader exists but may not expose all metadata fields. Cross-check required.

### FEAT-03 — Calculation work shown in Finalized Run View

**Source:** PDF item 8b
**Why:** The bench sheet should show the actual reagent volumes, dilutions, and per-analyte calcs — not just the plate layout.
**Current state:** Phase 3 added PrepSheet/ReagentChecklist components; verify whether these render on the Finalized View or only on an earlier wizard step.

### FEAT-04 — PDF / printable version

**Source:** PDF item 8c
**Why:** Operators want a shareable, archived artifact (email to PI, save to batch records, etc.). Windows Print dialog (already wired in Phase 4) supports "Microsoft Print to PDF" — needs verification that the printable view is properly formatted for PDF rendering.

---

## Data-model finding (drives v2 spec rework)

### DM-01 — Three-reagent concentration/volume structure is not captured

**Source:** PDF items 1, 2, 3
**Impact:** The v2 upload spec I drafted at [`.planning/PANEL-UPLOAD-V2-SPEC.md`](../../PANEL-UPLOAD-V2-SPEC.md) captured only **one** concentration (per analyte) and **one** reagent volume (per master panel). That's wrong.

**The real model:**

| Platform | Beads conc / vol per well | ABS conc / vol per well | PE conc / vol per well |
|----------|---------------------------|-------------------------|-----------------------|
| Millipore (Human/Mouse/Rat) | 20× / 25 µL | 20× / 25 µL | 1× / 25 µL |
| Thermofisher (Human/Mouse/Rat) | 50× / 50 µL | 50× / 25 µL | 1× / 50 µL |
| Bio-Rad (Human/Mouse/Rat) | **variable per analyte** (20× or 10×) / 50 µL | **variable per analyte** / 25 µL | 100× / 50 µL |

**Key implications:**
1. Three separate reagent entities (Beads, ABS, PE), each with its own concentration AND per-well volume.
2. Concentration is typically **master-panel-level** (Millipore 20×, Thermo 50×) but **Bio-Rad needs per-analyte overrides** on Beads and ABS.
3. Volumes vary per reagent within a platform (e.g., Thermo: Beads/PE 50 µL, ABS 25 µL).
4. Calculator math will expand from one volume * one conc to three reagents computed separately.

**Action:** Before we plan v2, the [`PANEL-UPLOAD-V2-SPEC.md`](../../PANEL-UPLOAD-V2-SPEC.md) needs rewriting to capture this structure. The xlsx layout needs more columns (or per-reagent subheader sections). This is a substantial spec change, not a tweak.

**Additional input from PDF (item 3):**
- Concentration must be stored on a per-analyte table ✓ (aligned with v2 spec direction)
- Volumes of Bead/ABS/PE are variable inputs depending on (Platform, Species, Panel) ✓
- Concentration and volume must be editable by a manager (non-developer operator) without code changes — implies in-app admin UI or file-based source of truth (xlsx)
- Values should live in a table/datasheet (xlsx) — aligned

---

## Proposed disposition

### Immediate — Phase 4.1 (hotfix milestone patch)

Block v1.0 release. Scope:
- BUG-01 (duplicate pair orientation)
- BUG-02 (multi-plate data loss — critical)
- BUG-03 (species in summary)
- UI-01 (analyte picker panel scoping)

Route via `/gsd-insert-phase 4.1` to keep these out of v2 scope. Aim for fast turnaround — bugs are known, surface-level, and testable with the same smoke-test guide on a rebuilt Windows installer.

### Next — v2 spec rework

Revise [`.planning/PANEL-UPLOAD-V2-SPEC.md`](../../PANEL-UPLOAD-V2-SPEC.md) to capture:
- Three-reagent model (Beads, ABS, PE)
- Per-master-panel default concentrations + per-analyte Bio-Rad overrides
- Three volume fields (one per reagent) instead of one
- xlsx layout extended — likely new subheader columns or a per-reagent section

Once revised, run `/gsd-discuss-phase` on the updated spec.

### Then — v2 milestone

After 4.1 ships and v2 spec is locked:
- `/gsd-new-milestone v2`
- Plan phase: panel-upload-v2 (xlsx importer + schema migration)
- Plan phase: calculator-three-reagent-math (update calculator to compute per-reagent volumes)
- Plan phase: v2 UI changes for FEAT-01..04 (panel-scoped picker, PDF export, enriched finalized view)

---

## Notes for retest after 4.1

Send a fresh Windows installer with 4.1 fixes. In addition to the original 14 UAT steps, explicitly verify:

- Add plate 2, fill it, switch back to plate 1 — plate 1 data intact
- Select Panel I, verify only Panel I analytes show; switch to Panel II, verify only Panel II
- Duplicate layout matches the agreed-upon column-major orientation
- Species is visible in the summary / finalized view metadata
