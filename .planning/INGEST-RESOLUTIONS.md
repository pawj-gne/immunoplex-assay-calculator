# Ingest Resolutions — Smoke 3 PRD (2026-05-11)

**Ingest source:** `.planning/inbox/Smoke 3.docx` → converted to `.planning/SMOKE-3-PRD.md`
**Ingest mode:** merge
**Conflict report:** [.planning/INGEST-CONFLICTS.md](./INGEST-CONFLICTS.md) — 4 BLOCKERs, 3 WARNINGs, 5 INFO
**Operator:** jonathan.s.paw@gmail.com (lab owner)
**Orchestrator rule for this ingest:** **PRD wins every blocker.** Smoke 3 PRD is the new source of truth; locked v1/v2 decisions are superseded where they conflict.

This file is the audit trail. It records every decision made during the conflict-resolution pass, the alternative options considered, and the artifacts each decision supersedes or extends. Phase plans (Smoke 3 calculator-rule migration, parser v3 rewrite, UI updates, run-doc audit-trail expansion) should reference these IDs.

---

## A. Auto-resolutions from the BLOCKER bucket (4)

The four blockers in `INGEST-CONFLICTS.md` all resolve in favor of the PRD per the orchestrator rule.

| ID | Blocker | Resolution | Supersedes |
|----|---------|------------|------------|
| **R-01** | Panel-data file shape (3 incompatible schemas) | Smoke 3 sectioned `Criteria / Values / Category` xlsx is canonical | [`PANEL-UPLOAD-V2-SPEC.md`](./PANEL-UPLOAD-V2-SPEC.md) (marked SUPERSEDED); current `src/main/import/parser.ts` (scheduled for v3 rewrite) |
| **R-02** | Per-reagent fields (volume/well, diluent, SAPE Name) | `master_panels` grows per-reagent rows: Beads / Antibodies / SAPE each carry their own Concentration + Diluent + Volume/well. SAPE has a vendor-named "SAPE Name" field. | `REQUIREMENTS.md` MPAN-01 (single `reagent_volume_per_well` field), CALV-01 (single-value resolution path) |
| **R-03** | Rounding precision | **Round UP to nearest 0.1 mL** (ceiling at 0.1 mL — chosen via Q2 over half-up / banker's) | `REQUIREMENTS.md` CALC-06 ("up to nearest mL"), `STATE.md` decision 02-01 ("Final volume always rounds UP to nearest mL"), `PROJECT.md` §Domain Rules |
| **R-04** | Diluent selection rule | **Concentration-keyed:** if ANY selected premix is 1×, that premix is the diluent for Beads + Antibodies (no ordering — any 1× premix wins). If all selections are >1×, fall back to the Values-table diluent for each reagent (PRD-silent gap explicitly filled by operator). | `PROJECT.md` §Domain Rules ("Premix + singles: premix is the diluent" / "Full custom: Assay Buffer is the diluent" — request-type-keyed rule). Assay Buffer fallback dropped; replaced by Values-table per-reagent diluent. |

## B. Auto-resolutions from the WARNING bucket (3)

| ID | Warning | Resolution |
|----|---------|------------|
| **R-05** | CALC-05 max-5 singles cap not mentioned in PRD | **Retained.** Operator confirmed PRD silence ≠ removal; the v0.1.0 cap stays. Annotate CALC-05 with explicit confirmation date. |
| **R-06** | Three-format codebase/planning split | Resolved by R-01. v0.7.0 parser (`src/main/import/parser.ts`) and `PANEL-UPLOAD-V2-SPEC.md` both flagged for retirement in the new parser-v3 phase. Legacy CSV templates also removed (see R-15). |
| **R-07** | "Number of setups" as new user input | **Accepted as new requirement.** Default 1, min 1, no explicit max. Dead volume = `number_of_setups × 2 mL`. Captured as SMK3-03 below. |

## C. New decisions covering PRD-silent gaps (5)

PRD doesn't address these — operator answers fill the gaps explicitly.

| ID | Gap | Resolution |
|----|-----|------------|
| **R-08** | Old Reagent input shape | **Two separate fields:** Old Beads (mL) and Old Antibodies (mL). Each ≥ 0. Subtracted from its respective new-reagent calc. |
| **R-09** | Replicate Mode enumeration | Single + Duplicate only (as shipped — no Triplicate, no custom replicate count). |
| **R-10** | Plate layout for Duplicate mode | **Adjacent rows in the same column.** Samples 1–4 fill column 4 as (A4,B4)+(C4,D4)+(E4,F4)+(G4,H4); samples 5–8 fill column 5; continues across columns 4–12 (9 cols × 4 samples = 36 = the CALC-01 cap). |
| **R-11** | Panel name canonical form | **Normalize Roman → Arabic on import.** `Panel I` → `Panel 1` at parse time. Lab can author either form; calculator displays + queries against the normalized Arabic form. |
| **R-12** | Premix deselection behavior | **Re-enable as singles, do NOT auto-add.** When user removes a premix, its member analytes return to the singles pool selectable; they aren't auto-selected. Honors the CALC-05 max-5 cap (no surprise overage). |

## D. New decisions covering PRD-internal ambiguities (3)

PRD mentions but doesn't specify operationally — operator chooses.

| ID | Ambiguity | Resolution |
|----|-----------|------------|
| **R-13** | "Variable" concentration in Bead/Antibody Values rows | **Author shorthand.** Importer ignores the literal `variable` cell; real concentration is read from the per-analyte Concentration column. The `variable` label is a lab-internal note, not a data field. |
| **R-14** | "1 through 7" range strings + Table tab authority | **Per-panel tabs are authoritative.** Importer enumerates panels by scanning sheet names. The Table tab is decorative — not consumed by the parser. Range strings irrelevant. |
| **R-15** | Diluent value enumeration | **Open-ended free text.** Whatever the lab writes (e.g., `L-AB`, `n/a`, etc.) is stored verbatim. No enum; no normalization. Calculator surfaces the diluent string in calculations and outputs. |

## E. New requirements derived from the PRD (17)

Net-new requirements (or requirement extensions) the calculator must satisfy after Smoke 3 adoption. All carry the `SMK3-` namespace and trace to the canonical PRD at [`SMOKE-3-PRD.md`](./SMOKE-3-PRD.md).

| ID | Requirement | Trace |
|----|-------------|-------|
| **SMK3-01** | Calculator UI removes "Stock concentration: Xx" labels from platform selection screens ([`PlatformCard.tsx:44-47`](../src/renderer/src/features/platform/components/PlatformCard.tsx#L44-L47), [`PlatformSelector.tsx:57,60`](../src/renderer/src/features/platform/components/PlatformSelector.tsx#L57-L60)). "Platform Selected: {name}" header retained. | PRD §Hierarchy of UI interaction — First Step |
| **SMK3-02** | Plate page exposes **Old Beads** numeric input (mL, ≥ 0, default 0). | PRD §Third Step + R-08 |
| **SMK3-03** | Plate page exposes **Old Antibodies** numeric input (mL, ≥ 0, default 0). | PRD §Third Step + R-08 |
| **SMK3-04** | Plate page exposes **Number of Setups** numeric input (default 1, min 1, no max). | PRD §Third Step + R-07 |
| **SMK3-05** | Dead volume = `number_of_setups × 2 mL`. Extends CALC-03 (previously dead volume was a single additive constant). | PRD §Calculation — Calculation of the Dead volume + R-07 |
| **SMK3-06** | Final volumes round UP to nearest **0.1 mL** (ceiling at 0.1 mL). Supersedes CALC-06 + decision 02-01. | PRD §Calculation — Variables — Volume/well + R-03 |
| **SMK3-07** | Diluent for Beads + Antibodies: if any selected premix is 1×, that premix is the diluent; else fall back to the Values-table diluent for each reagent. Supersedes the request-type-keyed rule in `PROJECT.md` §Domain Rules. | PRD §Calculation — Variables — TSC + R-04 |
| **SMK3-08** | Importer accepts the Smoke 3 sectioned xlsx format (`Criteria` / `Values` / `Category` blocks per sheet; per-reagent rows in Values; Premix matrix in Category with Premix Concentration row + Count column + Analyte columns). Supersedes `PANEL-UPLOAD-V2-SPEC.md` and the v0.7.0 parser. | PRD §Database + R-01 |
| **SMK3-09** | Importer normalizes panel name Roman → Arabic at parse time. `Panel I` / `Panel II` / `Panel III` → `Panel 1` / `Panel 2` / `Panel 3`. | R-11 |
| **SMK3-10** | Importer enumerates panels from sheet names; the master `Table` tab is ignored by the parser. | R-14 |
| **SMK3-11** | Re-upload of a (Platform, Species, Panel) triple **wholesale replaces** the existing panel's analytes + premixes + metadata. Supersedes MPAN-05 (upsert-with-orphans). | R from question batch 3 |
| **SMK3-12** | SAPE Name (e.g., `SAPE-10`) is displayed in the run document for traceability. No calculation impact. Stored as panel metadata. | R from question batch 4 |
| **SMK3-13** | When user deselects a premix, its member analytes return to the singles pool as selectable but are NOT auto-added to the selection. | R-12 |
| **SMK3-14** | Bead region display is a **flat list** of every analyte (TA — Total Analytes, not just TSC): both premix members and standalone singles in one combined list, sorted by bead region. | PRD §Second Step + R from question batch 5 |
| **SMK3-15** | Run document calculation breakdown shows **full audit trail**: inputs (plates, samples, replicate mode, selections, old reagents, setups) → intermediate steps (total wells, volume/well, total bead/antibody, dead volume) → final outputs (new reagents, total volumes, PE volume) → **diluent decision** (which premix won, or which Values-table diluent applied). | PRD §Calculation — Show all calculation work + R from question batch 5 |
| **SMK3-16** | Historical run records saved before Smoke 3 rules ship are **snapshot-frozen.** Reopening shows the persisted values; new rules apply only to new runs. No retroactive recompute. | R from question batch 5 |
| **SMK3-17** | PE volume = `Total Volume of the Assay ÷ SAPE concentration` (read from the SAPE row in the panel's Values block, typically 1×). | PRD §Calculation — Calculation of PE volume + R from question batch 4 |

## F. Cascading impacts on existing artifacts

Changes triggered by the resolutions above. Captured here so each is traceable to a resolution ID.

### Files to mark SUPERSEDED (preserve for history)

- **`PANEL-UPLOAD-V2-SPEC.md`** — supersedes-by: `SMOKE-3-PRD.md` (R-01). Add SUPERSEDED banner at top.

### Files to modify

- **`PROJECT.md`** — §Domain Rules: rewrite rounding (R-03), diluent (R-04), dead volume (R-05/R-07). Add §Source of Truth: Smoke 3 PRD.
- **`REQUIREMENTS.md`** — annotate CALC-05 (R-05), CALC-06 (superseded by SMK3-06), CALC-03 (extended by SMK3-05); annotate MPAN-01 (per-reagent growth needed for SMK3-08), MPAN-05 (superseded by SMK3-11), CALV-01 (per-reagent resolution path for SMK3-08); annotate PIMP-01..10 as SUPERSEDED by SMK3-08; add new §Smoke 3 PRD Requirements section with SMK3-01..17.
- **`ROADMAP.md`** — add new phases for: (a) Calculator rule migration + UI cleanup (SMK3-01, 05, 06, 07, 12, 13, 14, 16), (b) Plate page input expansion (SMK3-02, 03, 04), (c) Parser v3 rewrite (SMK3-08, 09, 10, 11), (d) Run document audit-trail revision (SMK3-15, 17). Mark Phases 8–10 (XLSX parser/importer/calculator-wiring) as SUPERSEDED — their underlying spec (PANEL-UPLOAD-V2-SPEC.md) is replaced.
- **`STATE.md`** — append decisions log entries for R-01..R-15; update `last_updated` to 2026-05-11; bump `last_activity`.

### Code to change (scope for Phase 8/12 planning, not this ingest)

- `src/renderer/src/features/platform/components/PlatformCard.tsx:44-47` — remove "Stock Concentration" lines (SMK3-01).
- `src/renderer/src/features/platform/components/PlatformSelector.tsx:57,60` — remove "Stock concentration" line + "Ready to proceed" line (SMK3-01).
- `src/main/import/parser.ts` — full rewrite (SMK3-08).
- Calculator core (rounding precision, dead volume formula, diluent rule) — `src/renderer/src/lib/calculator.ts`, `src/renderer/src/lib/decimal.ts`.
- Plate page UI — add Old Beads / Old Antibodies / Number of Setups inputs.
- Run document templates — full audit trail layout (SMK3-15).
- DB schema delta — per-reagent rows in `master_panels`, SAPE Name column, optional diluent column per reagent (SMK3-08).
- `templates/panel-template.csv`, `sample-panel-import.csv` — delete in the parser v3 phase (R-15-ish — confirmed via question batch 4).

### Extracted assets

- 17 CSVs at `templates/panels/` extracted from `Immuno Table for Calculator.xlsx`. **All 17 fail the current importer** (0/17 pass — root cause: `Cell A1 must be "Panel Name"`). They will be valid inputs once the parser v3 rewrite (SMK3-08) lands. Re-run dry-run as part of that phase's UAT.
- 9 PRD mockup images at `.planning/inbox/smoke-3-images/` — useful reference for the UI cleanup + Plate page expansion phases. Currently gitignored; promote to a tracked location during phase planning if helpful.

---

*Ingest closed: 2026-05-11. Re-running `/gsd-ingest-docs` on a revised Smoke 3 PRD would re-detect all SMK3- requirements; this file is the human-readable record of how the v1/v2 decisions got there.*
