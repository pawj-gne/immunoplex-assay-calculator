# Roadmap: Immunoplex Assay Calculator

## Overview

This roadmap delivers a desktop application for lab operators to calculate reagent volumes and generate prep recipes for Luminex/Immunoplex assays. The journey progresses from foundation (data models, platform configuration) through the core calculation engine, to recipe generation with plate visualization, and finally run documentation with persistence. Each phase builds on the previous, following natural dependencies identified during research.

v2.0 extends the platform with a vendor-native multi-tab xlsx panel importer, a new `master_panels` data model that anchors reagent volumes and vendor-specific terminology per (platform, species), and calculator wiring that reads reagent volumes from the master panel when available. v2.0 phases (5-11) continue numbering from v1.0 without reset. Phases 6-7 (INSERTED 2026-04-24) add central-server networking and an immutable audit trail before the XLSX import work begins.

**2026-05-11 Smoke 3 PRD adoption:** Phases 8-11 are SUPERSEDED — the lab-owner-authored [SMOKE-3-PRD.md](./SMOKE-3-PRD.md) replaces [PANEL-UPLOAD-V2-SPEC.md](./PANEL-UPLOAD-V2-SPEC.md) as the canonical panel-xlsx contract. New Phases 12-16 cover Smoke 3 adoption: calculator rule migration, panel parser v3 rewrite, plate-page UI expansion, run-doc audit trail, Windows UAT + release. See [INGEST-RESOLUTIONS.md](./INGEST-RESOLUTIONS.md) for the full decision trail.

## Phases

**Phase Numbering:**
- Integer phases (1, 2, 3, 4): Planned milestone work
- Decimal phases (2.1, 2.2): Urgent insertions (marked with INSERTED)

Decimal phases appear between their surrounding integers in numeric order.

- [x] **Phase 1: Foundation & Platform Configuration** - Electron shell, data models, platform-specific parameters
- [x] **Phase 2: Calculator Core** - Volume calculations, dilutions, real-time display
- [x] **Phase 3: Plate Visualization & Recipe Generation** - Well display, printable prep sheets, bead regions
- [x] **Phase 3.1: Panel Data Import** - INSERTED - CSV/Excel import for panel data across all platforms
- [x] **Phase 3.2: Panel Data Management** - INSERTED - Edit/delete analytes and panels in-app
- [x] **Phase 3.3: Analyte Selection Redesign** - INSERTED - Visual grid layout with panel grouping, sidebar, transitions
- [ ] **Phase 4: Run Documentation & Persistence** - Metadata capture, save/load run records
- [x] **Phase 5: Master-Panel Schema & Repository Foundation** - Drizzle schema delta, composite unique index, nullable FK adoption on analytes/panels, repository CRUD + upsert-by-(platform, species)
- [ ] **Phase 6: Network Layer & Central Server** - INSERTED - Lightweight Node/Express server on one lab PC, config-file discovery, HTTP client switch in IPC handlers, offline fallback with local SQLite + sync-back queue
- [ ] **Phase 7: Audit Trail** - INSERTED - Append-only audit_log on central DB, full snapshot on every save, in-app log viewer, CSV export
- [ ] ~~**Phase 8: XLSX Parser & Validator**~~ - **SUPERSEDED 2026-05-11 by Phase 13** (Smoke 3 PRD replaced the v2 SPEC; parser shape is now Criteria/Values/Category-sectioned, not B1-B4 + col-E premixes)
- [ ] ~~**Phase 9: Master-Panel Importer, IPC & UI Integration**~~ - **SUPERSEDED 2026-05-11 by Phase 13** (importer flow folded into the parser v3 rewrite; wholesale-replace re-upload semantics per SMK3-11)
- [ ] ~~**Phase 10: Vendor Term & Calculator Reagent-Volume Wiring**~~ - **SUPERSEDED 2026-05-11 by Phases 12 + 14** (calculator wiring + UI work absorbed into Smoke 3 calculator-rule migration and plate-page UI expansion; vendor singles term no longer applies — Smoke 3 PRD does not use it)
- [ ] ~~**Phase 11: Windows UAT & v2.0 Release**~~ - **SUPERSEDED 2026-05-11 by Phase 16** (v2.0 scope shifted to Smoke 3 PRD; UAT gate moved to the end of the new phases)
- [x] **Phase 12: Smoke 3 — Calculator Rules Migration** - INSERTED 2026-05-11 - Rounding (0.1 mL ceiling), diluent rule (concentration-keyed), dead volume (× setups), CALC-05 retention confirmation (SMK3-05, SMK3-06, SMK3-07) — **Complete 2026-05-12** (4 plans shipped: 3 original + 1 gap closure; 11/11 must-haves verified; 105 tests; integration tests lock in PRD worked example end-to-end through runStore.loadRun cascade)
- [x] **Phase 13: Smoke 3 — Panel XLSX Parser v3** - INSERTED 2026-05-11 - Rewrite parser.ts for Criteria/Values/Category sectioned format, per-reagent schema growth, Roman→Arabic panel normalization, wholesale-replace re-upload, delete legacy CSVs (SMK3-08, SMK3-09, SMK3-10, SMK3-11) (completed 2026-05-12)
- [x] **Phase 14: Smoke 3 — Plate Page Input Expansion + UI Cleanup** - INSERTED 2026-05-11 - Old Beads / Old Antibodies / Number of Setups inputs, premix deselection UX, bead region flat-list, stock-concentration label removal (SMK3-01, SMK3-02, SMK3-03, SMK3-04, SMK3-13, SMK3-14) (completed 2026-05-12)
- [x] **Phase 15: Smoke 3 — Run Document Audit Trail** - INSERTED 2026-05-11 - Full inputs+intermediates+outputs+diluent-decision breakdown, SAPE Name display, snapshot-frozen historical runs (SMK3-12, SMK3-15, SMK3-16, SMK3-17) (completed 2026-05-13)
- [ ] **Phase 16: Windows UAT & Release** - INSERTED 2026-05-11 - PLACEHOLDER - After Phases 12-15 ship, build .exe, install on Windows workstation, walk through Smoke 3 features end-to-end, tag release (version TBD: v0.8.0 vs v2.0.0 decided at gate)

## Phase Details

### Phase 1: Foundation & Platform Configuration
**Goal**: Operators can select platforms with correct stock concentrations for calculations
**Depends on**: Nothing (first phase)
**Requirements**: CALC-07
**Success Criteria** (what must be TRUE):
  1. Application launches and displays main navigation shell
  2. Operator can select from available platforms (Milliplex, BioRad, ProCartaPlex, R&D)
  3. Platform selection loads correct stock concentrations for that platform
  4. Decimal arithmetic prevents floating-point errors in subsequent calculations
**Plans**: 3 plans

