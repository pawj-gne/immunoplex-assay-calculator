# Roadmap: Immunoplex Assay Calculator

## Overview

This roadmap delivers a desktop application for lab operators to calculate reagent volumes and generate prep recipes for Luminex/Immunoplex assays. The journey progresses from foundation (data models, platform configuration) through the core calculation engine, to recipe generation with plate visualization, and finally run documentation with persistence. Each phase builds on the previous, following natural dependencies identified during research.

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
- [ ] 04-03-PLAN.md -- Windows .exe packaging with electron-builder (functional-only, Wave 5)
- [x] 04-04-PLAN.md -- Finalized Run View wizard step 5: read-only PlateGrid + PrepSheet/ReagentChecklist/BeadRegionList reuse + Print + edit-warning modal + Start New Run (Wave 4)
- [x] 04-05-PLAN.md -- Operators Manage page + operatorsStore + OperatorEditModal + app-init load (Wave 2)

## Progress

**Execution Order:**
Phases execute in numeric order: 1 -> 2 -> 3 -> 3.1 -> 3.2 -> 3.3 -> 4

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Foundation & Platform Configuration | 3/3 | Complete | 2026-01-23 |
| 2. Calculator Core | 3/3 | Complete | 2026-01-26 |
| 3. Plate Visualization & Recipe Generation | 2/3 | In Progress | - |
| 3.1. Panel Data Import | 2/2 | Complete | 2026-01-29 |
| 3.2. Panel Data Management | 3/3 | Complete | 2026-01-29 |
| 3.3. Analyte Selection Redesign | 0/5 | Not started | - |
| 4. Run Documentation, Persistence & Deployment | 4/5 | In Progress | - |

---
*Roadmap created: 2026-01-22*
*Last updated: 2026-04-23 (Plan 04-04 complete)*
*Plan template: see .planning/PLAN_TEMPLATE.md*
