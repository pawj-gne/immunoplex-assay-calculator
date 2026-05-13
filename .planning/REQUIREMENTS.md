# Requirements: Immunoplex Assay Calculator

**Defined:** 2026-01-22
**Core Value:** Accurate reagent calculations with clear prep recipes - operators must be able to trust the math and follow the instructions without second-guessing.

## v1 Requirements

Requirements for initial release. Each maps to roadmap phases.

### Calculation Engine

- [ ] **CALC-01**: App calculates total reagent volume based on sample count, replicate mode (singles/duplicates), and plate capacity (72/36 unknowns + 24 standards per plate)
- [ ] **CALC-02**: App calculates single analyte addition volumes (master mix volume / stock concentration)
- [x] **CALC-03**: App includes dead volume in all volume calculations *(EXTENDED 2026-05-11 by SMK3-05
: dead volume = `number_of_setups × 2 mL`)*
- [ ] **CALC-04**: App displays calculations in real-time as operator enters inputs
- [x] **CALC-05**: App enforces max 5 singles rule when premix is selected *(RETAINED 2026-05-11 per R-05 — PRD silence ≠ removal; explicit regression test landed 2026-05-12 in Phase 12-03 at src/renderer/src/lib/__tests__/calculator.integration.test.ts Groups D + E — lib-level canAddSingle + store-level addSingle action both block the 6th single under premix_singles)*
- [x] **CALC-06**: ~~App rounds final volumes up to nearest mL~~ *(SUPERSEDED 2026-05-11 by SMK3-06
: round UP to nearest 0.1 mL)*
- [ ] **CALC-07**: App supports platform-specific stock concentrations (Milliplex, BioRad, ProCartaPlex, R&D)

### Plate Planning

- [ ] **PLAT-01**: App visually distinguishes standards wells from unknown sample wells

### Recipe Generation

- [ ] **RECP-01**: App generates printable prep sheet with all calculated volumes
- [ ] **RECP-02**: App generates step-by-step reagent preparation instructions
- [ ] **RECP-03**: App displays bead region list for plate reader instrument setup
- [ ] **RECP-04**: App generates reagent checklist with checkboxes for prep tracking

### Run Documentation

- [x] **DOCM-01
**: App captures run metadata (user name, date, operator, number of plates, number of samples, sample type, replicate mode, Hamilton assignment, tube block position, trough position, platform, species, panel selection, analyte count)

### Run Persistence

- [x] **PERS-01
**: App saves run records to local storage (code-complete + packaged in v0.5.0 Windows installer; runtime confirmation pending HUMAN-UAT-04-03-01)
- [x] **PERS-02
**: App loads previously saved run records

## v2.0 Requirements — Panel XLSX Upload + Master-Panel Data Model

> **Re-scoped 2026-05-12 (Phase 16 reconciliation, per D-16-20):** The "v2.0" label here is a historical planning artifact. The Smoke 3 PRD adoption (SMK3-* requirements in §v2.1 below) is the **v1.0.0 release** content. Phase 6 (Network Layer & Central Server) and Phase 7 (Audit Trail) are **v1.1.0** and **v1.2.0** minor releases respectively — NOT v2.0. v2.0 is reserved for a future major version with scope TBD.

Active. Mapped to v2.0 roadmap phases.

### Panel XLSX Import (PIMP) — SUPERSEDED 2026-05-11

> ⚠️ **All PIMP-01..10 entries below are SUPERSEDED** by [SMOKE-3-PRD.md](./SMOKE-3-PRD.md) and the SMK3-08/09/10/11 requirements in §v2.1 below. The per-tab layout this section anticipated (B1–B4 metadata + col-E premixes + row-7 `Target` headers) does not match the lab's actual xlsx shape (sectioned `Criteria` / `Values` / `Category` blocks with per-reagent rows and a Premix matrix). The v0.7.0 importer is scheduled for replacement in Phase 13. Preserved for historical trace.