Plans:
- [x] 01-01-PLAN.md - Project scaffolding with Electron + React + TypeScript, Tailwind CSS, app shell
- [x] 01-02-PLAN.md - Database setup with SQLite/Drizzle, IPC handlers, decimal utilities
- [x] 01-03-PLAN.md - Platform selection UI with Zustand state management

### Phase 2: Calculator Core
**Goal**: Operators can enter inputs and see accurate reagent volumes calculated in real-time
**Depends on**: Phase 1
**Requirements**: CALC-01, CALC-02, CALC-03, CALC-04, CALC-05, CALC-06
**Success Criteria** (what must be TRUE):
  1. Operator can enter sample count, replicate mode, and plate count to see total reagent volume
  2. Operator can add single analytes and see their addition volumes calculated from stock concentration
  3. Calculated volumes include dead volume and round up to nearest mL
  4. Calculations update immediately as operator changes inputs
  5. App prevents adding more than 5 singles when premix is selected
**Plans**: 3 plans

Plans:
- [x] 02-01-PLAN.md - Calculation core with pure functions for well counting and volume math
- [x] 02-02-PLAN.md - Single analyte additions with max 5 rule enforcement
- [x] 02-03-PLAN.md - Calculator UI with Zustand store and real-time updates

### Phase 3: Plate Visualization & Recipe Generation
**Goal**: Operators can see plate layout and print prep recipes with all calculated values
**Depends on**: Phase 2
**Requirements**: PLAT-01, RECP-01, RECP-02, RECP-03, RECP-04
**Success Criteria** (what must be TRUE):
  1. Operator can see which wells are standards vs unknowns on plate visualization
  2. Operator can print a prep sheet showing all calculated volumes
  3. Operator can follow step-by-step reagent preparation instructions
  4. Operator can see bead region list for plate reader instrument setup
  5. Prep sheet includes checkboxes for tracking preparation progress
**Plans**: 3 plans

Plans:
- [ ] 03-01-PLAN.md - Plate visualization components (PlateGrid, WellCell, usePlateLayout) + Tailwind print variant
- [ ] 03-02-PLAN.md - Recipe components (PrepSheet, ReagentChecklist, BeadRegionList, PrepInstructions)
- [ ] 03-03-PLAN.md - Print integration (IPC handler, PrintButton) + App integration + verification

### Phase 3.1: Panel Data Import (INSERTED)
**Goal**: Operators can import panel data from CSV/Excel files for all platforms, populating analytes, bead regions, and concentrations
**Depends on**: Phase 2 (data models exist)
**Requirements**: Supports CALC-07, RECP-03
**Success Criteria** (what must be TRUE):
  1. Operator can import a CSV/Excel file containing panel data (analyte names, bead regions, concentrations)
  2. Imported data populates the existing analytes, panels, and panel_analytes tables
  3. All 4 platforms (Milliplex, BioRad, ProCartaPlex, R&D Systems) can have panel data imported
  4. Import validates data format and reports errors clearly
  5. App can be rebuilt and deployed to production PC with import feature
**Plans**: 2 plans

Plans:
- [x] 03.1-01-PLAN.md -- Import pipeline: xlsx parser, Zod validator, transactional importer
- [x] 03.1-02-PLAN.md -- IPC handler, preload bridge, Import UI button, build verification

### Phase 3.2: Panel Data Management (INSERTED)
**Goal**: Operators can view, edit, and delete analytes and panels directly in the app UI
**Depends on**: Phase 3.1 (panel data exists in DB)
**Success Criteria** (what must be TRUE):
  1. Operator can view all analytes for a selected platform/species
  2. Operator can edit analyte properties (name, bead region, premix conc, single conc)
  3. Operator can delete analytes
  4. Operator can view panels and their analyte membership
  5. Operator can edit panel names and add/remove analytes from panels
  6. Operator can delete panels
  7. Changes persist in the database immediately
**Plans**: 3 plans

Plans:
- [x] 03.2-01-PLAN.md -- Backend CRUD: repository methods, IPC channels/handlers, preload bridge
- [x] 03.2-02-PLAN.md -- Analyte management UI: table view with edit modal and delete
- [x] 03.2-03-PLAN.md -- Panel management UI: list with membership editing, app navigation integration

### Phase 3.3: Selection UX Redesign (INSERTED)
**Goal**: Operators can select analytes visually from a grid and assign samples to plates interactively
**Depends on**: Phase 3.2 (panel data management exists)
**Requirements**: UX enhancement (improves CALC-01 sample count entry, PLAT-01 plate visualization)

**Success Criteria** (what must be TRUE):

*Analyte Selection Page:*
  1. Operator can select one premix panel from top section
  2. Operator sees analyte cards (name, bead region, concentration) organized by panel membership
  3. "All Analytes" section shows analytes not in any panel
  4. Selecting a premix grays out its member analytes in the grid
  5. Operator can add up to 5 singles on top of premix selection
  6. Right sidebar shows selected panel (with nested members) + individual singles
  7. Unselecting premix removes its analytes but keeps individual selections

*Sample Count & Plate Assignment:*
  8. Operator enters sample count via slider + editable number field (not ticker)
  9. Number field starts blank, click-to-type without friction
  10. Plate visualizer appears in sample selection section (not bottom of page)
  11. UI auto-calculates minimum plates needed and pre-fills sequentially
  12. Operator can page through multiple plates
  13. "Samples Remaining" indicator shows unassigned sample count
  14. Operator can click well to enter edit mode, then drag to select wells
  15. Excel-style selection: click-drag ranges, Ctrl+click toggle, Shift+click extend
  16. In duplicates mode, selecting a sample auto-fills both wells of the pair

*Plate Layout Corrections:*
  17. Standards occupy columns 1-3 (not 10-12)
  18. Singles: columns 4-12 = 72 wells per plate
  19. Duplicates: horizontal pairs (4-5, 6-7, 8-9, 10-11) + vertical pairs (col 12 A-D->E-H) = 36 samples

*Page Transitions:*
  20. Wizard pages transition smoothly with slide animations

**Plans**: 5 plans

Plans:
- [ ] 03.3-01-PLAN.md -- Foundation: fix plate constants (standards cols 1-3), plateStore, getDuplicatePair utility
- [ ] 03.3-02-PLAN.md -- Analyte selection page redesign: card grid, panel grouping, sidebar layout
- [ ] 03.3-03-PLAN.md -- Interactive plate grid: useWellSelection hook, WellCell/PlateGrid interactive mode
- [ ] 03.3-04-PLAN.md -- Sample count slider+field, PlateToolbar, calculator form changes
- [ ] 03.3-05-PLAN.md -- App integration: page transitions, interactive plate wiring, verification

