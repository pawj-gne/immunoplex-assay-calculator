# Phase 14: Smoke 3 — Plate Page Input Expansion + UI Cleanup — Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-05-12
**Phase:** 14-smoke-3-plate-page-input-expansion-ui-cleanup-inserted-2026-
**Areas discussed:** Plate inputs layout / validation / cleanup; Bead region flat-list home; Premix deselection UX; Duplicate plate layout overhaul

---

## Gray Area Selection

| Option | Description | Selected |
|--------|-------------|----------|
| Plate inputs layout, validation & cleanup | Where 3 new inputs sit; mL precision; validation; PlatformCard/Selector cleanup | ✓ |
| Bead region flat-list home | Where flat list lives (SelectedAnalytesList? BeadRegionList? new?) |  |
| Premix deselection UX (SMK3-13) | Preserve singles vs clear; visual cue; D-4.1-04 interaction |  |
| Duplicate plate layout overhaul (SMK3-RPL-02) | Pair geometry; sample numbering; col-12 special case |  |

**User initially picked only Plate inputs layout, validation & cleanup**, but the discussion expanded to cover all four areas in follow-up rounds (user shared a screenshot illustrating the current duplicate layout, asked what "bead region flat list home" meant, then picked recommended defaults for premix deselection).

---

## Plate inputs layout, validation & cleanup

### Q: Where should the three new inputs (Old Beads, Old Antibodies, Number of Setups) sit in the current Calculator Inputs panel?

| Option | Description | Selected |
|--------|-------------|----------|
| Grouped 'Reagent Adjustments' block below Replicate Mode | Three inputs in their own labeled section | |
| Inline above Sample Count, in PRD order | Matches PRD §Third Step ordering literally | ✓ (with addition) |
| Compact row alongside Replicate Mode | Pack into a single horizontal row | |
| Chat more — I want to describe the layout I have in mind | Open the floor | |

**User's choice:** Option 2 + add a Number of Plates input.
**Notes:** User clarified that the only absolute critical inputs are Number of Samples and Number of Plates — per-plate sample counts are non-critical. PRD order: Plates → Replicate → Samples → Old Beads → Old Antibodies → Setups.

### Q: Decimal precision + step for Old Beads / Old Antibodies (mL):

| Option | Description | Selected |
|--------|-------------|----------|
| 0.1 mL step, allow any non-negative decimal typed | step='0.1' min='0' | |
| 1 mL step, integers preferred | step='1' | |
| 0.01 mL step, max precision | step='0.01' | |

**User's choice:** (initial answer misread the question — provided ceiling rounding rule). On clarification, user said floor (round DOWN) to 0.1 mL: 1.51 → 1.5, 1.59 → 1.5.
**Notes:** Deliberate asymmetry vs. the calculator's 0.1 mL ceiling output rule (SMK3-06). Old reagents conservative (round down); new reagents conservative (round up).

### Q: What happens when total old reagent exceeds the calculated new-reagent volume?

| Option | Description | Selected |
|--------|-------------|----------|
| Allow & clamp new reagent to 0; show inline note | Floor-clamp + 'No new reagent needed' | |
| Allow but flag with validationError banner | Same math, red banner | |
| Reject input — cap Old at calculated new reagent | Snap-back to cap | |

**User's choice:** Custom rule — old reagents capped at 20% of total reaction volume (including dead volume).
**Notes:** Not in PRD. User-defined constraint. Per-reagent cap (each reagent independent).

### Q: PlatformCard footer cleanup after stock-conc removal:

| Option | Description | Selected |
|--------|-------------|----------|
| Remove entire footer block including border-t separator (Recommended) | Card becomes Title + badge + description | ✓ |
| Keep border-t but leave footer empty | Subtle separator stays | |
| Replace with different micro-fact | New data display (scope creep) | |

**User's choice:** Remove entire footer block.

---

## Follow-up: Plate count input ↔ PlateToolbar interaction

### Q: How should the new Number of Plates input relate to PlateToolbar Add/Remove buttons?

| Option | Description | Selected |
|--------|-------------|----------|
| Bidirectional: input + toolbar both edit the same plateCount | Live sync | (chosen via clarification) |
| Replace PlateToolbar Add/Remove — input is the only control | Drop toolbar buttons | |
| Input is read-only display — toolbar buttons remain the only editors | Display only | |

**User's choice:** Bidirectional. User reframed the problem: "the only absolute we know is number of samples and number of plates. We don't know how many samples per plate" — meaning per-plate well assignment is non-critical visualization, not a calc input.

---

## Follow-up: Floor-rounding timing

### Q: When does the 0.1 mL floor rounding kick in?

| Option | Description | Selected |
|--------|-------------|----------|
| Store raw, ceiling-round at calculator-input time (Recommended for ceiling; adapted to floor) | Field keeps raw; calc consumes rounded | ✓ |
| Round on blur — displayed value snaps | WYSIWYG | |
| Round on every keystroke | Self-correct as user types | |

