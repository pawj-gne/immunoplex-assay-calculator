# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-01-22)

**Core value:** Accurate reagent calculations with clear prep recipes - operators must be able to trust the math and follow the instructions without second-guessing.
**Current focus:** Phase 3 - Plate Visualization & Recipe Generation

## Current Position

Phase: 3 of 4 (Plate Visualization & Recipe Generation)
Plan: 1 of 3 in current phase
Status: In progress
Last activity: 2026-01-27 - Completed 03-01-PLAN.md

Progress: [#######...] 64%

## Performance Metrics

**Velocity:**
- Total plans completed: 7
- Average duration: 16 min
- Total execution time: ~1.8 hours

**By Phase:**

| Phase | Plans | Total | Avg/Plan |
|-------|-------|-------|----------|
| 01-foundation | 3/3 | 56min | 19min |
| 02-calculator-core | 3/3 | 52min | 17min |
| 03-plate-visualization | 1/3 | 8min | 8min |

**Recent Trend:**
- Last 5 plans: 9min, 15min, 15min, 12min, 25min, 8min
- Trend: improving

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
- **02-03:** Default dead volume changed to 2000 µL (2 mL)
- **03-01:** Standards occupy columns 1-3 (24 wells per plate)
- **03-01:** Column 12 empty in duplicates mode (unpaired wells)
- **03-01:** Sample numbering continues across plates

### Pending Todos

None yet.

### Blockers/Concerns

- **ELECTRON_RUN_AS_NODE env var:** Claude Code SDK sets this, causing Electron to run as Node. Application works correctly in normal terminal. Not a blocker for development, just affects testing within SDK.

## Session Continuity

Last session: 2026-01-27
Stopped at: Completed 03-01-PLAN.md (plate visualization)
Resume file: .planning/phases/03-plate-visualization-recipe-generation/03-02-PLAN.md

## Releases

- **v0.1.0** (2026-01-26): Foundation + Calculator Core (Phases 1-2)