### Phase 4: Run Documentation, Persistence & Deployment
**Goal**: Operators can save/retrieve run records and install the app as a Windows .exe
**Depends on**: Phase 3
**Requirements**: DOCM-01, PERS-01, PERS-02
**Success Criteria** (what must be TRUE):
  1. Operator can enter all run metadata per CONTEXT.md §Required Metadata Fields (requestNumber + ad-hoc override, userName, operatorId, runDate, sampleType enum, dilutionFactor, sampleCount, replicateMode, platformId, speciesId, panelId, hamilton 1-5, runPlatePosition 1-4, standardPosition 1-2, troughPosition 1-2, comments, plex auto, plateCount auto)
  2. Operator can save a run record to local storage; saves round-trip the plate layout with full fidelity (Record<plateNumber, well-ids>)
  3. Operator can load a previously saved run record and see all its data rehydrated across the 4 existing stores + the plate grid
  4. Saved runs persist across application restarts
  5. Operator can edit a loaded run and re-save as UPDATE (createdAt preserved, updatedAt bumped); dirty-state tracking gates reloads and the wizard Back button from the finalized view
  6. Wizard grows from 3 steps to 5 (Platform/Species → Analytes → Calculations → Document & Save → Finalized Run View); step 5 reuses Phase 3 recipe components in read-only mode with Print and Start New Run
  7. Operators master list is seeded (9 names) and editable via a new section on the Manage page; soft-delete via `active` flag preserves historical run references
  8. Application can be packaged as a Windows .exe installer (functional-only; custom appId, icon, signing, auto-updater all deferred per D-26)
  9. Installer can be deployed to the production PC and launched without dev tools
**Plans**: 5 plans

Plans:
- [x] 04-01-PLAN.md -- Backend: schema (runs, runSingleAnalytes, operators) + migration + repository + IPC + preload (Wave 1)
- [x] 04-02-PLAN.md -- Document & Save wizard step 4: runStore + RunMetadataForm + RunList + dirty tracking + save/update flow (Wave 3)
- [x] 04-03-PLAN.md -- Windows .exe packaging with electron-builder (functional-only, Wave 5) — code-complete; physical Windows smoke test pending HUMAN-UAT-04-03-01
- [x] 04-04-PLAN.md -- Finalized Run View wizard step 5: read-only PlateGrid + PrepSheet/ReagentChecklist/BeadRegionList reuse + Print + edit-warning modal + Start New Run (Wave 4)
- [x] 04-05-PLAN.md -- Operators Manage page + operatorsStore + OperatorEditModal + app-init load (Wave 2)

### Phase 04.1: Smoke Test Fixes (INSERTED)
**Goal**: Fix blocking bugs surfaced by the Phase 4 Windows smoke test so v1.0 can ship
**Depends on**: Phase 4
**Requirements**: TBD (gap-closure on DOCM-01, PERS-01; regression fixes on Phase 3.3 plate layout)
**Success Criteria** (what must be TRUE):
  1. Duplicate pair orientation matches how a Hamilton robot pipettes (column-major), confirmed with domain expert (BUG-01)
  2. Adding a second plate does not erase plate 1's layout (BUG-02 — data-loss regression)
  3. Species appears in the summary/metadata header on the Document & Save and Finalized Run View steps (BUG-03)
  4. Selecting a premix panel scopes the analyte picker to that panel's analytes only; Panels I and II are mutually exclusive (UI-01)
  5. A fresh Windows .exe passes the original 14-step smoke test end-to-end
**Plans**: 5 plans

Plans:
- [x] 04.1-01-PLAN.md -- BUG-01: column-major duplicate fill in plateStore.autoFill (Wave 1)
- [x] 04.1-02-PLAN.md -- BUG-02: preserve existing plates across autoFill cascade (Wave 2)
- [x] 04.1-03-PLAN.md -- BUG-03: Species in RunList row + RunMetadataForm context banner (Wave 1)
- [x] 04.1-04-PLAN.md -- UI-01: scoped AnalyteGrid + clear stale singles on panel switch (Wave 1)
- [ ] 04.1-05-PLAN.md -- Version bump to 0.6.0 + build:win + Windows HUMAN-UAT retest (Wave 3)

**Source:** .planning/phases/04-run-documentation-persistence-deployment/04-SMOKE-TEST-RESULTS.md