- [ ] ~~**PIMP-01**: App parses multi-tab xlsx workbooks with one tab per master panel scoped to a unique (platform, species) pair~~ *(SUPERSEDED by SMK3-08)*
- [ ] ~~**PIMP-02**: Parser extracts per-tab metadata from fixed cells B1 / B2 / B3 / B4 / A6~~ *(SUPERSEDED by SMK3-08 — Smoke 3 metadata lives in the `Criteria` section, not B1–B4)*
- [ ] ~~**PIMP-03**: Parser extracts the master analyte list from cols A/B/C starting row 8~~ *(SUPERSEDED by SMK3-08 — Smoke 3 analytes live below the `Category` row in the `Single Analytes` block)*
- [ ] ~~**PIMP-04**: Parser discovers premix columns by scanning row 6 from col E rightward~~ *(SUPERSEDED by SMK3-08 — Smoke 3 premixes live as columns under the `Premix` block, with a Premix Concentration row and a Count column)*
- [ ] ~~**PIMP-05**: Parser resolves platform and species case-insensitively~~ *(Behavior carried forward into SMK3-08 implicitly — case-insensitive resolution is still expected)*
- [ ] ~~**PIMP-06**: Validator collects all errors across all tabs before any DB write; strict mode rejects the entire file on any validation error~~ *(Behavior carried forward into SMK3-08 implicitly — strict, file-level validation still expected)*
- [ ] ~~**PIMP-07**: Validator returns per-tab / per-row / per-cell errors~~ *(Behavior carried forward into SMK3-08 implicitly)*
- [ ] ~~**PIMP-08**: App exposes new IPC channel `IMPORT_MASTER_PANEL_FILE`~~ *(Carried forward — SMK3-08 reuses the existing import IPC surface; channel name may change in Phase 13)*
- [ ] ~~**PIMP-09**: Per-tab summary banner on success~~ *(Behavior carried forward into SMK3-08 implicitly)*
- [ ] ~~**PIMP-10**: Vendor singles term fallback~~ *(No longer applicable — Smoke 3 PRD does not use vendor singles term; A6 is not a field in the new schema)*

### Master-Panel Data Model (MPAN)

Schema delta + transactional upsert semantics per spec §Proposed schema changes and §Idempotency.

- [ ] **MPAN-01**: App adds a `master_panels` table keyed by unique (platform_id, species_id), storing `name`, `reagent_volume_per_well`, `vendor_singles_term`, timestamps *(REVISED 2026-05-11 — schema must grow per-reagent rows (Beads / Antibodies / SAPE each with own Concentration + Diluent + Volume/well) + SAPE Name field; see SMK3-08)*
- [ ] **MPAN-02**: App adds nullable `master_panel_id` FK to `panels` and `analytes` tables; v1-imported rows keep `master_panel_id = NULL` and continue to work unchanged (spec §Proposed schema changes; PITFALLS §Pitfall 1)
- [ ] **MPAN-03**: Importer upserts master panel row matched by (platform_id, species_id); re-upload updates `name`/`reagent_volume_per_well`/`vendor_singles_term` in place (no delete-then-insert) *(SUPERSEDED 2026-05-11 by SMK3-11 — re-upload is now wholesale replace, not upsert)*
- [ ] **MPAN-04**: Importer upserts analytes matched by (name, platform_id, species_id) case-insensitive; re-upload updates `bead_region`/`concentration`/`master_panel_id` and ADOPTS existing v1 analytes (FK update, no duplicate row) *(SUPERSEDED 2026-05-11 by SMK3-11 — wholesale replace removes the analyte adoption requirement)*
- [ ] ~~**MPAN-05**: Importer upserts premix panels matched by (master_panel_id, name) case-insensitive; premix-membership list replaced wholesale on re-upload; dropped premixes remain as orphans~~ *(SUPERSEDED 2026-05-11 by SMK3-11 — entire panel replaced wholesale on re-upload, including premixes; no orphan preservation)*
- [ ] **MPAN-06**: All per-tab writes (master + analytes + premixes + panel-analyte links) happen in a single better-sqlite3 transaction; validation across all tabs completes before any transaction opens (PITFALLS §Pitfall 27)

### Calculator Reagent-Volume Wiring (CALV)

Calculator reads `reagent_volume_per_well` from master panel when available; falls back to platform default (currently the `DEFAULT_VOLUME_PER_WELL = 25` constant) otherwise. Resolves behavior per spec §Calculator behavior change.

