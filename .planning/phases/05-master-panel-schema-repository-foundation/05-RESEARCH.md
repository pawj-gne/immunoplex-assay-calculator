# Phase 5: Master-Panel Schema & Repository Foundation — Research

**Researched:** 2026-04-23
**Domain:** Drizzle-ORM schema delta + better-sqlite3 FK semantics + repository upsert patterns
**Confidence:** HIGH (all claims verified against the live codebase; no speculative claims require web verification)

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

- **D-01 (OD-1):** Hard-cut replace of v1 CSV importer. v1 UI trigger is removed in the same phase that ships the v2 xlsx import button (Phase 7). v1 IPC handler stays registered so existing tests still import, but is unreachable from the UI.
- **D-02 (OD-2):** Strict calculator resolution. `getEffectiveVolumePerWell()` throws a visible error when no `master_panel_id` is set. No fallback. Pitfall 4 provenance display still required for the pass case.
- **D-03 (OD-3):** Vendor singles term renders in two places only — `AnalyteGrid` section header and the "No Premix (Custom Assay)" chip.
- **D-04 (OD-7):** xlsx col C → `analytes.single_conc`. `analytes.premix_conc` becomes dead code in the xlsx import path post-v2.0. Flagged for removal in v2.1 — schema-untouched for Phase 5 to avoid dropping a NOT NULL column in the same migration as additive deltas (Pitfall 12).
- **D-05 (OD-4):** Orphan dropped premixes. Re-import drops a premix → row stays in `premix_panels` with `master_panel_id` still set.
- **D-06 (OD-5):** Strict file-level reject. Validator collects every error before any DB write. Single transaction wraps all per-tab writes.
- **D-07 (OD-6):** No A5 format-version marker in v2.0.
- **D-08 (OD-8):** xlsx authoritative on every re-import. `master_panels.name` overwritten from B1 each upload.

### Schema Delta (this phase)