### Phase 5: Master-Panel Schema & Repository Foundation
**Goal**: The database can persist one `master_panels` row per (platform, species) pair with a composite unique index, and analytes/premix-panels can be adopted into a master panel via nullable `master_panel_id` FKs without disturbing v1-imported rows.
**Depends on**: Nothing (first v2.0 phase; treats v1.0 Phase 4.1 as stable baseline)
**Requirements**: MPAN-01, MPAN-02
**Success Criteria** (what must be TRUE):
  1. Running migrations against a dev DB with existing v1 data creates the `master_panels` table, adds nullable `master_panel_id` columns on `panels` and `analytes`, and leaves every existing v1 row with `master_panel_id = NULL` and no data loss (Pitfalls 1, 12)
  2. The generated Drizzle migration SQL contains a composite `UNIQUE INDEX` on `(platform_id, species_id)` — verified by grep, not assumed from schema code (Pitfall 14, drizzle-kit issue #3411)
  3. Inserting two `master_panels` rows with the same (platform_id, species_id) fails at the DB layer with a constraint-violation error; inserting with mismatched case of platform/species name is accepted (IDs are normalized, names are not)
  4. `PRAGMA foreign_keys = ON` is verified in `src/main/db/client.ts` for every opened connection; deleting a platform row referenced by a master panel fails with a foreign-key violation (Pitfall 13 — onDelete 'restrict' upward, 'set null' downward)
  5. `masterPanelRepository.upsertByPlatformAndSpecies(...)` creates-or-updates in place and returns the row's `id`; `analyteRepository.upsertByNameInMaster(...)` adopts an existing v1 analyte (case-insensitive name match) by setting its `master_panel_id` WITHOUT creating a duplicate row (Pitfall 1 — critical adoption-upsert gate)
**Plans**: 3 plans
**UI hint**: no

Plans:
- [x] 05-01-PLAN.md — Drizzle schema delta: masterPanels table + composite UNIQUE INDEX + nullable master_panel_id FK on premix_panels/analytes + sub_panel_conc REAL NOT NULL DEFAULT 1; drizzle-kit generate 0004 migration with grep-verified composite unique; shared-types masterPanel.ts + panel.ts/analyte.ts extensions
- [x] 05-02-PLAN.md — PRAGMA foreign_keys = ON in client.ts (D-12); install vitest devDep + vitest.config.ts + shared in-memory testDb fixture; SC #1 migration-no-data-loss test + SC #4 PRAGMA/FK-enforcement tests
- [x] 05-03-PLAN.md — masterPanelRepository.upsertByPlatformAndSpecies + analyteRepository.upsertByNameInMaster (Pitfall-1 adoption gate); setDatabaseForTests helper; SC #3 composite-unique + SC #5 adoption-upsert tests

**Notes (open decisions to lock at /gsd-discuss-phase before planning):**
- OD-1 replace-vs-coexist — suggested: coexist for v2.0, remove v1 CSV path in v2.1
- OD-2 calculator strict-vs-graceful — suggested: graceful + provenance display, never silent
- OD-3 vendor term placement — suggested: AnalyteGrid header + "No Premix" chip; skip wizard labels
- OD-4 premix-drop semantics — suggested: orphan (matches spec §Idempotency)
- OD-5 validation strictness — suggested: strict, file-level reject
- OD-6 A5 schema version marker — suggested: defer to v2.1
- OD-7 col C concentration = single_conc vs premix_conc — suggested: single_conc; premix_conc = 1.0 default
- OD-8 re-import overwrite of operator-edited master-panel names — suggested: yes, re-upload is authoritative

OD-1, OD-2, OD-3, OD-7 are release-gating for Phases 7 and 8 and must be locked before Phase 5 planning exits `/gsd-discuss-phase`. OD-4, OD-5, OD-6, OD-8 can ride the same session but are lower blast radius.

### Phase 6: Network Layer & Central Server
**Goal**: One designated lab PC runs a lightweight Node/Express HTTP server that owns the central SQLite database. The other two machines switch their IPC handlers to route all DB operations through HTTP to that server. A JSON config file on each machine declares `serverUrl` and `isServer`. When the server is unreachable, client machines fall back to a local SQLite and an `offline_queue` table; on reconnect the queue is automatically flushed to the server.
**Depends on**: Phase 4 (hard — runs/operators DB layer is being centralized)
**Requirements**: NET-01, NET-02, NET-03, NET-04, NET-05
**Success Criteria** (what must be TRUE):
  1. Server machine: `server.js` process binds on configured port, exposes REST endpoints for all DB operations (runs CRUD, operators CRUD); verified by running two machines against the same server and confirming both see identical Past Runs list
  2. Config file at `%APPDATA%\immunoplex-assay-calculator\config.json` contains `serverUrl` and `isServer` fields; server machine's Electron app starts the HTTP server process on launch; client machines skip local DB init and use the HTTP client
  3. When server is unreachable, client falls back to local SQLite; saves write to `offline_queue` table; a "Working offline" indicator appears in the UI; saves do not silently fail or throw unhandled errors
  4. On reconnect, the offline queue is automatically flushed to the server in insertion order; each queued item is confirmed before removal; duplicate-detection prevents double-posting if the server already received the item
  5. Server machine's own saves go directly to the central DB (no HTTP hop); the server machine can use the app normally regardless of whether other machines are connected
**Plans**: 5 plans

Plans:
- [ ] 06-01-PLAN.md — Foundation: deps install, schema delta (offline_queue + runs.machineName/isOfflineSave), migration 0005, appConfig, clientLocal, transport interface + localTransport, startup branch in index.ts, Wave 0 test scaffolds
- [ ] 06-02-PLAN.md — Express HTTP server: all runs + operators CRUD REST routes, Zod validation, idempotency on POST /api/runs, 0.0.0.0 binding, integration tests
- [ ] 06-03-PLAN.md — HTTP transport + offline queue: offlineQueueRepository, httpTransport (fetch + fallback + poller + flush + isFlushing mutex), IPC handler rewire to transport interface
- [ ] 06-04-PLAN.md — Renderer: networkStore, OfflineBanner (D-04), RunList Source column (D-02), preload bridge connection.onStatusChange, App.tsx wiring
- [ ] 06-05-PLAN.md — Windows build v0.7.0 + HUMAN-UAT: multi-machine verification of all NET-* requirements
**UI hint**: yes (offline indicator)

### Phase 7: Audit Trail
**Goal**: Every time a run is saved — whether a new create or a re-save after editing — an immutable row is appended to `audit_log` on the central database capturing the full run state at that moment: all inputs, all calculated outputs, all metadata, timestamp, and which machine triggered the save. A viewer in Manage mode shows the full log in reverse-chronological order with CSV export.
**Depends on**: Phase 6 (hard — audit log lives in the central DB; server layer must exist first)
**Requirements**: AUDIT-01, AUDIT-02, AUDIT-03, AUDIT-04
**Success Criteria** (what must be TRUE):
  1. Every save event (create or update) appends a row to `audit_log` with: `event_type` ('create'|'update'), `run_id` FK, full JSON snapshot of run state (platform, species, analytes, sample count, replicate mode, all calculated volumes, plate layout, all metadata fields), `saved_at` ISO timestamp, `machine_id`
  2. Audit log rows are never updated or deleted; the table has no UPDATE or DELETE IPC/HTTP handlers; verified by editing a run twice and confirming `audit_log` row count increases by 1 per save (not reset)
  3. Manage mode shows an "Audit Log" section listing all entries in reverse-chronological order; each row shows request number, event type, timestamp, machine; clicking a row expands the full JSON snapshot in a readable format
  4. CSV export button downloads all `audit_log` entries as a flat CSV; column headers match the table fields; file downloads to the user's Downloads folder without error
**Plans**: TBD
**UI hint**: yes

### Phase 8: XLSX Parser & Validator
**Goal**: A pure main-process function accepts a filesystem path to a vendor xlsx workbook and returns either a typed `ResolvedTab[]` ready for DB writes, or a structured list of per-tab/row/cell errors with enough context for an operator to locate every offender — with ZERO DB writes on the error path.
**Depends on**: Phase 5 (soft — imports `MasterPanel` / `ResolvedTab` shared types for validator output; no runtime dependency on the schema)
**Requirements**: PIMP-01, PIMP-02, PIMP-03, PIMP-04, PIMP-05, PIMP-06, PIMP-07, PIMP-10
**Success Criteria** (what must be TRUE):
  1. Parser reads a multi-tab `.xlsx`, extracts B1/B2/B3/B4 and optional A6 per tab, and returns the raw values without coercion or validation — fixture with a 2-tab file produces a `ParsedWorkbook` with 2 tab entries containing all 5 metadata fields (PIMP-01, PIMP-02, PIMP-10)
  2. Parser applies blank-stop rules correctly: master list (cols A/B/C) stops at first blank row in col A; each premix column (E+) stops independently at first blank cell in that column; Row 6 premix discovery stops at first blank cell E→rightward — adversarial fixture with mid-list empty rows and staggered premix lengths produces the expected analyte and premix counts (PIMP-03, PIMP-04, Pitfall 8)
  3. Validator resolves platform and species case-insensitively against the live DB; an unknown platform/species returns a tab-level error listing valid choices ("Platform 'milliplix' not found — valid: Milliplex, BioRad, ProCartaPlex") and a premix analyte name matching the master only via case-insensitive comparison (e.g. "il-6" vs "IL-6") succeeds (PIMP-05, Pitfall 9)
  4. Validator collects ALL errors across ALL tabs before returning (strict file-level mode per OD-5); a file with an error in tab 3 still surfaces errors in tabs 1 and 2 — fixture with per-tab errors of every error class (missing B1, non-numeric B4, non-integer bead region, unknown platform, premix analyte not in master) produces a single `ValidationResult` listing every offender (PIMP-06, PIMP-07)
  5. Error messages carry tab name + row number + column letter where applicable, matching spec §Error reporting format: `Tab "Cytokines Human" — Row 12 Col A: analyte "IL-99" not found in master` — verified against spec sample strings (PIMP-07)
**Plans**: TBD
**UI hint**: no

### Phase 9: Master-Panel Importer, IPC & UI Integration
**Goal**: An operator on the Manage page can click "Import Master Panel (.xlsx)", pick a vendor workbook, and — on success — see a per-tab summary banner and a refreshed Panels list; re-importing the same file is a no-op-by-diff (upsert, no duplicate rows, no orphan creations). On validation failure, zero DB writes occur.
**Depends on**: Phase 5 (hard — schema + repository), Phase 8 (hard — parser + validator output shape)
**Requirements**: PIMP-08, PIMP-09, MPAN-03, MPAN-04, MPAN-05, MPAN-06
**Success Criteria** (what must be TRUE):
  1. Manage page's Panels section renders an "Import Master Panel (.xlsx)" button (sibling to the existing legacy CSV importer per OD-1 coexist decision); clicking it opens a file dialog filtered to `.xlsx` only; new IPC channel `IMPORT_MASTER_PANEL_FILE` is wired end-to-end from renderer → preload → main → handler → importer (PIMP-08)
  2. On a successful 2-tab import, operator sees a per-tab summary banner in the format `"Imported 2 master panels: Milliplex Human Cytokines (30 analytes, 4 premixes); BioRad Mouse Chemokines (15 analytes, 2 premixes)"`, the Panels list re-fetches and shows the new premix rows, and `useSelectionStore.getState().selectedMasterPanel` reflects the imported master for the current (platform, species) after a selection pass (PIMP-09)
  3. Re-importing the SAME vendor xlsx (identical content) produces zero duplicate analyte rows, zero duplicate premix rows, and one updated `master_panels` row; changing the B1 name in the xlsx and re-importing updates the master-panel name in place (no delete-then-insert); v1-imported analytes with matching case-insensitive names are adopted by setting their `master_panel_id` FK (MPAN-03, MPAN-04 — **Pitfall 1 critical adoption-upsert gate**)
  4. Dropping a premix from the xlsx and re-importing leaves the dropped premix row in `panels` with `master_panel_id` still set (orphan, matches OD-4 spec default); the premix does NOT auto-delete and historical runs referencing it continue to load (MPAN-05)
  5. A validation failure in ANY tab (e.g. unknown platform in tab 3 of 3) leaves the DB in its pre-import state — zero master panels created, zero analytes adopted, zero panel rows upserted; verified by comparing row counts before and after the failed attempt. All per-tab writes for the successful tabs happen inside a single `better-sqlite3` transaction per spec §Idempotency + Pitfall 27 (MPAN-06)
**Plans**: TBD
**UI hint**: yes

### Phase 10: Vendor Term & Calculator Reagent-Volume Wiring
**Goal**: When a run is set up against a (platform, species) pair that has a master panel, the AnalyteGrid header displays the vendor-specific singles term ("Singleplex"/"Simplex") and the calculator resolves `reagent_volume_per_well` from the master panel — with an explicit provenance indicator visible to the operator so a fallback is NEVER silent. Historical runs continue to display their saved volume untouched.
**Depends on**: Phase 9 (hard — `selectedMasterPanel` must exist in `selectionStore` before this phase can consume it)
**Requirements**: VTRM-01, VTRM-02, CALV-01, CALV-02, CALV-03
**Success Criteria** (what must be TRUE):
  1. AnalyteGrid section header reads `vendor_singles_term` from the current (platform, species)'s master panel when present ("Singleplex" for Milliplex, "Simplex" for Thermo); falls back to "Analytes" when `selectedMasterPanel === null` OR `vendorSinglesTerm === null/''` — never renders "undefined" or empty string (VTRM-01, PIMP-10, Pitfall 18)
  2. The "No Premix (Custom Assay)" chip on the analyte selection page renders "No Premix (Custom Singleplex)" when a vendor term is present and falls back to "No Premix (Custom Assay)" otherwise (VTRM-02, OD-3 placement confirmed AnalyteGrid + chip only, NOT wizard labels)
  3. Calculator resolves `volume_per_well` in strict priority order — (1) master panel's `reagent_volume_per_well`, (2) `DEFAULT_VOLUME_PER_WELL = 25` — via a single resolver `getEffectiveVolumePerWell()` in `calculatorStore`; no direct reads of either source outside the resolver (Pitfall 16 — two-sources-of-truth drift; OD-2 graceful fallback, NOT strict) (CALV-01)
  4. **Pitfall 4 critical provenance-display gate:** the calculator UI visibly shows which source supplied the volume — "From master panel: Cytokines Human (50 µL/well)" vs "Platform default (25 µL/well)" — on the calculation step wherever the final volume number is shown; an operator can never mistake a fallback for an intentional master-panel value (CALV-02)
  5. A run saved before Phase 10 (with `runs.volume_per_well = 25` persisted) reloads showing 25 µL/well even if the master panel for its (platform, species) now says 50 — the stored column wins on read, the resolver only runs for NEW calculations; verified by a fixture run created against v0.6.x and reloaded after a master-panel upload that changes the resolved value (CALV-03, Pitfall 5, Pitfall 17)
**Plans**: TBD
**UI hint**: yes

### Phase 11: Windows UAT & v2.0 Release
**Goal**: A Windows operator installs v0.7.0, imports a real Milliplex vendor `.xlsx`, runs the full end-to-end calculator flow against an imported master panel, confirms the vendor singles term renders and the calculator pulls volume from the master (not the platform default), and every item on the 16-item "Looks Done But Isn't" checklist passes — at which point v2.0 is tagged and released.
**Depends on**: Phase 10 (hard — all v2.0 code changes must be merged before the build that goes to UAT)
**Requirements**: none new — verification gate for the v2.0 requirements already mapped to Phases 5-10
**Success Criteria** (what must be TRUE):
  1. `npm run build:win` produces x64 + arm64 installers tagged `immunoplex-assay-calculator-0.7.0-x64-setup.exe` (and arm64) using the existing electron-builder config with explicit `win.target.arch [x64, arm64]` — no regression against v0.6.1 packaging
  2. Operator installs the .exe on the production Windows workstation, launches it, and the v0.6.1 → v0.7.0 schema migration auto-applies successfully against the existing production DB without data loss; operator verifies pre-existing runs still load with correct values (CALV-03 historical preservation)
  3. Operator clicks "Import Master Panel (.xlsx)" on the Manage page, selects a real Milliplex vendor workbook, and the per-tab summary banner renders with accurate counts; re-importing the same file produces zero duplicate rows (Pitfall 1 adoption gate verified in real data)
  4. Operator navigates to the calculator, selects the imported master panel's (platform, species), and confirms: AnalyteGrid header shows the vendor term, the calculator displays the master panel's volume-per-well, provenance indicator reads "From master panel: <name>" (Pitfall 4 provenance gate)
  5. All 16 items on the PITFALLS.md §Looks Done But Isn't checklist pass in order on the actual Windows .exe; retest outcome is recorded to `.planning/phases/11-windows-uat-v2-release/11-UAT-RESULTS.md` with `## Overall: PASS`
**Plans**: TBD
**UI hint**: yes

### Phase 12: Smoke 3 — Calculator Rules Migration (INSERTED 2026-05-11)
**Goal**: Calculator math reflects the Smoke 3 PRD: round UP to nearest 0.1 mL, dead volume `= setups × 2 mL`, diluent selection by concentration-keyed rule (any 1× premix wins; else Values-table per reagent), CALC-05 max-5-singles cap explicitly retained.
**Depends on**: Phase 4.1 (v1 stable baseline). Independent of Phase 13 — no schema change required for these rules.
**Requirements**: SMK3-05, SMK3-06, SMK3-07; carries forward CALC-03 (extended), CALC-05 (retained), supersedes CALC-06.
**Success Criteria** (what must be TRUE):
  1. Calculator outputs round volumes UP to 0.1 mL precision (ceiling-at-0.1): 7.42 → 7.5, 7.40 → 7.4, 7.05 → 7.1 — verified by unit tests against the rounding pipeline in `src/renderer/src/lib/calculator.ts` and `lib/decimal.ts`
  2. Dead volume = `number_of_setups × 2 mL` for setups ≥ 1; setups input defaults to 1; setups < 1 is rejected
  3. Diluent resolver: given a selection set, if any selected premix has Premix Concentration = 1, that premix is the diluent for Beads and Antibodies (no ordering — picked deterministically when multiple 1× premixes are selected); else the resolver returns the per-reagent Values-table diluent string for that reagent
  4. CALC-05 max-5-singles cap is preserved unchanged; explicit unit test confirms 6th single attempt is blocked when a premix is selected
  5. STATE.md decision 02-01 superseded by 12-XX (round-to-0.1-mL); PROJECT.md §Domain Rules already updated to reflect the rules above
**Plans**: 4 plans (3 original + 1 gap closure)

Plans:
- [x] 12-01-PLAN.md — Rounding + dead-volume migration in lib/calculator.ts + lib/decimal.ts + shared types (Wave 1) ✅ 2026-05-12
- [x] 12-02-PLAN.md — Diluent resolver (new lib/diluentResolver.ts module, 14 vitest cases, decoupled from panel/analyte types) (Wave 1, parallel with 12-01) ✅ 2026-05-12
- [x] 12-03-PLAN.md — calculatorStore numberOfSetups plumbing + PRD-worked-example integration test + CALC-05 regression + STATE.md decision-supersession (Wave 2) ✅ 2026-05-12
- [x] 12-04-PLAN.md — Gap closure (setVolumePerWell action + loadRun cascade + setNumberOfSetups [1,1000] bound; WR-01/WR-03/WR-04 closed; 94 → 105 tests) (Wave 3, gap_closure: true) ✅ 2026-05-12

### Phase 13: Smoke 3 — Panel XLSX Parser v3 (INSERTED 2026-05-11)
**Goal**: A new parser accepts the lab's actual xlsx format (sectioned `Criteria` / `Values` / `Category` per sheet with per-reagent rows and a Premix matrix) and writes per-reagent rows into a revised master_panels schema. Re-upload of a (Platform, Species, Panel) wholesale-replaces. Roman panel numerals normalize to Arabic at parse time. Master `Table` tab is ignored. Legacy CSV templates deleted.
**Depends on**: Phase 5 (master_panels foundation — schema extension needed, not replacement). Phase 12 must precede so calculator math is correct before importer feeds new data.
**Requirements**: SMK3-08, SMK3-09, SMK3-10, SMK3-11, SMK3-DIL-01.
**Success Criteria** (what must be TRUE):
  1. Parser reads a multi-tab xlsx, ignores the `Table` sheet, and emits a typed `ResolvedPanel[]` covering every other sheet
  2. Each parsed sheet exposes: panel metadata (Platform, Species, normalized Panel name, Panel Description, SAPE Name), per-reagent rows (Beads / Antibodies / SAPE — each with Concentration / Diluent / Volume per well; `variable` cells ignored), Premix matrix (Premix Name, Premix Concentration, Count, member-analyte list per premix), and the Single Analytes list (Analyte / Bead Region / Concentration)
  3. Roman → Arabic normalization on import: `Panel I` → `Panel 1`, `II` → `2`, …; lab can author either form; calculator displays Arabic
  4. Re-upload of an existing (Platform, Species, Panel) wipes the existing panel's analytes + premixes + per-reagent rows + metadata and writes the new data in a single transaction; orphan preservation is REMOVED (supersedes MPAN-05)
  5. Legacy `templates/panel-template.csv` and `sample-panel-import.csv` are deleted; v0.7.0 `src/main/import/parser.ts` is replaced; old IPC channel + UI button names may change but the import surface remains accessible from the Manage page
  6. The 17 CSVs at `templates/panels/` (extracted from `Immuno Table for Calculator.xlsx` during the 2026-05-11 ingest) all parse successfully under the new parser — re-run the dry-run that produced 0/17 against the v0.7.0 parser and confirm 17/17 pass
**Plans**: 6 plans

Plans:
- [x] 13-01-PLAN.md — Schema delta + repository layer: schema.ts extensions (masterPanelReagents table + master_panels delta + FK SET NULL on runs.panelId + run_single_analytes.analyteId), masterPanelReagent repo + types, extended Phase 5 repos, repository-layer unit tests (Wave 1)
- [x] 13-02-PLAN.md — Fixture build pipeline: scripts/build-panels-fixture.ts + tsx devDep + npm run fixtures:panels + generated templates/panels/all-panels.xlsx (17 panels + Table sheet) (Wave 1, parallel with 13-01)
- [x] 13-03-PLAN.md — Drizzle migration 0007: db:generate + migration test (schema artifacts + post-migration FK SET NULL constraint behavior) + un-skip Plan 01 tests + [BLOCKING] db:push checkpoint (Wave 2)
- [x] 13-04-PLAN.md — Parser/validator/normalize rewrite: normalize.ts (Roman→Arabic + canonReagentKind), parser.ts (multi-sheet block parser; Pattern A + Pattern B), validator.ts (multi-sheet aggregation + D-21 collision); 71+ unit tests (Wave 2, parallel with 13-03)
- [x] 13-05-PLAN.md — Importer rewrite + integration tests (wholesale-replace transaction over master_panel_reagents, FK SET NULL verification, MANDATORY rollback test, MANDATORY Phase 12 SMK3-16 cross-phase regression) + SC #6 17/17 fixture gate via all-panels.xlsx (Wave 3)
- [x] 13-06-PLAN.md — UI surface + cleanup + phase audit: IPC + preload + ImportButton banner update for new ImportResult shape, legacy CSV deletion (SC #5), full test suite green + Phase 12 runStore regression check, phase ready for /gsd-verify-work (Wave 4)

### Phase 14: Smoke 3 — Plate Page Input Expansion + UI Cleanup (INSERTED 2026-05-11)
**Goal**: The Plate page exposes `Old Beads` / `Old Antibodies` / `Number of Setups` inputs feeding the new calculator rules. Premix deselection re-enables members as singles without auto-adding. Bead region display becomes a flat list. Stock-concentration labels on platform-selection screens are removed.
**Depends on**: Phase 12 (calculator math), Phase 13 (panel data shape).
**Requirements**: SMK3-01, SMK3-02, SMK3-03, SMK3-04, SMK3-13, SMK3-14, SMK3-RPL-01, SMK3-RPL-02.
**Success Criteria** (what must be TRUE):
  1. Plate page renders three numeric inputs above the existing sample-count field: `Old Beads (mL)`, `Old Antibodies (mL)`, `Number of Setups`. Defaults: 0, 0, 1. Min: 0, 0, 1. No upper bound. All three drive the calculator volumes in real time.
  2. Calculator subtracts Old Beads from the new-bead volume calc and adds it to the total bead volume reported on the run document; same for antibodies. Dead volume multiplies by setups.
  3. Premix deselection: when a premix is selected and the user removes it, member analytes return to the singles pool as selectable. They are NOT auto-added to the singles selection. CALC-05 cap still applies if the user manually re-adds members.
  4. Bead region display = single flat list of every analyte in the current selection (TA), sorted by bead region. Premix members and singles appear together; no grouping or hierarchy.
  5. UI cleanup: `Stock Concentration: Xx` line in PlatformCard removed; `Stock concentration: Xx` and `Ready to proceed with reagent calculations.` lines in PlatformSelector removed; `Platform Selected: {name}` heading retained
  6. Duplicate plate layout fills adjacent rows in the same column: col 4 = (A4,B4) (C4,D4) (E4,F4) (G4,H4), then col 5, …, through col 12 — supersedes the prior horizontal-pair + vertical-pair-col-12 layout where they conflict. Existing usePlateLayout hook updated; tests added.
**Plans**: 7 plans

Plans:
- [x] 14-01-PLAN.md — Pure math foundation: lib/decimal.ts floorToTenthML + lib/calculator.ts applyOldReagentSubtraction + CalculatorOutputs type extension + 13 vitest cases (Wave 1)
- [x] 14-02-PLAN.md — Plate geometry rewrite: getDuplicatePair vertical-pair-within-column geometry + DUPLICATE_HORIZONTAL_PAIRS/DUPLICATE_VERTICAL_COL retirement + usePlateLayout + plateStore.autoFill duplicate branch + 86+ vitest cases (Wave 1, parallel with 14-01)
- [x] 14-03-PLAN.md — Stock-concentration UI label cleanup: PlatformCard footer strip + PlatformSelector green-box trim (Wave 1, parallel with 14-01 + 14-02)
- [x] 14-04-PLAN.md — Store extensions + snapshot fidelity: calculatorStore oldBeads/oldAntibodies fields + setters + extended getOutputs; plateStore.setPlateCount bidirectional action; RunRecord/RunCreate type extension; useRunSnapshot + runStore.loadRun cascade for SMK3-16; Groups H/I/J tests (Wave 2, depends_on 01)
- [x] 14-05-PLAN.md — Selection feature refinement: selectionStore.selectPanel preserve-on-null + prune-on-switch (SMK3-13 / D-18 D-20); SelectedAnalytesList flat bead-region-sorted list (SMK3-14 / D-14-D-17) + AnalyteSelectionPanel caller update (Wave 2)
- [x] 14-06-PLAN.md — CalculatorForm restructure + OldReagentCapModal: useCalculator hook extension + 7-input form in D-01 order + 20%-cap soft-block + confirm-once override modal (Wave 3, depends_on 01 + 04)
- [x] 14-07-PLAN.md — Integration test extension: Group K (PRD-fixture Old-reagent math E2E) + Group L (selectPanel preserve/prune E2E) — 7 new test cases locking the cross-store contracts (Wave 4, depends_on 01 + 02 + 04 + 05)

### Phase 15: Smoke 3 — Run Document Audit Trail (INSERTED 2026-05-11)
**Goal**: The finalized run document shows the full calculation work — inputs, intermediates, outputs, diluent decision — and surfaces SAPE Name for traceability. Historical runs saved under v1/v2 rules are snapshot-frozen: reopening shows persisted values, never recomputes.
**Depends on**: Phase 12, Phase 13, Phase 14.
**Requirements**: SMK3-12, SMK3-15, SMK3-16, SMK3-17.
**Success Criteria** (what must be TRUE):
  1. Finalized run document includes an Audit Trail section with: inputs (plates, samples, replicate mode, premix selection, singles selection, old beads, old antibodies, setups) → intermediates (total wells, volume/well per reagent, dead volume, total reagent before old-reagent subtraction) → outputs (new beads, new antibodies, total bead volume, total antibody volume, PE volume) → diluent decision (which premix won, or which Values-table diluent applied per reagent)
  2. SAPE Name (from the panel's Values block) is displayed in the run document metadata header. No calculation impact.
  3. PE volume = `Total Volume of the Assay ÷ SAPE concentration` (read from the SAPE row in the panel's Values block; typically 1×). Verified by unit test against the Thermofisher Human Panel I fixture (SAPE concentration = 1 → PE volume = total assay volume).
  4. Historical runs (saved before Smoke 3 ships) reload showing the volumes that were persisted at save time. No retroactive recompute. Run document carries a small advisory note when reopening a pre-Smoke-3 run: "Computed under previous calculation rules."
**Plans**: 5 plans

Plans:
- [x] 15-01-PLAN.md — Schema delta + migration 0009 + repository extension + types/zod (Wave 1)
- [x] 15-02-PLAN.md — IPC channel + master-panel-with-reagents read path (Wave 1, parallel with 15-01)
- [x] 15-03-PLAN.md — Lift override flags into store + async snapshot rewrite + IPC fetch + snapshot tests (Wave 2, depends_on 15-01 + 15-02)
- [x] 15-04-PLAN.md — Pure helpers (PE math + branch label) + audit trail UI + SAPE row + advisory banner + override badge (Wave 2, depends_on 15-01)
- [x] 15-05-PLAN.md — Group M integration test + cross-phase regression check + final phase verification (Wave 3, depends_on 15-01..15-04)

### Phase 15.1: Phase 15 code-review gap closure — WR-01 loadRun override-flag restoration, WR-02 audit-trail integrity on null IPC, WR-06 derive 6 em-dashed audit-trail rows (INSERTED)

**Goal:** Close three Phase 15 code-review warnings (WR-01 / WR-02 / WR-06) that affect audit-trail integrity and round-trip fidelity, so v1.0.0 ships with a complete and consistent audit trail. Tactical fix sweep — no new requirements, no schema delta, all three fixes ship behind the existing `smoke3` calculationRulesVersion marker.
**Requirements**: None new — closes gaps against SMK3-15 (audit trail integrity) + SMK3-16 (snapshot round-trip fidelity).
**Depends on:** Phase 15
**Success Criteria** (what must be TRUE):
  1. WR-02: `buildRunSnapshot` three-branch gate omits the `smoke3` marker + 10 audit-trail fields when `getWithReagents` returns null OR throws — degrades gracefully to a legacy custom-assay-style save. Custom-assay path (no premix selected) STILL writes the marker (regression test at `useRunSnapshot.test.ts:197-221` continues to pass).
  2. WR-01: `runStore.loadRun` restores both `oldBeadsOverride` and `oldAntibodiesOverride` into `calculatorStore`; `CalculatorForm.tsx` mirrors the store flags into local React state via `useEffect` so the cap modal does NOT re-trigger on first interaction after reopen.
  3. WR-06: 6 currently-em-dashed audit-trail rows (Raw bead/antibody volume, New beads/antibodies, Total bead/antibody volume) derive from snapshot data via 3 new pure helpers in `auditTrail.ts` — null inputs render em-dash, override-clamp renders 0.
  4. Full vitest suite green (Group L + Group P + 2 rewritten WR-02 tests added; no regression to Phase 15's 421 tests). `npm run typecheck` exits 0. Phase 16 build is now unblocked (D-16-16/17/18 hard precondition closed).
**Plans**: 3 plans

Plans:
- [ ] 15.1-01-PLAN.md — WR-06: 3 derivation helpers in `auditTrail.ts` + Group P tests + AuditTrailSection.tsx wire-up (Wave 1, TDD)
- [ ] 15.1-02-PLAN.md — WR-02: three-branch gate in `buildRunSnapshot` + 2 WR-02 tests (rewritten throw + new null result) (Wave 1)
- [ ] 15.1-03-PLAN.md — WR-01: runStore cascade override-flag restore + CalculatorForm.tsx local-state mirror + Group L round-trip tests (Wave 1)

### Phase 16: Windows UAT & Release (INSERTED 2026-05-11, PLACEHOLDER)
**Goal**: After Phases 12-15 ship, build a Windows .exe, install on the lab workstation, walk through the Smoke 3 features against real panel data, tag a release.
**Depends on**: Phase 15.
**Requirements**: None new — verification gate for SMK3-* requirements above + carryover v1/v2 reqs.
**Success Criteria** (what must be TRUE):
  1. `npm run build:win` produces x64 + arm64 installers
  2. Installer deploys cleanly on the Windows workstation
  3. Operator imports the `Immuno Table for Calculator.xlsx` (or its successor) via the new parser; all 17 panels load
  4. Operator walks through a full run: selects platform/species/panel → picks premixes + singles → enters samples + old reagents + setups → confirms calculator outputs match hand calculations → saves run document → reopens to verify snapshot-fidelity
  5. Version tag chosen at gate (v0.8.0 for incremental, v2.0.0 for milestone — decision deferred from the 2026-05-11 ingest)
**Plans**: TBD

## Progress

**Execution Order:**
Phases execute in numeric order: 1 -> 2 -> 3 -> 3.1 -> 3.2 -> 3.3 -> 4 -> 4.1 -> 5 -> 6 -> 7 -> ~~8~~ -> ~~9~~ -> ~~10~~ -> ~~11~~ -> 12 -> 13 -> 14 -> 15 -> 16

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Foundation & Platform Configuration | 3/3 | Complete | 2026-01-23 |
| 2. Calculator Core | 3/3 | Complete | 2026-01-26 |
| 3. Plate Visualization & Recipe Generation | 2/3 | In Progress | - |
| 3.1. Panel Data Import | 2/2 | Complete | 2026-01-29 |
| 3.2. Panel Data Management | 3/3 | Complete | 2026-01-29 |
| 3.3. Analyte Selection Redesign | 0/5 | Not started | - |
| 4. Run Documentation, Persistence & Deployment | 5/5 | Code-complete; smoke test returned with blocking bugs | - |
| 4.1. Smoke Test Fixes (INSERTED) | 4/5 (plan 05 partial: v0.6.1 installers built, Windows retest deferred to HUMAN-UAT-04.1-05-01) | Code-complete; awaiting Windows smoke retest | - |
| 5. Master-Panel Schema & Repository Foundation | 3/3 | Complete | 2026-04-24 |
| 6. Network Layer & Central Server (INSERTED) | 0/TBD | Not started | - |
| 7. Audit Trail (INSERTED) | 0/TBD | Not started | - |
| 8. XLSX Parser & Validator | — | **SUPERSEDED by Phase 13 (2026-05-11)** | - |
| 9. Master-Panel Importer, IPC & UI Integration | — | **SUPERSEDED by Phase 13 (2026-05-11)** | - |
| 10. Vendor Term & Calculator Reagent-Volume Wiring | — | **SUPERSEDED by Phases 12+14 (2026-05-11)** | - |
| 11. Windows UAT & v2.0 Release | — | **SUPERSEDED by Phase 16 (2026-05-11)** | - |
| 12. Smoke 3 — Calculator Rules Migration | 4/4 | Complete    | 2026-05-12 |
| 13. Smoke 3 — Panel XLSX Parser v3 | 6/6 | Complete    | 2026-05-12 |
| 14. Smoke 3 — Plate Page Inputs + UI Cleanup | 8/8 | Complete    | 2026-05-12 |
| 15. Smoke 3 — Run Document Audit Trail | 5/5 | Complete    | 2026-05-13 |
| 16. Windows UAT & Release (Smoke 3) | 0/TBD | Not started (placeholder; version TBD) | - |

---
*Roadmap created: 2026-01-22*
*Last updated: 2026-05-12 — Phase 14 plan list expanded with 7 plans (Wave 1 foundations × 3 + Wave 2 stores + selection × 2 + Wave 3 UI form + Wave 4 integration tests)*
*Plan template: see .planning/PLAN_TEMPLATE.md*

## Backlog

### Phase 999.1: In-App Auto-Update (BACKLOG)

**Goal:** Use Electron's built-in autoUpdater (via electron-updater from electron-builder) to detect and silently apply new releases without requiring the user to manually download and run the installer. Eliminates the current manual upgrade path that requires cleaning up old installs on domain-joined PCs.

**Requirements:** TBD
**Plans:** 5/5 plans complete

Plans:
- [ ] TBD (promote with /gsd-review-backlog when ready)

**Notes:** Needs a proper update feed — GitHub Releases works as a generic provider (already configured as placeholder in electron-builder.yml). Low priority but important for lab usability as version count grows.