- [ ] **CALV-01**: Calculator resolves `reagent_volume_per_well` in priority order: (1) run's panel's master_panel value, (2) platform default constant *(REVISED 2026-05-11 — resolution is now per-reagent (Beads / Antibodies / SAPE) reading from the panel's Values block; single `reagent_volume_per_well` field is replaced by per-reagent rows; see SMK3-08)*
- [ ] **CALV-02**: Calculator UI surfaces provenance — operator sees which source was used ("From master panel: 50 µL" vs "Platform default: 25 µL") so fallback is never silent (PITFALLS §Pitfall 4 — critical)
- [ ] **CALV-03**: Runs saved before v2 display the volume that was persisted at save time (`runs.volume_per_well` column), not the current resolved value — historical runs do not retroactively change *(REINFORCED 2026-05-11 by SMK3-16: snapshot-frozen historical runs principle extends to all Smoke 3 rule changes — rounding, dead-volume formula, diluent rule)*

### Vendor Singles Term UI Rollout (VTRM)

Closes D-4.1-05 — replace the generic "Analytes" master-list label with the vendor term ("Singleplex", "Simplex") when `vendor_singles_term` is available.

- [ ] **VTRM-01**: AnalyteGrid section header renders `vendor_singles_term` from the current (platform, species)'s master panel when present; falls back to "Analytes" when the master panel is NULL or `vendor_singles_term` is blank (OD-3 confirmed during discuss-phase)
- [ ] **VTRM-02**: "No Premix (Custom Assay)" chip label uses the vendor term when present ("No Premix (Custom Singleplex)") and falls back to "No Premix (Custom Assay)" otherwise

## v2.1 — Smoke 3 PRD Adoption

Net-new requirements derived from [SMOKE-3-PRD.md](./SMOKE-3-PRD.md) (lab-owner-authored; source of truth as of 2026-05-11). Full resolution trail with rationale per ID is in [INGEST-RESOLUTIONS.md](./INGEST-RESOLUTIONS.md) §E.

### Calculator Rules Migration

- [x] **SMK3-05
**: Dead volume = `number_of_setups × 2 mL` (default setups = 1). Extends CALC-03.
- [x] **SMK3-06
**: Final volumes round UP to nearest **0.1 mL** (ceiling at 0.1 mL). Supersedes CALC-06 + STATE.md decision 02-01.
- [x] **SMK3-07**: Diluent for Beads + Antibodies: if ANY selected premix is 1×, that premix is the diluent (any 1× premix wins, no ordering). If all selections are >1×, fall back to the per-reagent Values-table diluent. Supersedes the request-type-keyed rule in PROJECT.md §Domain Rules.

### Plate Page Input Expansion

- [x] **SMK3-02**: Plate page exposes **Old Beads** numeric input (mL, ≥ 0, default 0). Subtracted from new-bead volume calc; added to total bead volume.
- [x] **SMK3-03**: Plate page exposes **Old Antibodies** numeric input (mL, ≥ 0, default 0). Subtracted from new-antibody volume calc; added to total antibody volume.
- [x] **SMK3-04**: Plate page exposes **Number of Setups** numeric input (default 1, min 1, no max). Drives dead-volume multiplier in SMK3-05
.

### UI Behavior

- [x] **SMK3-01**: Calculator UI removes "Stock concentration: Xx" labels from platform selection screens ([PlatformCard.tsx:44-47](../src/renderer/src/features/platform/components/PlatformCard.tsx#L44-L47), [PlatformSelector.tsx:57,60](../src/renderer/src/features/platform/components/PlatformSelector.tsx#L57-L60)). "Platform Selected: {name}" header retained.
- [x] **SMK3-13**: When user deselects a premix, its member analytes return to the singles pool as selectable but are NOT auto-selected. Honors CALC-05 max-5 cap.
- [x] **SMK3-14**: Bead region display = flat list of every analyte (TA — Total Analytes, including premix members + standalone singles), sorted by bead region.

### Panel XLSX Parser v3

- [x] **SMK3-08**: Importer accepts Smoke 3 sectioned xlsx format (`Criteria` / `Values` / `Category` blocks per sheet; per-reagent rows in Values; Premix matrix in Category with Premix Concentration row + Count column + Analyte columns). Supersedes PANEL-UPLOAD-V2-SPEC.md, v0.7.0 parser, MPAN-01 single-volume model, CALV-01 single-volume resolution.
- [x] **SMK3-09**: Importer normalizes panel name Roman → Arabic at parse time. `Panel I` → `Panel 1`, `Panel II` → `Panel 2`, etc. Lab can author either form; calculator displays + queries against normalized Arabic form.
- [x] **SMK3-10**: Importer enumerates panels from sheet names. The master `Table` tab is ignored by the parser (decorative only; range strings like "1 through 7" not consumed).
- [x] **SMK3-11**: Re-upload of a (Platform, Species, Panel) triple **wholesale replaces** the existing panel (analytes + premixes + metadata). Supersedes MPAN-05 upsert-with-orphans.

### Run Document & Persistence

- [x] **SMK3-12**: SAPE Name (e.g., `SAPE-10`) is displayed in the run document for traceability. Stored as panel metadata. No calculation impact.
- [x] **SMK3-15**: Run document calculation breakdown shows full audit trail: inputs (plates, samples, replicate mode, selections, old reagents, setups) → intermediate steps (total wells, volume/well, total bead/antibody, dead volume) → final outputs (new reagents, total volumes, PE volume) → **diluent decision** (which premix won, or which Values-table diluent applied).
- [x] **SMK3-16**: Historical run records saved before Smoke 3 rules ship are **snapshot-frozen**. Reopening shows persisted values; new rules apply only to new runs. No retroactive recompute.
- [ ] **SMK3-17**: PE volume = `Total Volume of the Assay ÷ SAPE concentration` (read from the SAPE row in the panel's Values block, typically 1×).

### Diluent Data Model

- [ ] **SMK3-DIL-01**: Diluent column in the Values block is open-ended free text. Whatever the lab writes (e.g., `L-AB`, `n/a`, `Assay Buffer`) is stored verbatim. No enum; no normalization. Calculator surfaces the diluent string in calculations and run-doc outputs.

### Replicate Mode

- [x] **SMK3-RPL-01**: Replicate Mode set = `Single` + `Duplicate` only. Triplicate / custom replicate counts are out of scope (PRD-confirmed during ingest).
- [ ] **SMK3-RPL-02**: Duplicate plate layout = adjacent rows in the same column. Samples 1–4 occupy col 4 as `(A4,B4) (C4,D4) (E4,F4) (G4,H4)`, then col 5, …, through col 12 (9 cols × 4 samples = 36 = the CALC-01 cap).

## v3+ / Deferred

Deferred from v2.0. Tracked but not in v2.0 roadmap.

### Panel XLSX Import (deferred)

- **PIMP-11**: Preview-before-commit UI (dry-run parse → confirm → write) — spec §Non-goals flags as "not required for minimum viable v2"; revisit if user feedback shows "wrong file uploaded" is a real pain
- **PIMP-12**: File-level schema version marker (A5 = "Format Version: 2") — spec §Open decision 6 recommended yes; deferred to v2.1 alongside canonical template update
- **PIMP-13**: Admin action to review + delete orphan analytes / orphan premixes — spec §Idempotency flags as "separate future action"; wait until real data accumulates

### Panel XLSX Import (deprecated / removed)

- **PIMP-DEP-01**: Legacy v1 CSV import removed from primary UI — v2.0 ships with v1 coexisting behind a "Legacy CSV import" disclosure link (OD-1 confirmed coexist during discuss-phase); v2.1 removes the v1 path once all production panels are re-imported

### Prior v2 Requirements (carried from v1.0 roadmap — re-scope)

These were originally drafted as "v2" in v1.0's REQUIREMENTS.md but belong to different feature trajectories and will be re-scoped when needed:

- **PLAT-02 / PLAT-03 / PLAT-04** — interactive 96-well plate visualization grid, sample-to-well assignment, drag-and-drop. These were delivered via Phase 3.3 (Analyte Selection Redesign) in v1.0; mark as validated once Phase 3.3's features are formally accepted.
- **DOCM-02 / DOCM-03 / DOCM-04** — lot number entry, photo capture from connected camera, audit trail. v1 out-of-scope per PROJECT.md; candidates for v2.1+.
- **HIST-01 / HIST-02 / HIST-03** — run history search, full-text search, PDF/CSV export. Candidates for v2.1+.

## Run History (v1 — carried over unchanged)

- **HIST-01**: Operator can search runs by date, user, operator, platform (deferred)
- **HIST-02**: Operator can perform full-text search across all run fields (deferred)
- **HIST-03**: Operator can export run records to PDF/CSV (deferred)

## Out of Scope

Explicitly excluded. Documented to prevent scope creep.

| Feature | Reason |
|---------|--------|
| Run request queue integration | External system, not replacing it |
| Tablet/mobile support | Desktop first, tablet is future enhancement |
| Barcode scanning | Manual lot entry for v1, barcode is v2 |
| Lab usage tracking/analytics | Defer until core workflow is solid |
| Photo annotation | Simple upload sufficient for v1 |
| Standard curve fitting/analysis | Data analysis is separate concern, out of scope |
| Cloud sync/multi-user | Single workstation use case for v1 |
| xPONENT/Bio-Plex file export | Instrument integration deferred |

## Traceability

Which phases cover which requirements. Updated during roadmap creation.

| Requirement | Phase | Status |
|-------------|-------|--------|
| CALC-01 | Phase 2 | Pending |
| CALC-02 | Phase 2 | Pending |
| CALC-03 | Phase 2 | Complete |
| CALC-04 | Phase 2 | Pending |
| CALC-05 | Phase 2 | Complete |
| CALC-06 | Phase 2 | Pending |
| CALC-07 | Phase 1 | Pending |
| PLAT-01 | Phase 3 | Pending |
| RECP-01 | Phase 3 | Pending |
| RECP-02 | Phase 3 | Pending |
| RECP-03 | Phase 3 | Pending |
| RECP-04 | Phase 3 | Pending |
| DOCM-01 | Phase 4 (04-01 + 04-02 + 04-04 + 04-05) | Complete (packaged in 04-03; runtime confirmation pending HUMAN-UAT-04-03-01) |
| PERS-01 | Phase 4 (04-01 + 04-02 + 04-03) | Complete (packaged; runtime confirmation pending HUMAN-UAT-04-03-01) |
| PERS-02 | Phase 4 (04-01 + 04-02 + 04-04 + 04-03) | Complete (packaged; runtime confirmation pending HUMAN-UAT-04-03-01) |
| PIMP-01 | Phase 6 | Pending |
| PIMP-02 | Phase 6 | Pending |
| PIMP-03 | Phase 6 | Pending |
| PIMP-04 | Phase 6 | Pending |
| PIMP-05 | Phase 6 | Pending |
| PIMP-06 | Phase 6 | Pending |
| PIMP-07 | Phase 6 | Pending |
| PIMP-08 | Phase 7 | Pending |
| PIMP-09 | Phase 7 | Pending |
| PIMP-10 | Phase 6 | Pending |
| MPAN-01 | Phase 5 | Pending |
| MPAN-02 | Phase 5 | Pending |
| MPAN-03 | Phase 7 | Pending |
| MPAN-04 | Phase 7 | Pending |
| MPAN-05 | Phase 7 | Pending |
| MPAN-06 | Phase 7 | Pending |
| CALV-01 | Phase 8 | Pending |
| CALV-02 | Phase 8 | Pending |
| CALV-03 | Phase 8 | Pending |
| VTRM-01 | Phase 8 | Pending |
| VTRM-02 | Phase 8 | Pending |

**Coverage:**
- v1 requirements: 15 total — 15 mapped
- v2.0 requirements: 21 total (10 PIMP + 6 MPAN + 3 CALV + 2 VTRM) — 21 mapped to Phases 5-8; Phase 9 is verification gate (no new REQ-IDs)
- Deferred (not mapped to any v2.0 phase): PIMP-11, PIMP-12, PIMP-13, PIMP-DEP-01
- Unmapped v2.0 requirements: 0

---
*Requirements defined: 2026-01-22*
*Last updated: 2026-05-13 — Phase 16 reconciliation: §v2.0 header annotated with v1.x re-scope note per D-16-20 (v2.0 label is historical artifact; SMK3-* requirements are v1.0.0 release content; Phase 6/7 are v1.1.0/v1.2.0 minor releases)*
