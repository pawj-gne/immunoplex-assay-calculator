## Conflict Detection Report

Mode: merge
Ingest set: 1 doc (smoke-3.md, PRD, manifest-tagged, high confidence)
Existing context loaded: PROJECT.md, REQUIREMENTS.md, ROADMAP.md, STATE.md, PANEL-UPLOAD-V2-SPEC.md (treated as LOCKED per orchestrator instruction — it is referenced as the v2 contract from PROJECT.md even though /gsd-discuss-phase has not formally sealed it).

Precedence: ADR > SPEC > PRD > DOC. No per-doc override. The incoming doc is PRD; PANEL-UPLOAD-V2-SPEC.md is SPEC and locked. Any PRD↔SPEC contradiction that touches a locked decision is a BLOCKER per orchestrator instruction.

### BLOCKERS (4)

[BLOCKER] Panel-data file shape contradicts LOCKED v2 spec
  Found: smoke-3.md describes a sectioned "Criteria / Values / Category" per-tab layout with fields Panel Name, Panel Description, Platform, Species, Panel, Diluent (per reagent), Volume-per-reagent, SAPE Name, Premix Count column — plus a separate "Table" summary tab listing which Panels exist per (Platform, Species)
    source: /Users/pawj/Lab_Dev/immunoplex-assay-calculator/.planning/inbox/smoke-3.md §Database, §Hierarchy of UI interaction
  Expected: PANEL-UPLOAD-V2-SPEC.md §Per-tab layout (locked) requires B1 = Panel Name, B2 = Platform, B3 = Species, B4 = Reagent Volume (single value), row 5 blank, A6 = vendor singles term, row 7 literal headers "Target / BeadRegion / Concentration", premix columns starting at col E with literal "Target" headers in row 7. No "Panel Description", no per-reagent diluent column, no SAPE Name field, no Premix Count column, no separate Table summary tab.
    source: /Users/pawj/Lab_Dev/immunoplex-assay-calculator/.planning/PANEL-UPLOAD-V2-SPEC.md §Per-tab layout (locked), §Metadata fields
  Resolution required: Three incompatible file shapes are now in play — (a) the v1 CSV importer shipped in Phase 6 (parser.ts expects `Panel Name` at A1 + `Target` / `Bead Region` / `Single Concentration` header row + `sub-panel conc` row), (b) the v2 draft spec, and (c) the Smoke 3 PRD. Pick one canonical shape before any further v2 planning (Phase 8 XLSX Parser cannot start without this). Likely options: rewrite PANEL-UPLOAD-V2-SPEC.md to match the Smoke 3 lab-owner format, or push back on Smoke 3 to align with the v2 spec, or define a new v3 spec that supersedes both.
  → Decision needed: which schema is canonical? Resolve before routing this PRD to the roadmapper.

[BLOCKER] Per-reagent fields (volume/well, diluent, SAPE Name) contradict LOCKED v2 spec
  Found: smoke-3.md asserts Beads, Antibodies, and SAPE each have their own concentration, diluent, and volume/well in the panel tab. SAPE has a vendor-named "SAPE Name" field. Diluent for beads/antibodies is selection-dependent (1× premix → that premix; > 1× → values-table diluent).
    source: /Users/pawj/Lab_Dev/immunoplex-assay-calculator/.planning/inbox/smoke-3.md §Hierarchy of UI interaction — Third Step, §Calculation — Variables — TSC, §Calculation — Variables — Volume/well
  Expected: PANEL-UPLOAD-V2-SPEC.md models exactly one `reagent_volume_per_well` field per master panel (B4) — not per reagent. Diluent and SAPE-name are not present in the spec at all. REQUIREMENTS.md MPAN-01 / CALV-01 are written against that single-value schema (master_panels.reagent_volume_per_well).
    source: /Users/pawj/Lab_Dev/immunoplex-assay-calculator/.planning/PANEL-UPLOAD-V2-SPEC.md §Proposed schema changes (master_panels table); /Users/pawj/Lab_Dev/immunoplex-assay-calculator/.planning/REQUIREMENTS.md MPAN-01, CALV-01
  Resolution required: Either the v2 spec + schema delta need to grow (per-reagent rows in master_panels, new SAPE name column, new diluent-rule table) or the PRD's per-reagent breakdown needs to be flattened to a single value. This decision has direct schema and calculator-wiring impact (Phases 5, 8, 10).
  → Decide whether master_panels stores per-reagent rows or a single value before routing.

