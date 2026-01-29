# Phase 4: Run Documentation, Persistence & Deployment - Research

**Researched:** 2026-01-29
**Domain:** Drizzle ORM schema extension, Electron IPC, electron-builder Windows packaging
**Confidence:** HIGH

## Summary

This phase adds run record CRUD (metadata capture, save, load) and Windows `.exe` packaging. The codebase already has a well-established pattern: Drizzle ORM schema, repository pattern, IPC channels with Zod validation, and Zustand stores on the renderer side. Phase 4 follows the exact same pattern -- add a `runs` table to the schema, create a repository, expose IPC handlers, and build a Zustand store + UI.

For deployment, electron-builder is already configured with NSIS installer settings. The `build:win` script exists. The main work is ensuring better-sqlite3 native modules are correctly packaged and testing the installer on the target machine.

**Primary recommendation:** Follow existing repository/IPC patterns exactly. The run record is a new table with foreign keys to existing entities. Packaging requires verifying native module rebuilding and testing the NSIS output.

## Standard Stack

Already in place -- no new libraries needed.

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| drizzle-orm | ^0.45.1 | Schema + queries for run records | Already used for all DB access |
| better-sqlite3 | ^12.6.2 | SQLite engine | Already in use |
| electron-builder | ^25.1.8 | Windows .exe packaging | Already configured |
| zod | ^3.24.2 | IPC input validation | Already used at IPC boundary |
| zustand | ^5.0.3 | Renderer state for run records | Already used for other stores |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| electron-rebuild | ^3.2.9 | Rebuild native modules for Electron | postinstall already configured |

### Alternatives Considered
None -- all tooling is already in place.

**Installation:**
```bash
# No new packages needed
```

## Architecture Patterns

### Recommended Project Structure
```
src/
├── main/
│   ├── db/
│   │   ├── schema.ts          # ADD runs table + runAnalytes join table
│   │   └── repositories/
│   │       └── run.ts          # NEW: run repository (CRUD)
│   └── ipc/
│       ├── index.ts            # Register new run handlers
│       └── run.ts              # NEW: run IPC handlers
├── shared/
│   ├── types/
│   │   └── run.ts              # NEW: RunRecord, RunCreate types
│   ├── constants/
│   │   └── channels.ts         # ADD run IPC channels
│   └── validation/
│       └── run.ts              # NEW: Zod schemas for run data
├── renderer/src/
│   ├── features/
│   │   └── run/                # NEW feature folder
│   │       ├── components/
│   │       │   ├── RunMetadataForm.tsx
│   │       │   └── RunList.tsx
│   │       └── hooks/
│   │           └── useRuns.ts
│   └── stores/
│       └── runStore.ts         # NEW: Zustand store for runs
└── preload/
    └── index.ts                # ADD run API methods
```

### Pattern 1: Repository Pattern (follow existing)
**What:** All DB access through repository objects, never direct DB calls from IPC handlers.
**When to use:** Always for database operations.
**Example:**
```typescript
// src/main/db/repositories/run.ts - follows platformRepository pattern exactly
import { eq, desc } from 'drizzle-orm'
import { getDatabase } from '../client'
import { runs, runAnalytes } from '../schema'

export const runRepository = {
  getAll() {
    const db = getDatabase()
    return db.select().from(runs).orderBy(desc(runs.createdAt)).all()
  },

  getById(id: string) {
    const db = getDatabase()
    return db.select().from(runs).where(eq(runs.id, id)).get() ?? null
  },

  create(data: RunCreate) {
    const db = getDatabase()
    const now = new Date().toISOString()
    const id = crypto.randomUUID()
    // Use transaction for run + analytes
    const sqlite = getSqlite()
    const insertRun = sqlite.transaction(() => {
      db.insert(runs).values({ id, ...data, createdAt: now, updatedAt: now }).run()
      // Insert associated analytes
      for (const analyteId of data.analyteIds) {
        db.insert(runAnalytes).values({
          id: crypto.randomUUID(),
          runId: id,
          analyteId,
          createdAt: now
        }).run()
      }
      return runRepository.getById(id)
    })
    return insertRun()
  },

  delete(id: string) {
    const db = getDatabase()
    db.delete(runAnalytes).where(eq(runAnalytes.runId, id)).run()
    db.delete(runs).where(eq(runs.id, id)).run()
  }
}
```

