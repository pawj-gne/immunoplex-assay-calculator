# Roadmap: Immunoplex Assay Calculator

## Overview

This roadmap delivers a desktop application for lab operators to calculate reagent volumes and generate prep recipes for Luminex/Immunoplex assays. The journey progresses from foundation (data models, platform configuration) through the core calculation engine, to recipe generation with plate visualization, and finally run documentation with persistence. Each phase builds on the previous, following natural dependencies identified during research.

## Phases

**Phase Numbering:**
- Integer phases (1, 2, 3, 4): Planned milestone work
- Decimal phases (2.1, 2.2): Urgent insertions (marked with INSERTED)

Decimal phases appear between their surrounding integers in numeric order.

- [x] **Phase 1: Foundation & Platform Configuration** - Electron shell, data models, platform-specific parameters
- [ ] **Phase 2: Calculator Core** - Volume calculations, dilutions, real-time display
- [ ] **Phase 3: Plate Visualization & Recipe Generation** - Well display, printable prep sheets, bead regions
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
- [ ] 02-01-PLAN.md - Calculation core with pure functions for well counting and volume math
- [ ] 02-02-PLAN.md - Single analyte additions with max 5 rule enforcement
- [ ] 02-03-PLAN.md - Calculator UI with Zustand store and real-time updates

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

### Phase 4: Run Documentation & Persistence
**Goal**: Operators can save and retrieve complete run records with all metadata
**Depends on**: Phase 3
**Requirements**: DOCM-01, PERS-01, PERS-02
**Success Criteria** (what must be TRUE):
  1. Operator can enter all run metadata (user, date, operator, sample count, sample type, replicate mode, platform, species, Hamilton assignment, positions, panel, analytes)
  2. Operator can save a run record to local storage
  3. Operator can load a previously saved run record and see all its data
  4. Saved runs persist across application restarts
**Plans**: TBD

Plans:
- [ ] 04-01: TBD (run metadata form with all required fields)
- [ ] 04-02: TBD (run persistence to SQLite with save/load)

## Progress

**Execution Order:**
Phases execute in numeric order: 1 -> 2 -> 3 -> 4

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Foundation & Platform Configuration | 3/3 | Complete | 2026-01-23 |
| 2. Calculator Core | 0/3 | In progress | - |
| 3. Plate Visualization & Recipe Generation | 0/3 | Planned | - |
| 4. Run Documentation & Persistence | 0/2 | Not started | - |

---
*Roadmap created: 2026-01-22*
*Last updated: 2026-01-26*