[BLOCKER] Rounding precision contradicts LOCKED v1 decision (CALC-06)
  Found: smoke-3.md §Calculation — Variables — Volume/well: "Round off all calculated values to the 10th decimals" (i.e., round to 0.1 mL precision; rounding mode unspecified — presumably standard rounding, NOT ceiling). Worked example: 148 × 0.05 = 7.4 mL, 148 × 0.025 = 3.7 mL.
    source: /Users/pawj/Lab_Dev/immunoplex-assay-calculator/.planning/inbox/smoke-3.md §Calculation — Variables — Volume/well
  Expected: REQUIREMENTS.md CALC-06 ("App rounds final volumes up to nearest mL") and PROJECT.md §Domain Rules ("(total wells × vol per well) + dead volume, rounded up to nearest mL"). Shipped decision 02-01 records "Final volume always rounds UP to nearest mL". This is both a different precision (1 mL vs 0.1 mL) and a different rounding mode (ceiling vs nearest). The worked example in the PRD (7.4 mL) would not survive a round-up-to-mL pass (it would become 8 mL).
    source: /Users/pawj/Lab_Dev/immunoplex-assay-calculator/.planning/REQUIREMENTS.md CALC-06; /Users/pawj/Lab_Dev/immunoplex-assay-calculator/.planning/PROJECT.md §Domain Rules; /Users/pawj/Lab_Dev/immunoplex-assay-calculator/.planning/STATE.md Decisions §02-01
  Resolution required: Lab owner needs to confirm which is correct. CALC-06 is locked and shipped in v0.1.0; the PRD silently changes it. If 0.1 mL is correct, CALC-06 needs a formal supersede + v2 milestone work to revise the rounding pipeline.
  → Confirm with operator which precision/mode the bench actually uses, then update either CALC-06 or the PRD.

[BLOCKER] Calculator diluent semantics contradict LOCKED v1 domain rules
  Found: smoke-3.md §Calculation — Variables — TSC: diluent is determined by concentration of the user's selections. If any selected premix is 1× AND there are additional selections (singles, other premixes, or mixes), the 1× premix is the diluent for Beads and Antibodies. If selections are > 1×, use the Values-table diluent for the reagent.
    source: /Users/pawj/Lab_Dev/immunoplex-assay-calculator/.planning/inbox/smoke-3.md §Calculation — Variables — TSC
  Expected: PROJECT.md §Domain Rules: "Premix + singles: max 5 singles allowed (more dilutes premix concentration), premix is the diluent" and "Full custom: no limit on singles, Assay Buffer is the diluent". This is a different rule shape — the existing rule keys off the request type (premix-only / premix+singles / full-custom), while the PRD keys off the concentration of selected items. The "Assay Buffer is the diluent for full custom" rule does not appear in the PRD at all.
    source: /Users/pawj/Lab_Dev/immunoplex-assay-calculator/.planning/PROJECT.md §Domain Rules
  Resolution required: These two rules describe overlapping but non-identical scopes. Confirm with lab owner whether (a) the new concentration-keyed rule supersedes the existing request-type-keyed rule, (b) both apply (and how they compose), or (c) the existing Assay Buffer fallback is still correct for full-custom-with-all-1×-premixes-absent.
  → Confirm diluent-selection rule before allowing Phase 10 (calculator wiring) to proceed.

### WARNINGS (3)

[WARNING] "Premix + singles max 5" rule — silently dropped or just unstated?
  Found: smoke-3.md describes premix + singles combination selection with no numeric cap beyond the per-plate well caps (72 singles, 36 duplicates). The "max 5 singles when a premix is selected" constraint is not mentioned anywhere in the PRD.
    source: /Users/pawj/Lab_Dev/immunoplex-assay-calculator/.planning/inbox/smoke-3.md §Second Step: Category
  Impact: Cannot tell whether the PRD intends to (a) keep the existing CALC-05 cap (silence = unchanged), (b) lift it (silence = removed), or (c) replace it with the well-cap-only constraint. CALC-05 is shipped in v0.1.0 — silently dropping it would relax a validated business rule.
    source: /Users/pawj/Lab_Dev/immunoplex-assay-calculator/.planning/REQUIREMENTS.md CALC-05; /Users/pawj/Lab_Dev/immunoplex-assay-calculator/.planning/PROJECT.md §Requirements (Validated)
  → Ask lab owner to confirm whether CALC-05 still applies. Default assumption (conservative): treat silence as "still applies"; document explicitly in the PRD if so.

