# Requirements: Immunoplex Assay Calculator

**Defined:** 2026-01-22
**Core Value:** Accurate reagent calculations with clear prep recipes - operators must be able to trust the math and follow the instructions without second-guessing.

## v1 Requirements

Requirements for initial release. Each maps to roadmap phases.

### Calculation Engine

- [ ] **CALC-01**: App calculates total reagent volume based on sample count, replicate mode (singles/duplicates), and plate capacity (72/36 unknowns + 24 standards per plate)
- [ ] **CALC-02**: App calculates single analyte addition volumes (master mix volume / stock concentration)
- [ ] **CALC-03**: App includes dead volume in all volume calculations
- [ ] **CALC-04**: App displays calculations in real-time as operator enters inputs
- [ ] **CALC-05**: App enforces max 5 singles rule when premix is selected
- [ ] **CALC-06**: App rounds final volumes up to nearest mL
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

Active. Mapped to v2.0 roadmap phases.

### Panel XLSX Import (PIMP)

Multi-tab vendor-format xlsx ingest replacing/coexisting with the v1 flat-CSV importer. See `.planning/PANEL-UPLOAD-V2-SPEC.md` for the authoritative per-tab layout.

- [ ] **PIMP-01**: App parses multi-tab xlsx workbooks with one tab per master panel scoped to a unique (platform, species) pair (spec §File-level shape)
- [ ] **PIMP-02**: Parser extracts per-tab metadata from fixed cells B1 (panel name) / B2 (platform) / B3 (species) / B4 (reagent volume) / A6 (vendor singles term, optional) (spec §Metadata fields)
- [ ] **PIMP-03**: Parser extracts the master analyte list from cols A/B/C starting row 8, stopping at first blank row in col A (spec §Blank-stop rules)
- [ ] **PIMP-04**: Parser discovers premix columns by scanning row 6 from col E rightward until first blank, then reads each premix column down from row 8 until blank (spec §Blank-stop rules)
- [ ] **PIMP-05**: Parser resolves platform and species case-insensitively against existing DB rows; unknown values return a structured validation error listing valid choices (spec §Metadata fields)
- [ ] **PIMP-06**: Validator collects all errors across all tabs before any DB write; strict mode rejects the entire file on any validation error (spec §Open decision 5 — confirmed strict during discuss-phase)
- [ ] **PIMP-07**: Validator returns per-tab / per-row / per-cell errors with enough context to locate the offender (e.g., `Tab "X" — Row 12 Col A: analyte "IL-99" not found in master`) (spec §Error reporting)
- [ ] **PIMP-08**: App exposes new IPC channel `IMPORT_MASTER_PANEL_FILE` separate from the existing `IMPORT_PANEL_DATA`; Manage page Panels section gains an "Import Master Panel (.xlsx)" button with file-dialog filter restricted to `.xlsx` (spec §IPC + UI)
- [ ] **PIMP-09**: On success, app surfaces a per-tab summary banner ("Imported N master panels: X (M analytes, P premixes); ...") (spec §Result banner)
- [ ] **PIMP-10**: Vendor singles term (cell A6) falls back to the generic label "Single" / "Analytes" when blank; UI must not render "undefined" or empty string (spec §Metadata fields A6 note)

### Master-Panel Data Model (MPAN)

Schema delta + transactional upsert semantics per spec §Proposed schema changes and §Idempotency.

- [ ] **MPAN-01**: App adds a `master_panels` table keyed by unique (platform_id, species_id), storing `name`, `reagent_volume_per_well`, `vendor_singles_term`, timestamps (spec §Proposed schema changes)
- [ ] **MPAN-02**: App adds nullable `master_panel_id` FK to `panels` and `analytes` tables; v1-imported rows keep `master_panel_id = NULL` and continue to work unchanged (spec §Proposed schema changes; PITFALLS §Pitfall 1)
- [ ] **MPAN-03**: Importer upserts master panel row matched by (platform_id, species_id); re-upload updates `name`/`reagent_volume_per_well`/`vendor_singles_term` in place (no delete-then-insert) (spec §Idempotency)
- [ ] **MPAN-04**: Importer upserts analytes matched by (name, platform_id, species_id) case-insensitive; re-upload updates `bead_region`/`concentration`/`master_panel_id` and ADOPTS existing v1 analytes (FK update, no duplicate row) (PITFALLS §Pitfall 1 — critical)
- [ ] **MPAN-05**: Importer upserts premix panels matched by (master_panel_id, name) case-insensitive; premix-membership list replaced wholesale on re-upload; dropped premixes remain as orphans (no auto-delete) to preserve historical runs (spec §Open decision 4 — confirmed orphan during discuss-phase)
- [ ] **MPAN-06**: All per-tab writes (master + analytes + premixes + panel-analyte links) happen in a single better-sqlite3 transaction; validation across all tabs completes before any transaction opens (PITFALLS §Pitfall 27)

### Calculator Reagent-Volume Wiring (CALV)

Calculator reads `reagent_volume_per_well` from master panel when available; falls back to platform default (currently the `DEFAULT_VOLUME_PER_WELL = 25` constant) otherwise. Resolves behavior per spec §Calculator behavior change.

- [ ] **CALV-01**: Calculator resolves `reagent_volume_per_well` in priority order: (1) run's panel's master_panel value, (2) platform default constant (spec §Calculator behavior change; OD-2 confirmed graceful-fallback during discuss-phase)
- [ ] **CALV-02**: Calculator UI surfaces provenance — operator sees which source was used ("From master panel: 50 µL" vs "Platform default: 25 µL") so fallback is never silent (PITFALLS §Pitfall 4 — critical)
- [ ] **CALV-03**: Runs saved before v2 display the volume that was persisted at save time (`runs.volume_per_well` column), not the current resolved value — historical runs do not retroactively change (PITFALLS §Pitfall 17)

### Vendor Singles Term UI Rollout (VTRM)

Closes D-4.1-05 — replace the generic "Analytes" master-list label with the vendor term ("Singleplex", "Simplex") when `vendor_singles_term` is available.

- [ ] **VTRM-01**: AnalyteGrid section header renders `vendor_singles_term` from the current (platform, species)'s master panel when present; falls back to "Analytes" when the master panel is NULL or `vendor_singles_term` is blank (OD-3 confirmed during discuss-phase)
- [ ] **VTRM-02**: "No Premix (Custom Assay)" chip label uses the vendor term when present ("No Premix (Custom Singleplex)") and falls back to "No Premix (Custom Assay)" otherwise

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
| CALC-03 | Phase 2 | Pending |
| CALC-04 | Phase 2 | Pending |
| CALC-05 | Phase 2 | Pending |
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
*Last updated: 2026-04-23 — v2.0 traceability added (21 requirements mapped to Phases 5-8; Phase 9 = Windows UAT gate)*
