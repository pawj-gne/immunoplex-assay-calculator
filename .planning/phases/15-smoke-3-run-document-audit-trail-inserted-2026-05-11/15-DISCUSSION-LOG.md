# Phase 15: Smoke 3 — Run Document Audit Trail — Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in `15-CONTEXT.md` — this log preserves the alternatives considered.

**Date:** 2026-05-12
**Phase:** 15-smoke-3-run-document-audit-trail-inserted-2026-05-11
**Areas discussed:** Panel data flow, Audit trail rendering, Historical-run handling, PE volume + edge cases

---

## Panel data flow

### Q1: How should SAPE Name, SAPE concentration, and per-reagent diluents reach the audit trail?

| Option | Description | Selected |
|--------|-------------|----------|
| Snapshot at save (recommended) | Denormalize sapeName + sapeConcentration + beadsDiluent + antibodiesDiluent + per-reagent volume/well onto the runs row at save time. Audit trail reads from RunRecord; never re-fetches. SMK3-16 fidelity automatic. | ✓ |
| Live fetch via new IPC | New IPC channel + master-panel renderer store. Audit trail looks up master_panel_reagents at render time. Violates SMK3-16 if lab re-imports between save and reopen. | |
| Hybrid | Snapshot only sapeName + sapeConcentration; live-fetch diluents. Mixed model; future maintainer must know which fields are frozen vs live. | |

**Notes:** SMK3-16 fidelity was the deciding factor — snapshot-at-save makes it automatic.

### Q2: If we go snapshot-at-save, when does the snapshot capture happen?

| Option | Description | Selected |
|--------|-------------|----------|
| At RunCreate build time (recommended) | Extend buildRunSnapshot in useRunSnapshot.ts. Renderer-side capture, symmetric with how volumePerWell/deadVolume are already snapshotted. Single capture point. | ✓ |
| At repository layer in main process | RunRepository.create reads master_panel_reagents and stuffs fields onto the DB row before INSERT. Cleaner main/renderer split but harder to test. | |
| Two-stage | Renderer sends panelId; main process fetches + denormalizes inside a transaction. Equivalent to option 2 with explicit transactional read. | |

### Q3: What master-panel fields do we actually snapshot onto each run?

| Option | Description | Selected |
|--------|-------------|----------|
| SAPE Name + SAPE concentration (required) | Required for SMK3-12 + SMK3-17. Smallest set. | ✓ |
| Beads diluent + Antibodies diluent strings (recommended) | Verbatim Values-block strings; needed for the audit trail's diluent decision row. | ✓ |
| Beads volume/well + Antibodies volume/well (recommended) | Per-reagent vol/well values; calculatorStore only has a single volumePerWell today. | ✓ |
| Premix concentrations | Needed so the audit trail can show "Panel III (1×) wins" on reopen. | ✓ |

**Notes:** All four selected — the audit trail needs the full set to render the four blocks correctly on reopen.

### Q4: Pre-Phase-15 historical runs lack these snapshotted fields. How should the audit trail handle them?

| Option | Description | Selected |
|--------|-------------|----------|
| Render "—" for missing fields (recommended) | Audit trail tolerates null/undefined; renders em-dash. Banner from area 3 explains why. Matches the no-backfill principle. | ✓ |
| Backfill from current master-panel data | Risk: silent drift after a panel re-import. NOT advisable. | |
| Mark explicitly with advisory + show "—" | Same as option 1 plus per-field advisory. Overlaps with the area-3 banner decision. | |

---

## Audit trail rendering

### Q1: Where in the finalized run document does the audit-trail section live?

| Option | Description | Selected |
|--------|-------------|----------|
| Above PrepSheet (recommended) | New `<section>` between FinalizedRunHeader and PrepSheet. Doesn't touch Phase 3 components. Reading order: audit (WHY) → prep recipe (WHAT/HOW). | ✓ |
| Below the PlateGrid (last) | Audit trail at bottom. Treated as supplementary detail. | |
| Replace VolumesSummary inside PrepSheet | Couples Phase 3 PrepSheet to Phase 15. Risks breaking the read-only reuse contract Phase 4-04 preserved. | |

