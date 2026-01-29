# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-01-22)

**Core value:** Accurate reagent calculations with clear prep recipes - operators must be able to trust the math and follow the instructions without second-guessing.
**Current focus:** Phase 3.1 - Panel Data Import

## Current Position

Phase: 3.1 (Panel Data Import - inserted)
Plan: 1 of 2 in current phase
Status: In progress
Last activity: 2026-01-29 - Completed 03.1-01-PLAN.md

Progress: [#########.] 82%

## Performance Metrics

**Velocity:**
- Total plans completed: 9
- Average duration: 14 min
- Total execution time: ~2.0 hours

**By Phase:**

| Phase | Plans | Total | Avg/Plan |
|-------|-------|-------|----------|
| 01-foundation | 3/3 | 56min | 19min |
| 02-calculator-core | 3/3 | 52min | 17min |
| 03-plate-visualization | 2/3 | 13min | 7min |
| 03.1-panel-data-import | 1/2 | 8min | 8min |

**Recent Trend:**
- Last 5 plans: 12min, 25min, 8min, 5min, 8min
- Trend: stable

*Updated after each plan completion*

## Accumulated Context

### Decisions

Decisions are logged in PROJECT.md Key Decisions table.
Recent decisions affecting current work:

- **01-01:** Used electron-vite for build tooling (optimized Electron + Vite integration)
- **01-01:** Removed @electron-toolkit dependencies (caused runtime issues)
- **01-01:** Tailwind CSS v4 with CSS-first configuration approach
- **01-01:** Explicit electron externalization in vite config
- **01-02:** Used better-sqlite3 for synchronous database operations in main process
- **01-02:** Repository pattern isolates database access from IPC handlers
- **01-02:** Zod validation on IPC boundary ensures type safety from renderer
- **01-02:** Decimal.js utilities use microliters as internal unit for precision
- **01-03:** Zustand store holds platform list, selection state, loading/error state
- **01-03:** Feature folder structure (features/platform/) for scalability
- **01-03:** Migration path fix: __dirname in bundled code is out/main/, use ../../
- **02-01:** Pure functions for all calculations (testable, reusable)
- **02-01:** Final volume always rounds UP to nearest mL
- **02-02:** Zod for runtime validation of calculator inputs
- **02-02:** Single addition = master_mix_volume / stock_concentration
- **02-03:** Zustand store for calculator with derived outputs
- **02-03:** Default dead volume changed to 2000 uL (2 mL)
- **03-01:** Standards occupy columns 1-3 (24 wells per plate)
- **03-01:** Column 12 empty in duplicates mode (unpaired wells)
- **03-01:** Sample numbering continues across plates
- **03-02:** Checkbox state is local (useState) - not persisted for print
- **03-02:** BeadRegionList uses placeholder until Platform type extended
- **03-02:** PrepSheet accepts contentRef prop for react-to-print integration
- **03.1-01:** Used xlsx library for CSV/Excel parsing
- **03.1-01:** Validation returns errors before any DB writes (fail-fast)
- **03.1-01:** Panel description taken from first row in each panel group

### Pending Todos

None yet.

### Blockers/Concerns

- **ELECTRON_RUN_AS_NODE env var:** Claude Code SDK sets this, causing Electron to run as Node. Application works correctly in normal terminal. Not a blocker for development, just affects testing within SDK.

## Session Continuity

Last session: 2026-01-29
Stopped at: Completed 03.1-01-PLAN.md (core import pipeline)
Resume file: .planning/phases/03.1-panel-data-import/03.1-02-PLAN.md

## Releases

- **v0.1.0** (2026-01-26): Foundation + Calculator Core (Phases 1-2)