- **D-09:** New table `master_panels` — composite `uniqueIndex('master_panels_platform_species_uniq').on(platformId, speciesId)`. FKs: `platform_id` → `platforms.id` onDelete `'restrict'`; `species_id` → `species.id` onDelete `'restrict'`.
- **D-10:** Alter `premix_panels` — add `master_panel_id` TEXT NULL FK → `master_panels.id` onDelete `'set null'`; add `sub_panel_conc` REAL NOT NULL.
- **D-11:** Alter `analytes` — add `master_panel_id` TEXT NULL FK → `master_panels.id` onDelete `'set null'`. Leave `premix_conc` untouched.
- **D-12:** Add `sqlite.pragma('foreign_keys = ON')` in `initializeDatabase()` at [src/main/db/client.ts:19](src/main/db/client.ts#L19), immediately after `journal_mode = WAL`.
- **D-13:** Single Drizzle migration via one `drizzle-kit generate` pass. Grep-confirm composite unique index.
- **D-14:** Do NOT rename `premix_panels`. Add schema.ts block comment.
- **D-15:** Pre-v2 FK onDelete rules stay `no action`. Scope creep to update them.

### Repository API (this phase)

- **D-16:** `masterPanelRepository.upsertByPlatformAndSpecies({platformId, speciesId, name, beadsVolumePerWell, abVolumePerWell, sapeVolumePerWell, vendorSinglesTerm}) → { id, action: 'created' | 'updated' }`. Lookup via composite `(platform_id, species_id)`. On match → UPDATE all fields except `id` and `created_at`. On miss → INSERT with new `crypto.randomUUID()`.
- **D-17:** `analyteRepository.upsertByNameInMaster({name, platformId, speciesId, masterPanelId, beadRegion, concentration}) → { id, action: 'created' | 'adopted' | 'updated' }`. Lookup via case-insensitive `(name, platform_id, species_id)` via existing `lower(name)` pattern. Match with `master_panel_id IS NULL` → UPDATE, `action: 'adopted'`. Match with `master_panel_id IS NOT NULL` → UPDATE, `action: 'updated'`. Miss → INSERT, `action: 'created'`. Never touches `premix_conc`.
- **D-18:** Neither upsert opens its own transaction. Phase 7 importer wraps in one `db.transaction()`.
- **D-19:** Premix-panel upsert is NOT in Phase 5 scope.

### Claude's Discretion

- Drizzle `relations()` declarations for the new table and FKs.
- TypeScript type exports (`MasterPanel`, `NewMasterPanel`, updates to `PremixPanel` / `Analyte` inferred types).
- `shared/types/` updates (new `masterPanel.ts`, additions to `panel.ts` / `analyte.ts`).
- Exact migration filename suffix (drizzle-kit auto-generates).
- Index ordering within the migration file.
- Test fixture structure (programmatic generation via `better-sqlite3` in-memory DB — follows existing repo test conventions — see Validation Architecture §Wave 0 Gaps: no test framework currently exists).

### Deferred Ideas (OUT OF SCOPE)

- Doc debt (rewrite PANEL-UPLOAD-V2-SPEC.md per-tab layout; update REQUIREMENTS.md MPAN-01/PIMP-02 wording; update ROADMAP Phase 8 SC #3).
- Phase 8 calculator JAMMate math.
- v2.1 `analytes.premix_conc` removal.
- v2.1 orphan cleanup admin action.
- v2.1 A5 format-version marker.
- Existing pre-v2 FK cleanup pass.
- Preview-before-commit UI, round-trip xlsx export, template download, master-panel delete UI.

</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| MPAN-01 | App adds a `master_panels` table keyed by unique (platform_id, species_id) storing `name`, reagent volumes, `vendor_singles_term`, timestamps (spec §Proposed schema changes). **Note:** REQUIREMENTS.md still says singular `reagent_volume_per_well`; CONTEXT.md D-09 supersedes this with three columns (`beads_volume_per_well`, `ab_volume_per_well`, `sape_volume_per_well`). Doc debt flagged for Phase 6 discuss-phase. | §Standard Stack, §Architecture Patterns §Schema Shape, §Code Examples §master_panels table definition |
| MPAN-02 | App adds nullable `master_panel_id` FK to `premix_panels` and `analytes`; v1-imported rows keep `master_panel_id = NULL` and continue to work unchanged (PITFALLS §Pitfall 1). | §Common Pitfalls §Pitfall 1 wiring to adoption-upsert, §Code Examples §Nullable FK with set-null cascade |

</phase_requirements>

## Project Constraints (from CLAUDE.md)

- **Dev-branch-only commits.** Current branch `dev/v1-01`; every commit goes to a dev branch, never main.
- **Conventional Commits.** `feat:`, `fix:`, `refactor:`, `docs:`, `chore:`. Phase 5 commits: `feat(db):` for schema + repository, `chore(db):` for migration file, `feat(db):` for PRAGMA.
- **Windows-only deployment; dev on macOS.** No macOS runtime testing of the Electron app. Schema changes are verified via (a) TypeScript typecheck, (b) manual inspection of the generated migration SQL, (c) unit tests against an in-memory `better-sqlite3` DB (which DOES run on macOS — it's pure Node, not Electron-bound). **Implication:** Phase 5 can ship entirely without `npm run build:win` because all deliverables are unit-testable on macOS; Phase 9 UAT confirms the migration auto-applies on a Windows workstation against real data.
- **Three-strike rule.** If schema validation or a repository test fails three times on the same hypothesis, stop and ask for guidance.
- **Always push after committing.**

## Summary

Phase 5 is a tightly-scoped schema delta on an Electron + Drizzle 0.45.1 + better-sqlite3 12.6.2 + drizzle-kit 0.31.8 stack. Every implementation decision is already locked in CONTEXT.md; the research job is to document exact syntax (Drizzle composite `uniqueIndex`, `.references(..., { onDelete: ... })`, `sqlite.pragma`), verify the existing code patterns the two new repository methods must mirror, and surface the two real risks: (1) drizzle-kit issue #3411 potentially misgenerating composite UNIQUE INDEX SQL (mitigation = grep-verify the generated `.sql` file), and (2) turning on `PRAGMA foreign_keys = ON` could surface pre-existing FK violations on first boot (mitigation = audit against dev DB before commit).

The existing codebase already supplies all the primitives: `crypto.randomUUID()` PK generation (analyte.ts:42), `new Date().toISOString()` timestamps (analyte.ts:41), case-insensitive `sql\`lower(${col}) = lower(${val})\`` match (analyte.ts:67), and a stable Drizzle schema-to-TypeScript-type flow via `$inferSelect` / `$inferInsert` (schema.ts:128-150). There is **no test framework installed** — neither vitest, jest, mocha, nor @testing-library appears in package.json. This is a significant Wave 0 gap if Phase 5 is the first phase to ship repository unit tests.

**Primary recommendation:** (1) Extend `schema.ts` with a new `masterPanels` table definition whose third `sqliteTable` argument is a callback returning `{ masterPanelsPlatformSpeciesUniq: uniqueIndex('master_panels_platform_species_uniq').on(t.platformId, t.speciesId) }`. (2) Add two new columns on `analytes` + `premixPanels` with inline `.references(() => masterPanels.id, { onDelete: 'set null' })`. (3) Run `npm run db:generate` once; commit the generated `0004_*.sql` verbatim. (4) Grep the generated SQL to assert `CREATE UNIQUE INDEX` on `(platform_id, species_id)` in that order. (5) Add `sqlite.pragma('foreign_keys = ON')` at [src/main/db/client.ts:20](src/main/db/client.ts#L20) (one line after `journal_mode = WAL`). (6) Mirror the existing analyte.ts `create()` + `findByNamePlatformSpecies` idioms for the two new upsert methods. (7) Install vitest + write first-ever repository tests against an in-memory `better-sqlite3` DB; if the discuss-phase decides tests are out-of-scope for Phase 5, document manual verification steps instead.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Table/column DDL | Drizzle schema.ts | drizzle-kit generated SQL migration | Schema is TS-first; migration is the deploy artifact |
| Composite unique constraint | Drizzle `uniqueIndex().on()` | SQLite `CREATE UNIQUE INDEX` | Drizzle emits; DB enforces |
| FK cascade rules | Drizzle `.references({onDelete})` | SQLite FK pragma at runtime | Schema declares; `PRAGMA foreign_keys = ON` activates |
| ID generation | `crypto.randomUUID()` in repo `create()` | — | Application-layer UUIDs, not DB autoincrement |
| Timestamp generation | `new Date().toISOString()` in repo methods | — | Application-layer; no DB default |
| Case-insensitive lookup | Drizzle `sql\`lower(col) = lower(?)\`` | SQLite `lower()` built-in | Application-layer SQL fragment |
| Connection PRAGMA | `initializeDatabase()` in client.ts | — | Per-connection, set once at app boot |
| Transaction boundary | **Phase 7 caller** (not Phase 5 upserts) | `sqlite.transaction(() => { ... })` | D-18: upserts are transaction-agnostic; caller owns the scope |
| Return shape `{ id, action }` | Repository method | Phase 7 result banner consumer | Data-layer returns provenance; UI layer renders it |

**Why this matters:** Phase 5 is pure data-access layer. Any leak of IPC knowledge, Zod validation, or business logic into the repository methods violates the established "Repository = pure data-access layer" convention (CONTEXT.md §Established Patterns).

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| drizzle-orm | 0.45.1 | Type-safe SQL builder + schema definition | Already the project's ORM; `$inferSelect` / `$inferInsert` give us free types [VERIFIED: package.json:35] |
| drizzle-kit | 0.31.8 | Schema → migration SQL generator | Already wired via `npm run db:generate` [VERIFIED: package.json:53,25] |
| better-sqlite3 | 12.6.2 | Synchronous SQLite driver | Already the project's driver; synchronous API is why repositories are synchronous [VERIFIED: package.json:32] |
| zod | 3.24.2 | Runtime validation | NOT used in Phase 5 (repository layer is Zod-free by convention; CONTEXT.md §Established Patterns); listed only because Phase 7 importer uses it [VERIFIED: package.json:41] |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| vitest | **NOT INSTALLED** | Test runner | Required if Phase 5 ships repository unit tests — see §Validation Architecture §Wave 0 Gaps |
| `crypto` (Node built-in) | — | `randomUUID()` for PK generation | Standard PK-gen pattern across every existing repo [VERIFIED: src/main/db/repositories/analyte.ts:42, panel.ts:71] |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| `uniqueIndex().on(a, b)` | column-level `.unique()` on each column | WRONG for this case — generates two single-column indexes, not a composite index. PITFALLS §Pitfall 14 explicitly forbids. |
| drizzle `.references({onDelete: 'set null'})` | Hand-edit the generated migration SQL | Hand-editing breaks `_journal.json` integrity (decision log 04-01: "kept drizzle-kit auto-generated name to avoid hand-editing _journal.json"). Declare cascade in schema.ts, let drizzle-kit emit. |
| `sqlite.pragma('foreign_keys = ON')` before opening DB | Setting PRAGMA via DSN query string | better-sqlite3 does not accept DSN flags; pragma MUST be called on the Database instance [VERIFIED: docs style, matches existing `sqlite.pragma('journal_mode = WAL')` at client.ts:19]. |
| Vitest | Jest | Vitest ships a faster SWC-based compiler and reads `tsconfig.*.json` natively — smaller setup. But Jest is equally viable; either is a planner choice. |

**Installation (conditional — only if Phase 5 ships tests):**
```bash
npm install --save-dev vitest @vitest/ui
```

**Version verification:**
- drizzle-orm 0.45.1 `[VERIFIED: package.json:35]`
- drizzle-kit 0.31.8 `[VERIFIED: package.json:53]`
- better-sqlite3 12.6.2 `[VERIFIED: package.json:32]`
- No `npm view` calls performed; versions are whatever is pinned. Planner should not upgrade dependencies in Phase 5 — scope creep.

## Architecture Patterns

### System Architecture Diagram (Phase 5 schema boundary)

```
┌───────────────────────────────────────────────────────────────────────┐
│  Electron main process                                                │
│                                                                       │
│  app.whenReady()                                                      │
│     │                                                                 │
│     ▼                                                                 │
│  initializeDatabase()            src/main/db/client.ts                │
│     │  new Database(dbPath)                                           │
│     │  sqlite.pragma('journal_mode = WAL')                            │
│     │  sqlite.pragma('foreign_keys = ON')     ◄── D-12 adds this      │
│     │  drizzle(sqlite, { schema })                                    │
│     ▼                                                                 │
│  runMigrations()                 src/main/db/migrate.ts               │
│     │  migrate(db, { migrationsFolder })                              │
│     │    └─► applies drizzle/migrations/0004_*.sql                    │
│     │           • CREATE TABLE master_panels                          │
│     │           • CREATE UNIQUE INDEX ... (platform_id, species_id)   │
│     │           • ALTER TABLE premix_panels ADD master_panel_id       │
│     │           • ALTER TABLE premix_panels ADD sub_panel_conc        │
│     │           • ALTER TABLE analytes ADD master_panel_id            │
│     ▼                                                                 │
│  seedAll()                       src/main/db/seed.ts                  │
│     │  (untouched in Phase 5)                                         │
│     ▼                                                                 │
│  registerIpcHandlers()                                                │
│                                                                       │
│  ─────────────────────────────────────────────────────────────────    │
│  Repository layer (Phase 5 additions)                                 │
│                                                                       │
│    masterPanelRepository        src/main/db/repositories/             │
│       .upsertByPlatformAndSpecies(input) ──► { id, action }  masterPanel.ts (new)   │
│                                                                       │
│    analyteRepository (extended)                                       │
│       .upsertByNameInMaster(input) ──► { id, action }  analyte.ts (extended)        │
│                                                                       │
│  Consumers: Phase 7 importer (wraps in single sqlite.transaction)     │
└───────────────────────────────────────────────────────────────────────┘
```

### Recommended Project Structure (delta only)

```
src/main/db/
├── client.ts                    # +1 line: sqlite.pragma('foreign_keys = ON')
├── schema.ts                    # +masterPanels table, +master_panel_id cols, +sub_panel_conc, +type exports
├── migrate.ts                   # unchanged
└── repositories/
    ├── analyte.ts               # +upsertByNameInMaster method
    ├── masterPanel.ts           # NEW
    └── panel.ts                 # UNCHANGED in Phase 5 (premix upsert belongs to Phase 7)
src/shared/types/
├── analyte.ts                   # +masterPanelId: string | null on Analyte + AnalyteCreate
├── panel.ts                     # +masterPanelId: string | null, +subPanelConc: number on PremixPanel + PremixPanelCreate
└── masterPanel.ts               # NEW
drizzle/migrations/
├── 0004_<auto>.sql              # NEW — single generated file
└── meta/_journal.json           # auto-updated by drizzle-kit
```

### Component Responsibilities

| File | Responsibility | New in Phase 5? |
|------|----------------|-----------------|
| `src/main/db/schema.ts` | Drizzle table + index definitions; `$inferSelect`/`$inferInsert` type exports | Extended |
| `src/main/db/client.ts:20` | Add `sqlite.pragma('foreign_keys = ON')` | Extended (+1 line) |
| `src/main/db/repositories/masterPanel.ts` | `upsertByPlatformAndSpecies` | New |
| `src/main/db/repositories/analyte.ts` | Add `upsertByNameInMaster` to existing repo object | Extended |
| `src/shared/types/masterPanel.ts` | `MasterPanel`, `MasterPanelCreate`, `MasterPanelUpsertInput`, `UpsertAction` discriminator | New |
| `src/shared/types/analyte.ts` | Add `masterPanelId: string \| null` to `Analyte` + `AnalyteCreate`; add `AnalyteUpsertInMasterInput` + `AnalyteUpsertResult` | Extended |
| `src/shared/types/panel.ts` | Add `masterPanelId: string \| null`, `subPanelConc: number` to `PremixPanel` + `PremixPanelCreate` | Extended |
| `drizzle/migrations/0004_*.sql` | DDL statements | New (generated) |

### Pattern 1: Composite `uniqueIndex` in `sqliteTable`
**What:** Drizzle accepts a third argument to `sqliteTable(name, cols, (t) => indexMap)` that declares table-level constraints. Composite unique indexes MUST go here, not on individual columns.

**When to use:** Whenever the uniqueness constraint spans more than one column. PITFALLS §Pitfall 14 forbids column-level `.unique()` for this purpose.

**Example:**
```typescript
// Source: Drizzle 0.45.x sqliteTable API (matches the operators.name usage pattern at schema.ts:66 for single-column; extends to multi-column via the 3rd-arg callback).
// [CITED: drizzle-orm docs — sqlite-core, sqliteTable]

import { sqliteTable, text, real, uniqueIndex } from 'drizzle-orm/sqlite-core'

export const masterPanels = sqliteTable(
  'master_panels',
  {
    id: text('id').primaryKey(),
    name: text('name').notNull(),
    platformId: text('platform_id')
      .notNull()
      .references(() => platforms.id, { onDelete: 'restrict' }),
    speciesId: text('species_id')
      .notNull()
      .references(() => species.id, { onDelete: 'restrict' }),
    beadsVolumePerWell: real('beads_volume_per_well').notNull(),
    abVolumePerWell: real('ab_volume_per_well').notNull(),
    sapeVolumePerWell: real('sape_volume_per_well').notNull(),
    vendorSinglesTerm: text('vendor_singles_term'),
    createdAt: text('created_at').notNull(),
    updatedAt: text('updated_at').notNull()
  },
  (t) => ({
    platformSpeciesUniq: uniqueIndex('master_panels_platform_species_uniq').on(
      t.platformId,
      t.speciesId
    )
  })
)
```

**Verification after `npm run db:generate`:**
```bash
grep -E "CREATE UNIQUE INDEX.*master_panels.*platform_id.*species_id" \
  drizzle/migrations/0004_*.sql
```
Expected match: `CREATE UNIQUE INDEX \`master_panels_platform_species_uniq\` ON \`master_panels\` (\`platform_id\`,\`species_id\`);`

If drizzle-kit issue #3411 bites (ASSUMED risk — unverified against the installed 0.31.8 release): two fallback options, in order of preference:
1. **Commit the generated file as-is, then append a second migration** (`0005_fix_composite_unique.sql`) containing `CREATE UNIQUE INDEX IF NOT EXISTS ...` by hand. This preserves drizzle-kit's `_journal.json` integrity.
2. **Last resort:** manually edit `0004_*.sql` and DO NOT touch `_journal.json`. Flag in the commit message that this is a drizzle-kit workaround; cite issue #3411.

Do NOT attempt to fix by re-running `npm run db:generate` — drizzle-kit emits the same result deterministically from the same schema.ts.

### Pattern 2: FK with explicit onDelete cascade
**What:** Drizzle's `.references()` accepts an options object with `onDelete` / `onUpdate` keys.

**When to use:** Every new FK added in Phase 5 MUST declare onDelete explicitly per D-09/D-10/D-11 and PITFALLS §Pitfall 13.

**Example (upward RESTRICT for master_panels → platforms/species):**
```typescript
// Source: Existing FK declaration pattern in schema.ts:17, 28, 31, 44, 47, 56, 59 — extended with options object.
// [VERIFIED: src/main/db/schema.ts]

platformId: text('platform_id')
  .notNull()
  .references(() => platforms.id, { onDelete: 'restrict' }),
```

**Example (downward SET NULL for analytes/premix_panels → master_panels):**
```typescript
// [VERIFIED: Drizzle sqlite-core API — same pattern as CLAUDE.md decision log 04-01 and schema.ts existing FKs]

masterPanelId: text('master_panel_id')
  .references(() => masterPanels.id, { onDelete: 'set null' }),
  // ^ nullable by omission — no .notNull() → TEXT NULL
```

**Expected SQL output** (matches existing style at drizzle/migrations/0003_damp_prima.sql:46-49 but with explicit cascades):
```sql
FOREIGN KEY (`platform_id`) REFERENCES `platforms`(`id`) ON UPDATE no action ON DELETE restrict,
FOREIGN KEY (`master_panel_id`) REFERENCES `master_panels`(`id`) ON UPDATE no action ON DELETE set null
```

### Pattern 3: `PRAGMA foreign_keys = ON` per-connection
**What:** SQLite FK enforcement is **off by default** and is a per-connection setting. better-sqlite3 mirrors this.

**When to use:** Once at `initializeDatabase()`, immediately after `journal_mode = WAL` per D-12.

**Exact placement:**
```typescript
// src/main/db/client.ts
sqlite = new Database(dbPath)

// Enable WAL mode for concurrent read/write performance
sqlite.pragma('journal_mode = WAL')

// Enable FK constraint enforcement per-connection (D-12, Pitfall 13)
sqlite.pragma('foreign_keys = ON')
```

**Timing vs migrations:** `runMigrations()` is called AFTER `initializeDatabase()` in [src/main/index.ts:42-44](src/main/index.ts#L42-L44), so FK enforcement is already on when the migration runs. For a purely additive migration (Phase 5 adds columns/tables but never drops or renames existing FKs), there is no FK-violation risk during migration execution itself.

**Boot-time risk on existing data:** Once the pragma is on, every subsequent `INSERT`/`UPDATE`/`DELETE` validates FKs. If any **existing** row in `analytes`, `premix_panels`, `panel_analytes`, `runs`, `run_single_analytes`, or `species` references a non-existent parent (e.g. an orphaned `panel_id` from a bygone delete), that row will NOT fail immediately — existing rows are grandfathered in. FK checks only run on new writes. **Mitigation:** Before merging Phase 5, run `PRAGMA foreign_key_check;` against a copy of the dev DB (one-line SQL returns offending rows). If any surface, flag for Phase 9 UAT. `[VERIFIED: SQLite docs, PRAGMA foreign_key_check returns offending refs without applying writes]`

**better-sqlite3 API:** `sqlite.pragma('foreign_keys = ON')` — returns `[]` for a write-only pragma. Use `sqlite.pragma('foreign_keys', { simple: true })` to READ. Not needed here. `[VERIFIED: better-sqlite3 docs, Database.prototype.pragma]`

### Pattern 4: Repository upsert with `{ id, action }` return
**What:** The two new repository methods follow the existing `create()` / `findBy...()` idioms but combine them into a single call returning a discriminated result.

**When to use:** Phase 7 importer needs to report per-tab stats ("Imported N master panels: X (M analytes adopted, K new, ...)"). The `action` discriminator drives the banner copy.

**Example — `masterPanelRepository.upsertByPlatformAndSpecies`:**
```typescript
// Source: Mirrors analyteRepository.create (analyte.ts:39-58) + analyteRepository.update (analyte.ts:84-97) fused.
// [VERIFIED: src/main/db/repositories/analyte.ts, panel.ts patterns]

import { eq, and } from 'drizzle-orm'
import { getDatabase } from '../client'
import { masterPanels } from '../schema'
import type { MasterPanel, MasterPanelUpsertInput, UpsertResult } from '../../../shared/types/masterPanel'

export const masterPanelRepository = {
  // ... other methods (findById, getByPlatformAndSpecies, etc. — discretion)

  upsertByPlatformAndSpecies(input: MasterPanelUpsertInput): UpsertResult {
    const db = getDatabase()
    const now = new Date().toISOString()

    const existing = db
      .select()
      .from(masterPanels)
      .where(
        and(
          eq(masterPanels.platformId, input.platformId),
          eq(masterPanels.speciesId, input.speciesId)
        )
      )
      .get()

    if (existing) {
      db.update(masterPanels)
        .set({
          name: input.name,
          beadsVolumePerWell: input.beadsVolumePerWell,
          abVolumePerWell: input.abVolumePerWell,
          sapeVolumePerWell: input.sapeVolumePerWell,
          vendorSinglesTerm: input.vendorSinglesTerm ?? null,
          updatedAt: now
        })
        .where(eq(masterPanels.id, existing.id))
        .run()
      return { id: existing.id, action: 'updated' }
    }

    const id = crypto.randomUUID()
    db.insert(masterPanels)
      .values({
        id,
        name: input.name,
        platformId: input.platformId,
        speciesId: input.speciesId,
        beadsVolumePerWell: input.beadsVolumePerWell,
        abVolumePerWell: input.abVolumePerWell,
        sapeVolumePerWell: input.sapeVolumePerWell,
        vendorSinglesTerm: input.vendorSinglesTerm ?? null,
        createdAt: now,
        updatedAt: now
      })
      .run()
    return { id, action: 'created' }
  }
}
```

**Example — `analyteRepository.upsertByNameInMaster` (the critical Pitfall-1 adoption gate):**
```typescript
// Source: Reuses analyteRepository.findByNamePlatformSpecies (analyte.ts:60-74) verbatim + update (analyte.ts:84-97) + create (analyte.ts:39-58).
// The three-way action discriminator ('created' | 'adopted' | 'updated') is the critical Phase-7 Pitfall-1 gate.
// [VERIFIED: src/main/db/repositories/analyte.ts]

upsertByNameInMaster(input: {
  name: string
  platformId: string
  speciesId: string
  masterPanelId: string
  beadRegion: number
  concentration: number  // single_conc — NOT premix_conc (D-04, D-17)
}): { id: string; action: 'created' | 'adopted' | 'updated' } {
  const db = getDatabase()
  const now = new Date().toISOString()

  // Reuses the EXACT pattern from findByNamePlatformSpecies(analyte.ts:60-74)
  const existing = db
    .select()
    .from(analytes)
    .where(
      and(
        sql`lower(${analytes.name}) = lower(${input.name})`,
        eq(analytes.platformId, input.platformId),
        eq(analytes.speciesId, input.speciesId)
      )
    )
    .get()

  if (existing) {
    const action = existing.masterPanelId === null ? 'adopted' : 'updated'
    db.update(analytes)
      .set({
        beadRegion: input.beadRegion,
        singleConc: input.concentration,
        masterPanelId: input.masterPanelId,
        updatedAt: now
        // NOTE: premixConc is NEVER touched per D-17.
        // NOTE: name is NOT touched — existing row's casing wins (preserves manual edits; idempotent).
      })
      .where(eq(analytes.id, existing.id))
      .run()
    return { id: existing.id, action }
  }

  const id = crypto.randomUUID()
  db.insert(analytes)
    .values({
      id,
      name: input.name,
      beadRegion: input.beadRegion,
      premixConc: 0,  // TBD: confirm with planner. Current seed.ts uses 15-25; NOT NULL constraint forces SOME value. Options: (a) 0 as sentinel, (b) copy from input.concentration, (c) Phase 5 drops the NOT NULL constraint. DO NOT change schema in Phase 5; OPTION (a) or (b). [ASSUMED: planner decides]
      singleConc: input.concentration,
      platformId: input.platformId,
      speciesId: input.speciesId,
      masterPanelId: input.masterPanelId,
      createdAt: now,
      updatedAt: now
    })
    .run()
  return { id, action: 'created' }
}
```

**⚠ Open question for planner:** What value does `upsertByNameInMaster` write for `premix_conc` on the INSERT path? `premix_conc` is a `REAL NOT NULL` column (schema.ts:40), marked for v2.1 removal (D-04), but Phase 5 cannot leave it unset. Three viable answers — the planner should lock one:
1. **Sentinel `0`** — semantically "dead column, new row never goes through premix path." Consistent with D-04.
2. **Copy `input.concentration` into it** — preserves v1-style shape where `premix_conc` and `single_conc` were the same. Easier if a future code path accidentally reads `premix_conc`.
3. **Default in the schema** — add `.default(0)` to the `premixConc` column in schema.ts. Minor schema churn but eliminates the repository-level sentinel choice.

Recommendation: **Option 2 (copy `input.concentration`)** — matches the v1 importer's implicit invariant (importer.ts:101 writes `premixConc: row.premix_conc` from the same CSV column that in some cases equalled `single_conc`) and is the least surprising if someone reads the DB directly in v2.0 before the v2.1 drop.

### Anti-Patterns to Avoid
- **Column-level `.unique()` for multi-column uniqueness** (PITFALLS §Pitfall 14). Current schema uses `.unique()` correctly — single-column only, at schema.ts:66 for `operators.name`.
- **Hand-editing drizzle-kit-generated `.sql` files** (decision log 04-01 forbids; breaks `_journal.json`). Exception: documented drizzle-kit bug workaround (see Pattern 1 fallback §2).
- **Opening a transaction inside the repository upsert methods** (D-18). Phase 7 importer owns transaction scope.
- **Touching `premix_conc` in `upsertByNameInMaster` UPDATE path** (D-17 explicit). Only INSERT path supplies a value; UPDATE path preserves existing.
- **Renaming `premix_panels` to `panels`** (PITFALLS §Pitfall 15).
- **Wrapping upsert result in an exception path for the `'updated'` case** — no-throw; return the discriminator.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Composite unique constraint | Custom pre-insert SELECT + lock | `uniqueIndex('name').on(a, b)` + let SQLite enforce | SQLite's UNIQUE INDEX is atomic with the INSERT; pre-select has a TOCTOU race under concurrent writes (moot here since better-sqlite3 is synchronous but cheap insurance) |
| FK cascade semantics | Application-level cascade via `db.delete` on child rows before parent | `.references(..., { onDelete: 'set null' \| 'restrict' })` | SQLite handles it atomically inside the DELETE statement; app-level is racy and verbose |
| Case-insensitive name match | `LOWER()` in JS before DB query | `sql\`lower(${col}) = lower(${val})\`` | PITFALLS §Pitfall 9; SQLite handles collation; matches the existing codebase pattern (analyte.ts:67, panel.ts:59) — single source of truth for case-insensitive match semantics |
| UUID generation | Custom v4 UUID via Math.random | `crypto.randomUUID()` | Already the project convention (analyte.ts:42, panel.ts:71); cryptographically secure; built-in |
| Timestamp generation | `Date.now()` as integer; epoch-in-TEXT custom format | `new Date().toISOString()` | Matches every existing column (platforms.created_at, species.created_at, analytes.created_at); collation-stable ISO-8601 strings sort correctly |
| Upsert via `INSERT ... ON CONFLICT` SQL | Raw `onConflictDoUpdate` builder | Explicit `findBy... → if/else → update/insert` | Matches v1 importer.ts:74-106 pattern; keeps the `action` discriminator easy to compute; Drizzle's `.onConflictDoUpdate()` is available but doesn't give us the `'created' \| 'adopted' \| 'updated'` three-way split without extra plumbing |
| Per-connection pragma management | Custom wrapper class tracking pragma state | `sqlite.pragma('foreign_keys = ON')` once at init | Per-connection; better-sqlite3 opens ONE connection per `initializeDatabase()`, so once-at-init is sufficient |

**Key insight:** Every capability Phase 5 needs already has an idiomatic answer in the codebase. The planner's job is to reuse the existing patterns verbatim — not invent new ones. If a planner proposes something novel, reject it.

## Common Pitfalls

### Pitfall 1: Composite UNIQUE INDEX not emitted correctly by drizzle-kit (drizzle-kit issue #3411)
**What goes wrong:** Under some drizzle-kit / drizzle-orm version combinations, the generator emits the unique index but with the WRONG column order, or silently collapses a composite unique into a multi-column PK, or fails to emit any CREATE UNIQUE INDEX statement at all.

**Why it happens:** Upstream drizzle-kit bug. PITFALLS §Pitfall 14 references it without pinning a specific version.

**How to avoid:** Grep-verify the generated SQL AFTER running `npm run db:generate`. Do not assume the schema.ts declaration alone is sufficient.

**Exact grep:**
```bash
grep -E "CREATE UNIQUE INDEX\s+[\`\"']?master_panels_platform_species_uniq[\`\"']?\s+ON\s+[\`\"']?master_panels[\`\"']?\s*\(\s*[\`\"']?platform_id[\`\"']?\s*,\s*[\`\"']?species_id[\`\"']?\s*\)" drizzle/migrations/0004_*.sql
```

If this does not return exactly one match, the migration is broken — apply the fallback from Pattern 1 §Verification.

**Warning signs:** SC #2 fails: `grep` of the generated SQL finds nothing, or finds a single-column index instead of composite. SC #3 fails: inserting two rows with same `(platform_id, species_id)` succeeds (should throw `UNIQUE constraint failed`).

[ASSUMED: drizzle-kit issue #3411 may or may not affect 0.31.8 specifically — PITFALLS.md flags the risk without pinning the version; researcher did not verify against the live npm registry. The mitigation (grep-verify) works regardless of whether the bug triggers.]

### Pitfall 2: `PRAGMA foreign_keys = ON` surfaces pre-existing FK violations
**What goes wrong:** Once the pragma is on, any future write that would violate an FK fails. Existing rows are grandfathered, but any UPDATE that touches an FK column re-validates it. A pre-existing orphaned `panel_id` in a run record (hypothetical) would surface as a write error on the first attempt to update that row.

**Why it happens:** The pragma has been OFF since v0.1.0 (client.ts:19 never enabled it). If any soft-deletion or manual DB edit orphaned a reference, it has been silently tolerated.

**How to avoid:** Before merging the Phase 5 PR, run `PRAGMA foreign_key_check;` against a copy of `immunoplex.db` from a real Windows workstation. Flag any offender to the operator.

**Warning signs:** App boots, first save of a run throws `FOREIGN KEY constraint failed`. Data loss risk if the operator has unsaved work.

### Pitfall 3: `premix_conc` NOT NULL column forces a sentinel on new inserts
**What goes wrong:** `analytes.premix_conc` is `REAL NOT NULL` (schema.ts:40). D-04 declares it dead in Phase 5 but preserves it for v2.1 removal. The INSERT path of `upsertByNameInMaster` MUST supply a value.

**Why it happens:** v1 schema decision. Leaving it untouched is correct per PITFALLS §Pitfall 12 (no constraint-tightening / drop in the same migration as additive deltas).

**How to avoid:** Planner locks the sentinel value. Recommendation: copy `input.concentration` into it (preserves v1-style shape, least-surprise for any stray reader).

**Warning signs:** NOT NULL constraint failed on INSERT via `upsertByNameInMaster`; test suite catches this immediately.

### Pitfall 4: Case-insensitive match in `upsertByNameInMaster` double-creates on Unicode edge cases
**What goes wrong:** `lower()` in SQLite is ASCII-only by default; "İ" (Turkish dotted capital i) does not lowercase to "i". Vendor xlsx files with accented characters may bypass the deduplication.

**Why it happens:** SQLite's built-in `lower()` is deliberately ASCII-only.

**How to avoid:** **Not a Phase 5 concern.** Analyte names in the current DB and expected vendor fixtures (Millipore Mouse Panel 1) are pure ASCII. Flag as a follow-up if a non-ASCII analyte name ever appears. PITFALLS §Pitfall 9 covers this more broadly.

**Warning signs:** Duplicate analyte rows with visually-identical names differing only by Unicode normalization.

### Pitfall 5: Drizzle `$inferSelect` doesn't reflect nullability correctly on newly-added columns
**What goes wrong:** When you add a nullable column in schema.ts via `text('master_panel_id')` (no `.notNull()`), Drizzle infers the type as `string | null` on `$inferSelect`. If your `shared/types/analyte.ts` hand-written `Analyte` interface doesn't match, the TypeScript contract between the repository layer and the UI drifts.

**Why it happens:** The project hand-writes `shared/types/*.ts` instead of re-exporting `$inferSelect` (see analyte.ts, panel.ts, etc. for the pattern).

**How to avoid:** When adding a new column, update BOTH schema.ts AND shared/types/<table>.ts in the same commit. Verify with `npm run typecheck`.

**Warning signs:** `typecheck:node` fails on the repository return type; or worse, silently accepts a mismatch because the UI layer casts through `any`.

## Runtime State Inventory

> Phase 5 is a **greenfield schema extension** (additive columns and a new table). It contains one **migration-like aspect** — the PRAGMA `foreign_keys = ON` flip turns on latent FK enforcement against existing data. Full inventory below.

| Category | Items Found | Action Required |
|----------|-------------|------------------|
| Stored data | Existing rows in `platforms`, `species`, `premix_panels`, `analytes`, `panel_analytes`, `operators`, `runs`, `run_single_analytes`. All rows get `master_panel_id = NULL` automatically (additive nullable column); `premix_panels.sub_panel_conc` requires a NOT NULL default OR must be nullable initially. **Planner decision:** Should `sub_panel_conc` default to `1.0` (treat every legacy premix as "regular premix, 1× concentration" per CONTEXT.md §Schema Delta D-10)? Recommendation: **yes**. Add `.default(1)` to the column definition. Existing rows materialize 1.0; xlsx import overwrites. | Schema edit with `.default(1)` on the new `sub_panel_conc` column; no separate data-migration file. |
| Live service config | None. No external services (no SaaS, no Docker, no OS task scheduler). Electron app runs fully local against a single SQLite file in `app.getPath('userData')`. | None. |
| OS-registered state | None. Electron app is registered via the v0.6.0 installer's NSIS Start Menu entry — no per-schema registration. | None. |
| Secrets/env vars | `ELECTRON_RUN_AS_NODE` (SDK-only, affects dev on macOS only; unrelated to schema). No DB credentials, no env-var-injected config. | None. |
| Build artifacts | `out/main/*.js` (bundled by electron-vite), `dist/*-setup.exe` (from electron-builder). Neither references schema names. `drizzle/migrations/meta/_journal.json` auto-updates when `db:generate` runs — DO NOT hand-edit. | After `npm run db:generate`, `git add drizzle/migrations/0004_*.sql drizzle/migrations/meta/_journal.json`; verify `_journal.json` contains the new migration entry before commit. |

**Canonical question check:** *After every file in the repo is updated, what runtime systems still have the old string cached, stored, or registered?* — **Nothing.** Phase 5 is pure additive schema; no renaming, no string migration.

## Code Examples

### `master_panels` table definition (complete)
```typescript
// src/main/db/schema.ts — add after the existing species export, before premixPanels
// [VERIFIED: matches existing style at schema.ts:3-10 platforms, 12-20 species]

export const masterPanels = sqliteTable(
  'master_panels',
  {
    id: text('id').primaryKey(),
    name: text('name').notNull(),
    platformId: text('platform_id')
      .notNull()
      .references(() => platforms.id, { onDelete: 'restrict' }),
    speciesId: text('species_id')
      .notNull()
      .references(() => species.id, { onDelete: 'restrict' }),
    beadsVolumePerWell: real('beads_volume_per_well').notNull(),
    abVolumePerWell: real('ab_volume_per_well').notNull(),
    sapeVolumePerWell: real('sape_volume_per_well').notNull(),
    vendorSinglesTerm: text('vendor_singles_term'), // nullable
    createdAt: text('created_at').notNull(),
    updatedAt: text('updated_at').notNull()
  },
  (t) => ({
    platformSpeciesUniq: uniqueIndex('master_panels_platform_species_uniq').on(
      t.platformId,
      t.speciesId
    )
  })
)

// Type exports — mirrors schema.ts:128-150 style
export type MasterPanel = typeof masterPanels.$inferSelect
export type NewMasterPanel = typeof masterPanels.$inferInsert
```

### `premix_panels` and `analytes` extensions
```typescript
// Extend the existing premixPanels definition (schema.ts:22-34) to ADD two columns:
export const premixPanels = sqliteTable('premix_panels', {
  // ... existing columns unchanged ...
  masterPanelId: text('master_panel_id').references(() => masterPanels.id, { onDelete: 'set null' }),
  subPanelConc: real('sub_panel_conc').notNull().default(1)
})

// Extend the existing analytes definition (schema.ts:36-50) to ADD one column:
export const analytes = sqliteTable('analytes', {
  // ... existing columns unchanged ...
  masterPanelId: text('master_panel_id').references(() => masterPanels.id, { onDelete: 'set null' })
})
```

### `shared/types/masterPanel.ts` (new file)
```typescript
// src/shared/types/masterPanel.ts
// [VERIFIED: Shape mirrors src/shared/types/panel.ts 1-28, src/shared/types/platform.ts 1-22]

export interface MasterPanel {
  id: string
  name: string
  platformId: string
  speciesId: string
  beadsVolumePerWell: number
  abVolumePerWell: number
  sapeVolumePerWell: number
  vendorSinglesTerm: string | null
  createdAt: string
  updatedAt: string
}

export interface MasterPanelCreate {
  name: string
  platformId: string
  speciesId: string
  beadsVolumePerWell: number
  abVolumePerWell: number
  sapeVolumePerWell: number
  vendorSinglesTerm: string | null
}

export interface MasterPanelUpsertInput extends MasterPanelCreate {}

export type UpsertAction = 'created' | 'adopted' | 'updated'

export interface UpsertResult {
  id: string
  action: UpsertAction
}
```

### `shared/types/analyte.ts` extension
```typescript
// src/shared/types/analyte.ts — ADD field to existing interfaces
// [VERIFIED: current shape at src/shared/types/analyte.ts:1-28]

export interface Analyte {
  // ... existing fields ...
  masterPanelId: string | null  // NEW
}

export interface AnalyteCreate {
  // ... existing fields ...
  masterPanelId?: string | null  // NEW — optional on create; upsertByNameInMaster always sets it
}

// NEW types:
export interface AnalyteUpsertInMasterInput {
  name: string
  platformId: string
  speciesId: string
  masterPanelId: string
  beadRegion: number
  concentration: number  // → single_conc per D-04
}
```

### `shared/types/panel.ts` extension
```typescript
// src/shared/types/panel.ts — ADD fields to existing interfaces

export interface PremixPanel {
  // ... existing fields ...
  masterPanelId: string | null  // NEW
  subPanelConc: number          // NEW — defaults to 1 in DB for pre-existing rows
}

export interface PremixPanelCreate {
  // ... existing fields ...
  masterPanelId?: string | null
  subPanelConc?: number  // optional; defaults to 1 at DB layer
}
```

### `src/main/db/client.ts` one-line addition
```typescript
// BEFORE (line 19):
  sqlite.pragma('journal_mode = WAL')

// AFTER:
  sqlite.pragma('journal_mode = WAL')
  // Enable FK constraint enforcement per-connection (D-12, PITFALLS §Pitfall 13).
  // Must run on every open Database; SQLite default is OFF.
  sqlite.pragma('foreign_keys = ON')
```

### drizzle-kit migration generation
```bash
# One pass, from repo root. drizzle.config.ts points at src/main/db/schema.ts (drizzle.config.ts:4).
npm run db:generate
# → drizzle-kit generate
# → emits drizzle/migrations/0004_<adjective>_<noun>.sql
# → updates drizzle/migrations/meta/_journal.json

# Verify:
ls -lt drizzle/migrations/0004_*.sql

# Grep-confirm composite unique index (Pitfall 1):
grep -E "CREATE UNIQUE INDEX.*master_panels_platform_species_uniq.*platform_id.*species_id" drizzle/migrations/0004_*.sql

# Grep-confirm explicit cascade rules (Pitfall 13):
grep -E "ON DELETE (restrict|set null)" drizzle/migrations/0004_*.sql
# Expected: 2 restrict (platforms, species), 2 set null (premix_panels, analytes → master_panels)

# Commit both files together:
git add src/main/db/schema.ts drizzle/migrations/0004_*.sql drizzle/migrations/meta/_journal.json
```

## State of the Art

| Old Approach (v1.x) | Current Approach (Phase 5) | When Changed | Impact |
|---------------------|----------------------------|--------------|--------|
| FK enforcement off (implicit default) | `sqlite.pragma('foreign_keys = ON')` explicit | Phase 5 D-12 | Closes a pre-existing integrity gap; may surface pre-existing orphans on next write (see Pitfall 2) |
| Column-level FK with default `no action` onDelete | Explicit `.references(..., { onDelete: ... })` on all NEW FKs | Phase 5 D-09/D-10/D-11 | Existing FKs unchanged (D-15); new FKs behave correctly if a future delete UI ships |
| `analytes.premix_conc REAL NOT NULL` (v1 meaningful) | `analytes.premix_conc REAL NOT NULL` (v2 dead column) | Phase 5 D-04 | Dead code in v2.0; drop in v2.1 via separate migration |
| Single reagent volume per panel (if any) | Three per master panel (beads/ab/sape) + `sub_panel_conc` on premix | Phase 5 D-09, D-10 | Schema carries the shape Phase 8 calculator needs; REQUIREMENTS.md MPAN-01 wording needs doc-debt update |

**Deprecated/outdated:**
- `DEFAULT_VOLUME_PER_WELL = 25` constant at [src/shared/constants/calculator.ts:21](src/shared/constants/calculator.ts#L21) — stays but becomes unreferenced post-Phase 8 per D-02 strict. NOT a Phase 5 concern.
- Column-level `.unique()` for composite uniqueness — forbidden by PITFALLS §Pitfall 14. Only single-column `.unique()` is used in the current schema (operators.name at schema.ts:66).

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | drizzle-kit 0.31.8 correctly emits composite `CREATE UNIQUE INDEX` for the `(t) => ({ uniqueIndex().on(a, b) })` pattern | §Pattern 1 Example, §Common Pitfalls §Pitfall 1 | Low — even if #3411 affects 0.31.8, the grep-verify step + fallback migration pattern works. | 
| A2 | `sub_panel_conc REAL NOT NULL DEFAULT 1` is the right shape for the new column on `premix_panels` (pre-existing rows get `1.0`) | §Runtime State Inventory, §Code Examples | Medium — if the domain requires `sub_panel_conc` to be `NULL` for legacy non-vendor panels, the schema needs to make the column nullable. Planner should confirm or discuss-phase should lock it. |
| A3 | `upsertByNameInMaster` INSERT path should write `premix_conc = input.concentration` (sentinel option 2) rather than `0` or a schema default | §Pattern 4, §Common Pitfalls §Pitfall 3 | Medium — affects what a v2.0 DB looks like on disk before the v2.1 column drop. No behavioral impact because no v2 code path reads `premix_conc`. |
| A4 | `analytes` rows with `master_panel_id = NULL` pre-existing in the DB pose no migration-time risk once `foreign_keys = ON` | §Architecture Patterns §Pattern 3 boot-time risk | Low — FK check only runs on writes; existing rows grandfathered. Dev DB `PRAGMA foreign_key_check;` run is the belt-and-braces. |
| A5 | No test framework install is treated as a Wave 0 gap for this phase (planner decides whether Phase 5 ships tests or defers) | §Validation Architecture §Wave 0 Gaps | High if tests are deferred — SC #3, SC #5 cannot be automated-verified. Manual verification steps are possible but fragile. |
| A6 | The new `masterPanelRepository` file name is `src/main/db/repositories/masterPanel.ts` (camelCase convention matching panel.ts and analyte.ts) | §Recommended Project Structure | Low — planner decides; codebase already uses lowerCamelCase |

**Confirmation-needed-before-execution items:** A2 (sub_panel_conc default), A3 (premix_conc sentinel), A5 (Phase 5 tests yes/no).

## Open Questions (RESOLVED)

*All three questions were locked by CONTEXT.md decisions D-20, D-22, and D-21 on 2026-04-23 during the post-research AskUserQuestion pass before planning.*

1. **Does Phase 5 ship its own unit tests, or is testing deferred to Phase 7 where the importer's transactional flow makes repository tests more valuable?**
   - What we know: No test framework installed; CONTEXT.md §Claude's Discretion mentions "programmatic generation via better-sqlite3 in-memory DB — follows existing repo test conventions" but there ARE NO existing repo test conventions to follow.
   - What's unclear: Whether the planner should (a) install vitest + write repository tests for this phase (supports SC #3 + SC #5 automation), (b) defer to Phase 7, (c) write tests inline but without a framework (run via `tsx`-style ad-hoc scripts).
   - Recommendation: **Option (a)** — install vitest, write ~6 tests (one per success criterion + edge cases). Small incremental investment; enables Phase 7 to land faster because the data-access layer is already test-covered.
   - **RESOLVED: D-20** — Phase 5 installs vitest as a devDependency and ships repository unit tests against an in-memory `better-sqlite3` DB covering SC #1, SC #3, SC #4, SC #5. Test fixture boilerplate becomes the canonical pattern for future phases.

2. **`premix_conc` sentinel value on the `upsertByNameInMaster` INSERT path.**
   - What we know: Column is `REAL NOT NULL` (schema.ts:40). No v2 code path reads it. D-04 flags v2.1 removal.
   - What's unclear: 0 vs `input.concentration` vs schema-level `.default(0)`.
   - Recommendation: `input.concentration` (Option 2 from §Pattern 4 ⚠ note) — least-surprise for any DB reader.
   - **RESOLVED: D-22** — On the INSERT (new-analyte) path, `upsertByNameInMaster` writes `input.concentration` to BOTH `single_conc` (new v2 field per D-04) AND `premix_conc` (legacy NOT NULL field). UPDATE paths never touch `premix_conc` (D-17).

3. **`sub_panel_conc` default for pre-existing `premix_panels` rows.**
   - What we know: D-10 says `REAL NOT NULL`, 1 for regular premix, 20 for JAMMate. Existing `premix_panels` rows are all "regular" by definition.
   - What's unclear: Whether the column ships with `.default(1)` (treats legacy as regular premix, materializes 1.0 in all existing rows) or is added as NULL-able and backfilled separately.
   - Recommendation: `.default(1)` — matches D-10 semantics, avoids a separate backfill step, and is how drizzle-kit natively handles ADD COLUMN with NOT NULL.
   - **RESOLVED: D-21** — `premix_panels.sub_panel_conc` ships as `REAL NOT NULL DEFAULT 1` at the Drizzle schema level. Legacy rows get `1` (regular premix) during `ALTER TABLE`. No separate backfill step.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js | drizzle-kit generator, repository code | ✓ | (inherited from npm runtime) | — |
| npm | `npm run db:generate`, install | ✓ | — | — |
| drizzle-orm | schema compilation | ✓ | 0.45.1 | — |
| drizzle-kit | migration generation | ✓ | 0.31.8 | — |
| better-sqlite3 | repository runtime + in-memory test DBs | ✓ | 12.6.2 | — |
| vitest | repository unit tests | ✗ | — | Manual verification steps documented below |
| Windows workstation | SC #4 runtime verification of PRAGMA (optional, covered by Phase 9 UAT anyway) | ✗ (dev is macOS) | — | Defer runtime verification to Phase 9 UAT; Phase 5 ships only the code change + migration |

**Missing dependencies with no fallback:** None.

**Missing dependencies with fallback:**
- **vitest** — if the planner defers, document manual verification steps:
  1. `npm run typecheck` — passes → schema.ts + shared/types/* compile against each other.
  2. `npm run db:generate` — produces `0004_*.sql`.
  3. Grep the SQL for composite unique index.
  4. Grep the SQL for explicit onDelete cascades.
  5. Open the migration SQL in a local SQLite CLI against a copy of `immunoplex.db`; confirm migration applies without error.
  6. Attempt `INSERT INTO master_panels` twice with same `(platform_id, species_id)` — expect `UNIQUE constraint failed`.
  7. `PRAGMA foreign_keys = ON; DELETE FROM platforms WHERE id = '<id_referenced_by_master_panel>';` — expect `FOREIGN KEY constraint failed`.
  8. `PRAGMA foreign_keys = ON; DELETE FROM master_panels WHERE id = '<id>';` — expect success with `UPDATE analytes SET master_panel_id = NULL` cascade.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | **NONE — Wave 0 gap.** Recommendation: vitest (latest stable). |
| Config file | `vitest.config.ts` (to be created at repo root) |
| Quick run command | `npx vitest run src/main/db/repositories/masterPanel.test.ts` |
| Full suite command | `npx vitest run` |

### Phase Requirements → Test Map

| Req ID / SC | Behavior | Test Type | Automated Command | File Exists? |
|-------------|----------|-----------|-------------------|-------------|
| MPAN-01 / SC #1 | Migrations apply against v1 dev DB without data loss; `master_panels` table + nullable FK columns exist | integration | `npx vitest run src/main/db/__tests__/migration.test.ts::applies_0004_to_v1_dump` | ❌ Wave 0 |
| MPAN-01 / SC #2 | Generated `0004_*.sql` contains composite `CREATE UNIQUE INDEX ON master_panels (platform_id, species_id)` | grep (bash-level) | `grep -E "CREATE UNIQUE INDEX.*master_panels_platform_species_uniq.*platform_id.*species_id" drizzle/migrations/0004_*.sql` | ❌ Wave 0 — drizzle migration doesn't exist yet |
| MPAN-01 / SC #3 | Inserting two master_panels rows with same `(platform_id, species_id)` fails with UNIQUE constraint violation; case-differing platform/species NAMES accepted | unit | `npx vitest run src/main/db/repositories/__tests__/masterPanel.test.ts::enforces_composite_unique` | ❌ Wave 0 |
| SC #4 (D-12) | `sqlite.pragma('foreign_keys = ON')` verified present in client.ts; deleting a platform referenced by a master_panel fails with FK violation | unit | `npx vitest run src/main/db/__tests__/client.test.ts::foreign_keys_enforced_on_deletion_of_referenced_platform` | ❌ Wave 0 |
| MPAN-02 / SC #5 (Pitfall-1 gate) | `analyteRepository.upsertByNameInMaster` called with matching `(name, platformId, speciesId)` case-insensitive UPDATES the existing row (no duplicate) and sets `master_panel_id`; returns `action: 'adopted'` when existing had `master_panel_id = NULL`, `action: 'updated'` when existing had `master_panel_id` set, `action: 'created'` when no existing row | unit | `npx vitest run src/main/db/repositories/__tests__/analyte.test.ts::upsertByNameInMaster_adopts_v1_row` | ❌ Wave 0 |
| SC #5 (master panel upsert) | `masterPanelRepository.upsertByPlatformAndSpecies` creates on miss, updates on match, returns `id` + `action` | unit | `npx vitest run src/main/db/repositories/__tests__/masterPanel.test.ts::upsert_returns_action` | ❌ Wave 0 |

### Sampling Rate
- **Per task commit:** `npx vitest run src/main/db/repositories/__tests__/` (runs all repository tests, < 5s against in-memory DB)
- **Per wave merge:** `npx vitest run` (full suite)
- **Phase gate:** Full suite green + `npm run typecheck` green before `/gsd-verify-work`

### Wave 0 Gaps
- [ ] `package.json` — add vitest to devDependencies: `npm install --save-dev vitest`
- [ ] `vitest.config.ts` — basic config: `{ test: { environment: 'node', globals: true } }`
- [ ] `src/main/db/__tests__/testDb.ts` — shared fixture: creates in-memory `better-sqlite3` Database, runs migrations from `drizzle/migrations/` folder, returns `{ sqlite, db }` for each test. Pattern:
  ```typescript
  import Database from 'better-sqlite3'
  import { drizzle } from 'drizzle-orm/better-sqlite3'
  import { migrate } from 'drizzle-orm/better-sqlite3/migrator'
  import * as schema from '../schema'
  import path from 'path'

  export function createTestDb() {
    const sqlite = new Database(':memory:')
    sqlite.pragma('foreign_keys = ON')
    const db = drizzle(sqlite, { schema })
    migrate(db, { migrationsFolder: path.join(__dirname, '../../../../drizzle/migrations') })
    return { sqlite, db }
  }
  ```
  Note: This fixture needs seed data (a platform + species row) before any master_panel test can insert. Either inline-seed in the fixture or have each test supply its own.
- [ ] `src/main/db/repositories/__tests__/masterPanel.test.ts` — covers SC #3 + SC #5 master panel path
- [ ] `src/main/db/repositories/__tests__/analyte.test.ts` — covers SC #5 Pitfall-1 adoption gate (the critical test)
- [ ] `src/main/db/__tests__/client.test.ts` — covers SC #4 PRAGMA verification + FK enforcement

**If planner defers tests:** Replace this section with a "Manual Verification" checklist under §Environment Availability §vitest fallback above.

## Sources

### Primary (HIGH confidence)
- [src/main/db/schema.ts](src/main/db/schema.ts) — existing table definitions, FK patterns, type export convention
- [src/main/db/client.ts](src/main/db/client.ts) — PRAGMA placement, drizzle init
- [src/main/db/migrate.ts](src/main/db/migrate.ts) — migration runner (unchanged by Phase 5)
- [src/main/db/repositories/analyte.ts](src/main/db/repositories/analyte.ts) — `findByNamePlatformSpecies` pattern at lines 60-74, `create()` at lines 39-58, `update()` at lines 84-97
- [src/main/db/repositories/panel.ts](src/main/db/repositories/panel.ts) — analogous `findByNamePlatformSpecies` at 52-66, `create()` at 68-85
- [drizzle/migrations/0003_damp_prima.sql](drizzle/migrations/0003_damp_prima.sql) — current FK-emission style at lines 46-49 (unchanged `ON DELETE no action`)
- [drizzle/migrations/0000_perpetual_the_initiative.sql](drizzle/migrations/0000_perpetual_the_initiative.sql), [0001_daffy_marten_broadcloak.sql](drizzle/migrations/0001_daffy_marten_broadcloak.sql) — reference for DDL formatting
- [drizzle.config.ts](drizzle.config.ts) — drizzle-kit config (schema path, output path, dialect)
- [package.json](package.json) — pinned versions: drizzle-orm 0.45.1, drizzle-kit 0.31.8, better-sqlite3 12.6.2; scripts `db:generate`, `typecheck`
- [src/main/index.ts](src/main/index.ts) — app boot order: `initializeDatabase()` → `runMigrations()` → `seedAll()` → `registerIpcHandlers()`
- [.planning/phases/05-master-panel-schema-repository-foundation/05-CONTEXT.md](.planning/phases/05-master-panel-schema-repository-foundation/05-CONTEXT.md) — all locked decisions D-01 through D-19
- [.planning/research/PITFALLS.md](.planning/research/PITFALLS.md) — Pitfalls 1 (adoption), 2 (constraint ordering), 12 (migration sequence), 13 (cascade rules), 14 (composite unique), 15 (table rename), 27 (transaction boundary)
- [src/shared/types/analyte.ts](src/shared/types/analyte.ts), [panel.ts](src/shared/types/panel.ts), [platform.ts](src/shared/types/platform.ts), [run.ts](src/shared/types/run.ts) — hand-written interface convention for shared types
- [src/main/import/importer.ts](src/main/import/importer.ts) — v1 find-or-create pattern that `upsertByNameInMaster` upgrades to adoption-upsert; also the reference for the "one `sqlite.transaction(() => { ... })` wraps all writes" pattern (lines 69-114)

### Secondary (MEDIUM confidence)
- Drizzle ORM + drizzle-kit sqlite-core API (`uniqueIndex`, `.references()`, `$inferSelect`) — confirmed against the current codebase's working use of `sqliteTable`, `text`, `real`, `integer`, `.references()`, `.notNull()`, `.unique()`. Composite-index callback form (3rd arg) not explicitly used in current schema.ts but is the documented API for this version range.

### Tertiary (LOW confidence)
- drizzle-kit issue #3411 — CONTEXT.md and PITFALLS §Pitfall 14 cite it without pinning the affected version. The mitigation (grep-verify the generated SQL) does not depend on whether the bug triggers in 0.31.8. No live verification attempted.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all versions pinned in package.json; no version speculation.
- Architecture: HIGH — every pattern is already in use somewhere in the repo.
- Pitfalls: HIGH — all cited pitfalls are in the project's own PITFALLS.md, with code-backed mitigations.
- Testing: MEDIUM — no framework installed, so the Validation Architecture is a proposal the planner locks, not a description of what exists.
- drizzle-kit composite-index emission: MEDIUM — API confirmed against docs; specific drizzle-kit 0.31.8 behavior for this pattern unverified. Grep-verify mitigates.

**Research date:** 2026-04-23
**Valid until:** 2026-05-23 (30 days — stable stack, no imminent upgrades in scope)

## RESEARCH COMPLETE