[WARNING] Three incompatible importer formats in the codebase / planning set
  Found: (1) Phase 6 importer parser.ts (shipped v0.7.0) expects `Panel Name` at A1 with a `Target` / `Bead Region` / `Single Concentration` analyte header row and a `sub-panel conc` row above the sub-panel name row. (2) PANEL-UPLOAD-V2-SPEC.md (draft, treated locked) specifies B1–B4 metadata + A6 vendor singles term + col E onwards premix columns. (3) smoke-3.md PRD describes the sectioned Criteria/Values/Category layout with Panel Description, per-reagent fields, SAPE Name, and Premix Count column.
    source: /Users/pawj/Lab_Dev/immunoplex-assay-calculator/src/main/import/parser.ts; /Users/pawj/Lab_Dev/immunoplex-assay-calculator/.planning/PANEL-UPLOAD-V2-SPEC.md §Per-tab layout (locked); /Users/pawj/Lab_Dev/immunoplex-assay-calculator/.planning/inbox/smoke-3.md §Database
  Impact: Whichever canonical shape is chosen (BLOCKER #1), at least one of the other two formats must be retired and the corresponding code or doc archived / superseded. If the lab owner expects to upload a Smoke 3-shaped file today, the shipped v0.7.0 importer will reject it.
  → Once BLOCKER #1 is resolved, file an explicit supersedes statement on the other two formats (e.g., PANEL-UPLOAD-V2-SPEC.md → Superseded by Smoke 3 PRD, or parser.ts → scheduled for replacement in Phase 8).

[WARNING] "Number of setups" as an explicit user input is new
  Found: smoke-3.md §Third Step: Plate & Sample Count lists "Number of setups must be accounted in this UI page". §Calculation — Calculation of the Dead volume defines `dead_volume = number_of_setups × 2 mL`.
    source: /Users/pawj/Lab_Dev/immunoplex-assay-calculator/.planning/inbox/smoke-3.md §Third Step + §Calculation
  Impact: REQUIREMENTS.md does not list a "number of setups" input field. CALC-03 simply says "App includes dead volume in all volume calculations" without specifying a multi-setup multiplier. PROJECT.md §Domain Rules describes dead volume as a single additive constant, not a per-setup multiplier. The current Calculator UI (Phase 3.3 shipped) does not expose a setups input. Whether the existing dead-volume implementation already multiplies by setups (and just hides the field) or assumes setups = 1 is not captured in REQUIREMENTS.md.
    source: /Users/pawj/Lab_Dev/immunoplex-assay-calculator/.planning/REQUIREMENTS.md CALC-03; /Users/pawj/Lab_Dev/immunoplex-assay-calculator/.planning/PROJECT.md §Domain Rules
  → Capture "number of setups" as a new requirement (e.g., CALC-08) and add it to the calculator UI input set. Verify whether the existing dead-volume calc assumes 1 setup so the gap is explicit.

### INFO (5)

[INFO] Plate snake direction matches shipped behavior
  Note: smoke-3.md §Third Step says "Plate layout should be snaked by columns starting at A4 to H4, then A5 to H5 and so on." This matches the shipped usePlateLayout.ts singles-mode logic ("Singles: fill down columns first, then across — 9 unknown columns (4-12) × 8 rows = 72 wells") and decision 03-01 ("Standards occupy columns 1-3").
    source: /Users/pawj/Lab_Dev/immunoplex-assay-calculator/src/renderer/src/features/plate/hooks/usePlateLayout.ts; /Users/pawj/Lab_Dev/immunoplex-assay-calculator/.planning/STATE.md §Decisions 03-01; /Users/pawj/Lab_Dev/immunoplex-assay-calculator/.planning/inbox/smoke-3.md §Third Step

[INFO] Replicate-mode caps match shipped CALC-01
  Note: smoke-3.md §Limits: 72 singles / 36 duplicates per plate. Matches PROJECT.md §Domain Rules and CALC-01.
    source: /Users/pawj/Lab_Dev/immunoplex-assay-calculator/.planning/inbox/smoke-3.md §Limits; /Users/pawj/Lab_Dev/immunoplex-assay-calculator/.planning/REQUIREMENTS.md CALC-01

[INFO] Dead volume per setup = 2 mL aligns with shipped decision 02-03
  Note: smoke-3.md §Dead volume says 2 mL per setup. Matches STATE.md decision 02-03 ("Default dead volume changed to 2000 uL (2 mL)"). Only the per-setup multiplier is new (covered in WARNING #3).
    source: /Users/pawj/Lab_Dev/immunoplex-assay-calculator/.planning/inbox/smoke-3.md §Dead volume; /Users/pawj/Lab_Dev/immunoplex-assay-calculator/.planning/STATE.md §Decisions 02-03

[INFO] Premix "Count" column redundant with v2 implicit count
  Note: smoke-3.md asserts a Premix Count column in the source data. PANEL-UPLOAD-V2-SPEC.md does not include such a column but derives count by counting non-blank cells in each premix column (E+, row 8 downward). Not a hard contradiction, but if BLOCKER #1 is resolved in favor of the Smoke 3 shape, a Count column should be added to whatever canonical schema is adopted.
    source: /Users/pawj/Lab_Dev/immunoplex-assay-calculator/.planning/inbox/smoke-3.md §Hierarchy of UI interaction — Second Step; /Users/pawj/Lab_Dev/immunoplex-assay-calculator/.planning/PANEL-UPLOAD-V2-SPEC.md §Blank-stop rules

[INFO] TSC vs TA vocabulary is new but consistent with v2 master-panel model
  Note: smoke-3.md introduces TSC (Total Selected Count — the user's premix-or-single selection count) and TA (Total Analytes — total constituent analyte count including premix members). These are not in REQUIREMENTS.md or PROJECT.md by name. The distinction (calculate volumes against the selection count, display bead regions against the analyte count) is consistent with the v2.0 master-panel + premix model already in PANEL-UPLOAD-V2-SPEC.md.
    source: /Users/pawj/Lab_Dev/immunoplex-assay-calculator/.planning/inbox/smoke-3.md §Second Step: Category; /Users/pawj/Lab_Dev/immunoplex-assay-calculator/.planning/PANEL-UPLOAD-V2-SPEC.md §Analyte list semantics

---

GSD > BLOCKED: 4 blockers must be resolved before ingest can proceed.