### Q2: What rendering style for the audit trail body?

| Option | Description | Selected |
|--------|-------------|----------|
| Four labeled blocks (recommended) | Four sequential `<div>`s with H3/H4 headings: Inputs / Intermediates / Outputs / Diluent decision. Each uses 2-column `<dl>` matching FinalizedRunHeader style. | ✓ |
| Single combined table | One `<table>` with all line items, columns Step/Field/Value/Unit. Dense, less PRD-mirror. | |
| Numbered list with formula annotations | Inline computation: "1. Total wells = 148 + 48 = 196", etc. Most pedagogical but verbose. | |

### Q3: Which fields belong in EACH of the four audit-trail blocks?

| Option | Description | Selected |
|--------|-------------|----------|
| PRD-literal mapping (recommended) | Maps SMK3-15 verbatim. Inputs/Intermediates/Outputs/Diluent populated exactly as the PRD §Calculation describes. | ✓ |
| PRD-literal + extras | Adds TSC/TA under Inputs and override badge under Intermediates. | |
| Compressed | Skip per-reagent breakdown; just show Inputs/Total Volume/Diluent. | |

**Notes:** PRD-literal selected; the override badge from Phase 14's deferred item moved into area 3 (Historical-run handling) under Inputs block per the override-badge decision below.

### Q4: How does the diluent decision row display the resolver's choice?

| Option | Description | Selected |
|--------|-------------|----------|
| Branch label + per-reagent rows (recommended) | Top line names the rule applied; 2-row mini table for per-reagent diluent strings. Covers both branches of resolveDiluent unambiguously. | ✓ |
| Per-reagent only | Just two rows, operator infers branch from values. Smallest markup. | |
| Single statement | One line summary. Loses precision when reagents have different fallback diluents. | |

---

## Historical-run handling

### Q1: How is a historical run flagged as "computed under previous calculation rules"?

| Option | Description | Selected |
|--------|-------------|----------|
| Schema marker column (recommended) | Add runs.calculationRulesVersion (default 'smoke3' new saves; NULL/'pre-smoke3' migrated rows). Future-proof for v1.x rule changes. | ✓ |
| Heuristic on snapshotted SAPE fields | If sapeName + sapeConcentration are null, show advisory. Piggybacks on the snapshot. Misfires for panels genuinely lacking SAPE name. | |
| Heuristic on createdAt date | If createdAt < 2026-05-13, show advisory. Brittle — re-saving an old run loses the flag. | |

### Q2: Where does the advisory note render in the finalized run document?

| Option | Description | Selected |
|--------|-------------|----------|
| Banner above audit trail (recommended) | Amber alert banner between FinalizedRunHeader and the audit-trail section. Operator sees it before reading the calc work. | ✓ |
| Inline in metadata header | Small italic inside FinalizedRunHeader. Less visually loud. | |
| Inline at each affected field | Per-field "(saved before Smoke 3)" inline. Visually noisy. | |

### Q3: Phase 14 deferred the 20%-cap override audit entry to this phase. How should it appear in the audit trail?

| Option | Description | Selected |
|--------|-------------|----------|
| Badge under Inputs block (recommended) | Amber OVERRIDE chip beside Old Beads / Old Antibodies lines when override accepted. Persist oldBeadsOverride + oldAntibodiesOverride flags. | ✓ |
| Separate "Overrides" mini-block | Dedicated mini-block between Inputs and Intermediates. More markup, easier QA scan. | |
| Skip — defer further | Don't track override flag for now. SMK3-15's "full audit trail" would technically omit override state. | |

### Q4: What handles the case where a pre-Phase-15 RunRecord has missing snapshotted fields at audit-trail render time?