**User's choice:** Option 1 — store raw, floor-round at consumption.

---

## Follow-up: 20%-cap override UX

### Q: Override mechanism style for the cap:

| Option | Description | Selected |
|--------|-------------|----------|
| Confirm-once modal: 'X exceeds 20% (Y). Override?' → Yes/Cancel (Recommended) | Modal pops first time over | ✓ |
| Inline checkbox: 'I confirm — use override' | No modal, just a checkbox | |
| No re-prompt: override stays on until input changes | Sticky override | |

**User's choice:** Confirm-once modal.

---

## Follow-up: 20%-cap scope

### Q: Is the 20% cap per-reagent or combined?

| Option | Description | Selected |
|--------|-------------|----------|
| Per-reagent, against each reagent's own total reaction volume (Recommended) | Old Beads ≤ 20% of bead total; Old Antibodies ≤ 20% of antibody total | ✓ |
| Combined: (Old Beads + Old Antibodies) ≤ 20% of combined total | One unified cap | |
| Per-reagent against assay-level total (no dead volume) | Stricter cap | |

**User's choice:** Per-reagent against own total reaction volume (incl. dead).

---

## Duplicate plate layout overhaul (SMK3-RPL-02)

User shared a screenshot of the current layout demonstrating the asymmetry between samples 1-32 (horizontal pairs in cols 4-11) and samples 33-36 (vertical pairs in col 12). User pointed out: "sample 33-36 are in different sequence compared to other samples" — confirming SMK3-RPL-02's goal of uniform vertical-pair-within-column geometry.

### Q: Sample numbering / fill order across the plate:

| Option | Description | Selected |
|--------|-------------|----------|
| Column-first: col 4 fills (samples 1-4), then col 5 (5-8), … col 12 (33-36) (Recommended) | Matches singles snake | ✓ |
| Row-first: row A fills first across all cols | Different from singles | |

**User's choice:** Column-first.

### Q: Within a column, which pair-of-rows order?

| Option | Description | Selected |
|--------|-------------|----------|
| (A,B) → (C,D) → (E,F) → (G,H) — top-to-bottom adjacent rows (Recommended) | Literal PRD reading | ✓ |
| (A,B) → (C,D) → (E,F) → (G,H) but offset for standards | Extra logic | |

**User's choice:** Option 1 (with side comment questioning whether auto-fill order matters when sample count per plate is unknown — clarified that pair geometry locks regardless; auto-fill is a default when sample count is set without manual well clicks).

---

## Bead region flat-list home (SMK3-14)

User asked "what is bead region flat list home?" — clarified that "home" = where the new flat list lives in the UI (replace SelectedAnalytesList? replace BeadRegionList? new surface?).

### Q: Where does the new flat list of analytes (TA, sorted by bead region) live in the UI?

| Option | Description | Selected |
|--------|-------------|----------|
| Replace SelectedAnalytesList grouping — right sidebar on selection page (Recommended) | Flat list sorted by bead region replaces panel/singles grouping | ✓ |
| Replace BeadRegionList placeholder — inside printable PrepSheet | Lives in run summary | |
| Both — same flat list in both surfaces | One shared component | |
| New surface — dedicated 'Bead Regions' tab/section | New surface | |

**User's choice:** Replace SelectedAnalytesList grouping.

---

## Premix deselection UX (SMK3-13)

### Q: Discuss it or pick recommended defaults?

| Option | Description | Selected |
|--------|-------------|----------|
| Discuss it — has nuance worth deciding (Recommended for SMK3-13) | Tradeoffs worth a conversation | |
| Recommended defaults: preserve singles, surface returnable members in singles grid without ceremony | Override D-4.1-04 for this case | ✓ |
| Recommended defaults: keep current clear-singles behavior, members just become re-selectable | Conservative read | |

**User's choice:** Preserve singles, surface returnable members without ceremony.

---

## Claude's Discretion

- File splits — OldReagentCapModal location
- Visual treatment of floor/ceiling asymmetry — tooltip on input?
- Bead region sort tiebreaker for non-numeric values
- Whether setOldBeads / setOldAntibodies store typed or floor-rounded value
- Always-on cap helper text vs. on-exceed
- Number-of-Plates input debounce vs blur-only commit
- lib/calculator.ts signature extension vs separate applyOldReagentSubtraction
- validationError shape (string vs structured)
- Modal primitive reuse vs bespoke

## Deferred Ideas

- Multi-premix selection (PRD allows it but selectionStore is single-premix)
- Vendor singles term UI (VTRM-01, VTRM-02)
- Tooltip explaining floor/ceiling asymmetry
- Per-reagent override audit log (belongs in Phase 15)
- Override re-prompt policy refinement
- Always-on per-input cap helper text vs. on-exceed only
- Number of Plates input debounce policy
