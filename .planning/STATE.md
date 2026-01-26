# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-01-22)

**Core value:** Accurate reagent calculations with clear prep recipes - operators must be able to trust the math and follow the instructions without second-guessing.
**Current focus:** Phase 2 - Calculator Core

## Current Position

Phase: 2 of 4 (Calculator Core)
Plan: 0 of 3 in current phase
Status: Planning complete, ready to execute
Last activity: 2026-01-23 - Created Phase 2 plans (02-01, 02-02, 02-03)

Progress: [###.......] 25%

## Performance Metrics

**Velocity:**
- Total plans completed: 3
- Average duration: 19 min
- Total execution time: 0.9 hours

**By Phase:**

| Phase | Plans | Total | Avg/Plan |
|-------|-------|-------|----------|
| 01-foundation | 3/3 | 56min | 19min |

**Recent Trend:**
- Last 5 plans: 32min, 9min, 15min
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

### Pending Todos

None yet.

### Blockers/Concerns

- **ELECTRON_RUN_AS_NODE env var:** Claude Code SDK sets this, causing Electron to run as Node. Application works correctly in normal terminal. Not a blocker for development, just affects testing within SDK.

## Session Continuity

Last session: 2026-01-23
Stopped at: Phase 2 planning complete
Resume file: .planning/phases/02-calculator-core/02-01-PLAN.md
