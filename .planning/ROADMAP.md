# Roadmap: Immunoplex Assay Calculator

## Overview

This roadmap delivers a desktop application for lab operators to calculate reagent volumes and generate prep recipes for Luminex/Immunoplex assays. The journey progresses from foundation (data models, platform configuration) through the core calculation engine, to recipe generation with plate visualization, and finally run documentation with persistence. Each phase builds on the previous, following natural dependencies identified during research.

v2.0 extends the platform with a vendor-native multi-tab xlsx panel importer, a new `master_panels` data model that anchors reagent volumes and vendor-specific terminology per (platform, species), and calculator wiring that reads reagent volumes from the master panel when available. v2.0 phases (5-11) continue numbering from v1.0 without reset. Phases 6-7 (INSERTED 2026-04-24) add central-server networking and an immutable audit trail before the XLSX import work begins.

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
- [ ] **Phase 8: XLSX Parser & Validator** - Pure main-process parse pipeline, case-insensitive platform/species resolution, strict-mode validator, per-tab/row/cell error reporting
- [ ] **Phase 9: Master-Panel Importer, IPC & UI Integration** - Transactional importer, separate IPC channel, Manage-page .xlsx button, selectedMasterPanel in selectionStore
- [ ] **Phase 10: Vendor Term & Calculator Reagent-Volume Wiring** - AnalyteGrid vendor-term header, calculator priority resolver with provenance display, historical-run preservation
- [ ] **Phase 11: Windows UAT & v2.0 Release** - Build v0.7.0 .exe, 16-item smoke test against real vendor xlsx, record retest outcome, tag release

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

## Progress

**Execution Order:**
Phases execute in numeric order: 1 -> 2 -> 3 -> 3.1 -> 3.2 -> 3.3 -> 4 -> 4.1 -> 5 -> 6 -> 7 -> 8 -> 9 -> 10 -> 11

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
| 8. XLSX Parser & Validator | 0/TBD | Not started | - |
| 9. Master-Panel Importer, IPC & UI Integration | 0/TBD | Not started | - |
| 10. Vendor Term & Calculator Reagent-Volume Wiring | 0/TBD | Not started | - |
| 11. Windows UAT & v2.0 Release | 0/TBD | Not started | - |

---
*Roadmap created: 2026-01-22*
*Last updated: 2026-04-24 — Phases 6-7 inserted (Network Layer + Audit Trail); former Phases 6-9 renumbered to 8-11*
*Plan template: see .planning/PLAN_TEMPLATE.md*