### Pattern 2: IPC Handler with Zod Validation
**What:** Each IPC handler validates input with Zod before calling repository.
**When to use:** All new IPC channels.
**Example:**
```typescript
// src/main/ipc/run.ts
import { ipcMain } from 'electron'
import { IPC_CHANNELS } from '../../shared/constants/channels'
import { runCreateSchema } from '../../shared/validation/run'
import { runRepository } from '../db/repositories/run'

export function registerRunHandlers(): void {
  ipcMain.handle(IPC_CHANNELS.RUN_GET_ALL, () => runRepository.getAll())
  ipcMain.handle(IPC_CHANNELS.RUN_GET_BY_ID, (_e, id: string) => runRepository.getById(id))
  ipcMain.handle(IPC_CHANNELS.RUN_CREATE, (_e, data: unknown) => {
    const parsed = runCreateSchema.parse(data)
    return runRepository.create(parsed)
  })
  ipcMain.handle(IPC_CHANNELS.RUN_DELETE, (_e, id: string) => runRepository.delete(id))
}
```

### Pattern 3: Schema Design for Run Records
**What:** The `runs` table stores all metadata fields; a join table links runs to selected analytes.
**When to use:** This is the core data model for phase 4.
**Example:**
```typescript
// Addition to schema.ts
export const runs = sqliteTable('runs', {
  id: text('id').primaryKey(),
  userName: text('user_name').notNull(),
  operatorName: text('operator_name').notNull(),
  runDate: text('run_date').notNull(), // ISO date string
  sampleCount: integer('sample_count').notNull(),
  sampleType: text('sample_type').notNull(),
  replicateMode: text('replicate_mode').notNull(), // 'singlet' | 'duplicate'
  platformId: text('platform_id').notNull().references(() => platforms.id),
  speciesId: text('species_id').notNull().references(() => species.id),
  panelId: text('panel_id').references(() => premixPanels.id), // nullable for custom
  hamiltonAssignment: text('hamilton_assignment'), // JSON string or text
  tubeBlockPositions: text('tube_block_positions'), // JSON string
  troughPositions: text('trough_positions'), // JSON string
  createdAt: text('created_at').notNull(),
  updatedAt: text('updated_at').notNull()
})

export const runAnalytes = sqliteTable('run_analytes', {
  id: text('id').primaryKey(),
  runId: text('run_id').notNull().references(() => runs.id),
  analyteId: text('analyte_id').notNull().references(() => analytes.id),
  createdAt: text('created_at').notNull()
})
```

### Anti-Patterns to Avoid
- **Storing analytes as JSON blob in runs table:** Use a proper join table for queryability.
- **Skipping Zod validation on IPC boundary:** Every handler must validate input.
- **Creating a new database file for runs:** Use the existing `immunoplex.db` and add tables via migration.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Database migrations | Manual SQL scripts | `drizzle-kit generate` + `drizzle-kit push` | Already set up, handles schema diffs |
| UUID generation | Custom ID functions | `crypto.randomUUID()` | Already used in all repositories |
| Windows installer | Manual packaging | `npm run build:win` (electron-builder NSIS) | Already configured |
| Native module rebuild | Manual compilation | `electron-rebuild` (postinstall script) | Already in postinstall |
| Form state | Custom form handling | Zustand store (existing pattern) | Consistent with codebase |

## Common Pitfalls

### Pitfall 1: better-sqlite3 Not Packaged Correctly
**What goes wrong:** App builds fine in dev but crashes on production PC with native module error.
**Why it happens:** better-sqlite3 is a native Node module that must be rebuilt for the exact Electron version.
**How to avoid:** Ensure `electron-rebuild` runs during build. The `asarUnpack` in electron-builder.yml may need to include better-sqlite3's `.node` binary. Test the built installer on a clean machine.
**Warning signs:** "Module not found" or "not a valid Win32 application" errors on launch.

### Pitfall 2: Database Path on Production
**What goes wrong:** Database file created in wrong location or inaccessible.
**Why it happens:** `app.getPath('userData')` resolves differently in dev vs packaged app.
**How to avoid:** Already handled correctly -- `app.getPath('userData')` works in both contexts. Just verify the DB file exists after first launch of the packaged app.

### Pitfall 3: Migration Not Running on Schema Changes
**What goes wrong:** New `runs` table doesn't exist when app launches.
**Why it happens:** Schema is defined in Drizzle but tables aren't created automatically.
**How to avoid:** Check existing `migrate.ts` -- ensure it handles new tables. Use `drizzle-kit push` during development, and ensure migrations run at app startup in production.

### Pitfall 4: JSON Fields in SQLite
**What goes wrong:** Complex objects (Hamilton assignment, positions) stored as JSON strings need manual parsing.
**Why it happens:** SQLite has no native JSON column type in Drizzle.
**How to avoid:** Store as `text`, use `JSON.stringify` on write and `JSON.parse` on read. Do this consistently in the repository layer, not scattered across IPC handlers.