| Option | Description | Selected |
|--------|-------------|----------|
| Single-character placeholder (recommended) | Render "—" (em-dash) in value cells. Banner provides context. Pattern Phase 4 used for missing comments. | ✓ |
| Full explanatory text per field | "Not recorded (saved before Smoke 3)" per field. Verbose; may feel patronizing after the banner. | |
| Hide the field entirely | Skip rendering null rows. Audit trail shape varies between runs, harder to compare. | |

---

## PE volume + edge cases

### Q1: PRD says PE volume = Total Volume of the Assay ÷ SAPE concentration. What exact value is "Total Volume of the Assay"?

| Option | Description | Selected |
|--------|-------------|----------|
| finalVolume (rounded-up, recommended) | Use the 0.1-mL-ceiling-rounded finalVolume. Matches the value displayed elsewhere on the document. Hand calc reproduces the displayed PE volume. | ✓ |
| rawVolume (un-rounded) | Mathematically pure but doesn't match what the operator sees. | |
| Per-reagent total (old + new + dead, before SAPE term) | Granular interpretation, disagrees with PRD wording. | |

### Q2: PE volume formula when SAPE concentration is null/0/undefined?

| Option | Description | Selected |
|--------|-------------|----------|
| Default to 1× silently (recommended) | Treat as 1×; PE volume = totalVolume. PRD note says "typically 1×". No banner. Pre-Phase-15 runs get PE volume = totalVolume automatically. | ✓ |
| Default to 1× with inline note | Same math + inline "SAPE conc not specified — using 1× default". Explicit fallback signal. | |
| Render N/A and block compute | Force lab to fix panel data. Breaks every pre-Phase-15 historical run. | |

### Q3: Where else (outside the audit trail) does PE volume appear?

| Option | Description | Selected |
|--------|-------------|----------|
| Audit trail only (recommended) | PE volume is a Smoke 3 audit concept; surface only in audit-trail Outputs block. PrepSheet's VolumesSummary keeps its current Phase 3 behavior. | ✓ |
| Audit trail + PrepSheet | Update VolumesSummary too. Single source of truth but couples to Phase 3 surface. | |
| Audit trail + new dedicated line item | Standalone PE Volume line at top of PrepSheet plus audit trail. | |

### Q4: PE volume rounding — follow the 0.1-mL ceiling rule that applies to all other output volumes?

| Option | Description | Selected |
|--------|-------------|----------|
| Round UP to 0.1 mL (recommended) | Consistent with SMK3-06 — every output volume rounds UP to 0.1 mL ceiling. Operator never under-preps. | ✓ |
| Keep 2+ decimal places | Pedantic accuracy, inconsistent with the rest of the document. | |
| Match SAPE concentration significant figures | Pedagogical but unusual UX. | |

---

## Claude's Discretion

Areas where the user did not explicitly hand-pick:

- Audit trail component split (single `AuditTrailSection.tsx` vs four block-component files) — recommended single component for v1.0.
- CSS treatment of the override badge — recommended inline Tailwind for v1.0 (single use site).
- Whether the audit trail prints on Ctrl-P — defaulting to yes (inherits FinalizedRunView's print stylesheet).
- Migration column for `calculationRulesVersion` value on existing rows: `null` vs `'pre-smoke3'` — planner picks; renderer treats them identically.
- IPC channel naming for the save-time master-panel fetch — planner to confirm whether Phase 13 already exposes a suitable channel.

## Deferred Ideas

Ideas mentioned during discussion that were noted for future phases:

- Wiring `resolveDiluent` into the live calculator output path — audit-trail-only for v1.0; reconcile with VolumesSummary in a future v1.x task.
- Multi-premix snapshotting — selectionStore is still single-premix per Phase 14; revisit when/if the selection model grows.
- Audit trail printability toggle (prep-recipe-only printing) — defer to v1.x if operators ask.
- Backfill of pre-Phase-15 historical runs — declined; em-dash + banner is the v1.0 strategy.
- Snapshot freshness check on save — tolerable for v1.0 (single-machine); revisit when Phase 6 networking ships.