### Pitfall 5: Electron-builder Code Signing
**What goes wrong:** Windows SmartScreen warns "unrecognized app" on installer.
**Why it happens:** Unsigned application.
**How to avoid:** For internal workstation use, this is acceptable. Operators can click through the warning. Code signing is optional for internal tools. Document this for operators.

## Code Examples

### IPC Channel Constants
```typescript
// Add to src/shared/constants/channels.ts
RUN_GET_ALL: 'run:get-all',
RUN_GET_BY_ID: 'run:get-by-id',
RUN_CREATE: 'run:create',
RUN_DELETE: 'run:delete',
```

### Zod Validation Schema
```typescript
// src/shared/validation/run.ts
import { z } from 'zod'

export const runCreateSchema = z.object({
  userName: z.string().min(1),
  operatorName: z.string().min(1),
  runDate: z.string(), // ISO date
  sampleCount: z.number().int().positive(),
  sampleType: z.string().min(1),
  replicateMode: z.enum(['singlet', 'duplicate']),
  platformId: z.string().uuid(),
  speciesId: z.string().uuid(),
  panelId: z.string().uuid().nullable(),
  analyteIds: z.array(z.string().uuid()),
  hamiltonAssignment: z.string().nullable().optional(),
  tubeBlockPositions: z.string().nullable().optional(),
  troughPositions: z.string().nullable().optional(),
})
```

### Zustand Store Pattern
```typescript
// src/renderer/src/stores/runStore.ts
import { create } from 'zustand'

interface RunState {
  runs: RunRecord[]
  currentRun: RunRecord | null
  loading: boolean
  fetchRuns: () => Promise<void>
  saveRun: (data: RunCreate) => Promise<void>
  loadRun: (id: string) => Promise<void>
}

export const useRunStore = create<RunState>((set) => ({
  runs: [],
  currentRun: null,
  loading: false,
  fetchRuns: async () => {
    set({ loading: true })
    const runs = await window.api.runGetAll()
    set({ runs, loading: false })
  },
  saveRun: async (data) => {
    const run = await window.api.runCreate(data)
    set((state) => ({ runs: [run, ...state.runs], currentRun: run }))
  },
  loadRun: async (id) => {
    const run = await window.api.runGetById(id)
    set({ currentRun: run })
  }
}))
```

### Building Windows Installer
```bash
# Build and package for Windows
npm run build:win
# Output: dist/immunoplex-assay-calculator-{version}-setup.exe
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| electron-packager | electron-builder | Years ago | electron-builder is standard for installers |
| localStorage in renderer | SQLite in main process | Project decision | Proper persistence, survives app updates |

## Open Questions

1. **Migration strategy for new tables**
   - What we know: `drizzle-kit push` works in dev, `migrate.ts` exists
   - What's unclear: Does `migrate.ts` auto-create new tables on app startup, or does it need updating?
   - Recommendation: Read `migrate.ts` during planning and ensure it handles schema additions

2. **Exact metadata fields**
   - What we know: Requirements list user, date, operator, sample count, sample type, replicate mode, platform, species, Hamilton assignment, positions, panel, analytes
   - What's unclear: Whether some fields like "number of plates" are computed or user-entered
   - Recommendation: Treat all DOCM-01 fields as user-entered; compute what can be derived

3. **Native module in ASAR**
   - What we know: `asarUnpack: resources/**` is configured but better-sqlite3 .node files are in node_modules
   - What's unclear: Whether electron-builder auto-handles better-sqlite3 unpacking
   - Recommendation: Test `build:win` output early; may need to add `node_modules/better-sqlite3/**` to asarUnpack

## Sources

### Primary (HIGH confidence)
- Codebase inspection: schema.ts, repositories/platform.ts, client.ts, channels.ts, package.json, electron-builder.yml
- Existing patterns are authoritative -- phase 4 follows them directly

### Secondary (MEDIUM confidence)
- electron-builder NSIS configuration (already present in electron-builder.yml)
- Drizzle ORM patterns (already established in codebase)

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - all libraries already in use, no new dependencies
- Architecture: HIGH - follows established codebase patterns exactly
- Pitfalls: HIGH - based on known Electron + native module packaging issues
- Deployment: MEDIUM - electron-builder config exists but untested for this project

**Research date:** 2026-01-29
**Valid until:** 2026-03-01 (stable, no fast-moving dependencies)
