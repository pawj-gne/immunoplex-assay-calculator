# Phase 5: Master-Panel Schema & Repository Foundation - Pattern Map

**Mapped:** 2026-04-23
**Files analyzed:** 13 new/modified files
**Analogs found:** 9 / 13 (4 test-infrastructure files are Wave 0 — no in-repo analogs; RESEARCH.md §Wave 0 Gaps supplies the scaffold)

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| `src/main/db/schema.ts` (MODIFY) | schema | table-DDL | self — existing `premixPanels` block (lines 22-34) + type export tail (128-150) | exact (same file, add sibling table + ALTER sibling columns) |
| `drizzle/migrations/0004_*.sql` (CREATE via drizzle-kit) | migration | DDL | `drizzle/migrations/0003_damp_prima.sql` | exact (same generator, same emission style) |
| `drizzle/migrations/meta/_journal.json` (AUTO-UPDATE) | migration-metadata | append-entry | existing entries idx 0-3 | exact (drizzle-kit appends, do NOT hand-edit) |
| `src/main/db/client.ts` (MODIFY +1 line) | connection | pragma | self — existing `sqlite.pragma('journal_mode = WAL')` at line 19 | exact |
| `src/main/db/repositories/masterPanel.ts` (CREATE) | repository | CRUD + upsert | `src/main/db/repositories/analyte.ts` + `panel.ts` (fuse `create` + `findBy...` + `update`) | role-match, composite pattern |
| `src/main/db/repositories/analyte.ts` (MODIFY — add method) | repository | upsert | self — existing `findByNamePlatformSpecies` (60-74), `create` (39-58), `update` (84-97) | exact (same file, new method reusing three local patterns) |
| `src/shared/types/masterPanel.ts` (CREATE) | shared-type | interface | `src/shared/types/panel.ts` | exact (hand-written interface convention) |
| `src/shared/types/panel.ts` (MODIFY) | shared-type | interface | self | exact (add two fields) |
| `src/shared/types/analyte.ts` (MODIFY) | shared-type | interface | self | exact (add one field + new upsert input types) |
| `package.json` (MODIFY — add devDep + script) | config | build-config | self — existing `devDependencies` block + `scripts` block | exact (add vitest + test script) |
| `vitest.config.ts` (CREATE) | test-config | test-runner-config | `drizzle.config.ts` (root-level `satisfies Config` pattern) | role-match (sibling root config file) |
| `src/main/db/__tests__/testDb.ts` (CREATE) | test-fixture | in-memory-db | **NO ANALOG** — first test fixture in repo; RESEARCH.md §Wave 0 Gaps supplies the scaffold | no analog |
| `src/main/db/__tests__/client.test.ts` (CREATE) | test-case | unit | **NO ANALOG** — first project test | no analog |
| `src/main/db/__tests__/migration.test.ts` (CREATE) | test-case | integration | **NO ANALOG** | no analog |
| `src/main/db/repositories/__tests__/masterPanel.test.ts` (CREATE) | test-case | unit | **NO ANALOG** | no analog |
| `src/main/db/repositories/__tests__/analyte.test.ts` (CREATE — Pitfall-1 gate) | test-case | unit | **NO ANALOG** | no analog |

---

## Pattern Assignments

### `src/main/db/schema.ts` — MODIFY (add `masterPanels` + alter siblings + types)

**Analog (same file):** existing `premixPanels` definition and type-export tail.

**Imports pattern** (existing at line 1 — must ADD `uniqueIndex` to this import):
```typescript
// CURRENT (schema.ts:1):
import { sqliteTable, text, real, integer } from 'drizzle-orm/sqlite-core'

// NEW (Phase 5):
import { sqliteTable, text, real, integer, uniqueIndex } from 'drizzle-orm/sqlite-core'
```

**Single-column FK pattern** (existing at schema.ts:15-17, `species.platformId`):
```typescript
platformId: text('platform_id')
  .notNull()
  .references(() => platforms.id),
```
**Phase 5 new FKs MUST differ** — add the options object per D-15/Pitfall 13:
```typescript
// master_panels → platforms (upward, strict)
platformId: text('platform_id')
  .notNull()
  .references(() => platforms.id, { onDelete: 'restrict' }),

// analytes.master_panel_id and premix_panels.master_panel_id (downward, nullable)
masterPanelId: text('master_panel_id')
  .references(() => masterPanels.id, { onDelete: 'set null' }),
  // ^ NO .notNull() → nullable TEXT, auto-NULL on pre-existing rows
```

**Table definition pattern** (existing `premixPanels` at schema.ts:22-34 — mirror shape, add 3rd-arg callback for composite unique):
```typescript
// Existing (schema.ts:22-34) — 2-arg sqliteTable
export const premixPanels = sqliteTable('premix_panels', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  description: text('description'),
  platformId: text('platform_id')
    .notNull()
    .references(() => platforms.id),
  speciesId: text('species_id')
    .notNull()
    .references(() => species.id),
  createdAt: text('created_at').notNull(),
  updatedAt: text('updated_at').notNull()
})
```

**Phase 5 `masterPanels` extends this with a 3rd-arg callback** (RESEARCH.md §Pattern 1; place block between `species` export and `premixPanels` export):
```typescript
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
    vendorSinglesTerm: text('vendor_singles_term'),   // nullable by omission
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

**Add block comment documenting master-vs-premix distinction** (D-14; place immediately above the `premixPanels` export):
```typescript
// NOTE: `premixPanels` is the v1 premix-table — NOT the master panel.
// v2.0 introduces `masterPanels` (above) as the (platform, species) anchor; `premixPanels.masterPanelId`
// is a nullable FK back up. Do NOT rename `premix_panels` → `panels` (PITFALLS §Pitfall 15).
```

**Alter `premixPanels` — add two columns inline** (D-10, D-21; in-place edit of schema.ts:22-34):
```typescript
export const premixPanels = sqliteTable('premix_panels', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  description: text('description'),
  platformId: text('platform_id')
    .notNull()
    .references(() => platforms.id),
  speciesId: text('species_id')
    .notNull()
    .references(() => species.id),
  // NEW (Phase 5 D-10):
  masterPanelId: text('master_panel_id')
    .references(() => masterPanels.id, { onDelete: 'set null' }),
  // NEW (Phase 5 D-10 / D-21): default 1 so pre-existing rows materialize as "regular premix"
  subPanelConc: real('sub_panel_conc').notNull().default(1),
  createdAt: text('created_at').notNull(),
  updatedAt: text('updated_at').notNull()
})
```

**Alter `analytes` — add one column** (D-11; in-place edit of schema.ts:36-50):
```typescript
export const analytes = sqliteTable('analytes', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  beadRegion: integer('bead_region').notNull(),
  premixConc: real('premix_conc').notNull(),       // ← dead in v2.0 per D-04, leave untouched
  singleConc: real('single_conc').notNull(),
  platformId: text('platform_id')
    .notNull()
    .references(() => platforms.id),
  speciesId: text('species_id')
    .notNull()
    .references(() => species.id),
  // NEW (Phase 5 D-11):
  masterPanelId: text('master_panel_id')
    .references(() => masterPanels.id, { onDelete: 'set null' }),
  createdAt: text('created_at').notNull(),
  updatedAt: text('updated_at').notNull()
})
```

**Type exports pattern** (existing at schema.ts:128-150; append new pair matching the style):
```typescript
// Existing (schema.ts:134-135):
export type PremixPanel = typeof premixPanels.$inferSelect
export type NewPremixPanel = typeof premixPanels.$inferInsert

// NEW — append to bottom of schema.ts (after line 150):
export type MasterPanel = typeof masterPanels.$inferSelect
export type NewMasterPanel = typeof masterPanels.$inferInsert
```

---

### `drizzle/migrations/0004_*.sql` — CREATE via `drizzle-kit generate`

**Analog:** `drizzle/migrations/0003_damp_prima.sql` (current FK-emission style, lines 46-49).

**Do NOT hand-edit.** Generated via `npm run db:generate`.

**Existing style to mirror** (0003_damp_prima.sql:46-49):
```sql
FOREIGN KEY (`operator_id`) REFERENCES `operators`(`id`) ON UPDATE no action ON DELETE no action,
FOREIGN KEY (`platform_id`) REFERENCES `platforms`(`id`) ON UPDATE no action ON DELETE no action,
FOREIGN KEY (`species_id`) REFERENCES `species`(`id`) ON UPDATE no action ON DELETE no action,
FOREIGN KEY (`panel_id`) REFERENCES `premix_panels`(`id`) ON UPDATE no action ON DELETE no action
```

**Phase 5 emission MUST differ on the NEW FKs** (onDelete explicit per D-09/D-10/D-11):
```sql
FOREIGN KEY (`platform_id`) REFERENCES `platforms`(`id`) ON UPDATE no action ON DELETE restrict,
FOREIGN KEY (`species_id`) REFERENCES `species`(`id`) ON UPDATE no action ON DELETE restrict,
-- On `analytes` and `premix_panels`:
FOREIGN KEY (`master_panel_id`) REFERENCES `master_panels`(`id`) ON UPDATE no action ON DELETE set null
```

**Post-generation grep-verify** (Pitfall 1 / drizzle-kit #3411):
```bash
# Composite unique index — MUST match exactly once:
grep -E "CREATE UNIQUE INDEX.*master_panels_platform_species_uniq.*platform_id.*species_id" \
  drizzle/migrations/0004_*.sql

# Cascade rules — expect 2 restrict + 2 set null:
grep -E "ON DELETE (restrict|set null)" drizzle/migrations/0004_*.sql
```

**Commit alongside schema change:**
```bash
git add src/main/db/schema.ts drizzle/migrations/0004_*.sql drizzle/migrations/meta/_journal.json
```

---

### `drizzle/migrations/meta/_journal.json` — AUTO-UPDATE

**Do NOT hand-edit.** drizzle-kit appends an `idx: 4, tag: "0004_<adjective>_<noun>"` entry.

**Analog (existing structure):**
```json
{
  "idx": 3,
  "version": "6",
  "when": 1776917303834,
  "tag": "0003_damp_prima",
  "breakpoints": true
}
```

**CLAUDE.md decision-log note:** Migration 0003 kept its auto-generated name to avoid hand-editing `_journal.json`. Phase 5 follows the same rule.

---

### `src/main/db/client.ts` — MODIFY (+1 line)

**Analog (same file):** existing `journal_mode = WAL` pragma at line 19.

**Current code** (client.ts:16-21):
```typescript
sqlite = new Database(dbPath)

// Enable WAL mode for concurrent read/write performance
sqlite.pragma('journal_mode = WAL')

db = drizzle(sqlite, { schema })
```

**Phase 5 edit** (D-12; one line inserted between `WAL` and the `drizzle(...)` call):
```typescript
sqlite = new Database(dbPath)

// Enable WAL mode for concurrent read/write performance
sqlite.pragma('journal_mode = WAL')

// Enable FK constraint enforcement per-connection (D-12, PITFALLS §Pitfall 13).
// SQLite default is OFF; must be called on every open Database instance.
sqlite.pragma('foreign_keys = ON')

db = drizzle(sqlite, { schema })
```

**No other changes to this file.**

---

### `src/main/db/repositories/masterPanel.ts` — CREATE

**Analog:** `src/main/db/repositories/analyte.ts` (fuse `create` at 39-58 + `findByNamePlatformSpecies` at 60-74 + `update` at 84-97 into one `upsert` method).

**Imports pattern** (mirror analyte.ts:1-4):
```typescript
// analyte.ts:1-4 — existing style:
import { eq, and, sql } from 'drizzle-orm'
import { getDatabase } from '../client'
import { analytes, panelAnalytes } from '../schema'
import type { Analyte, AnalyteCreate } from '../../../shared/types/analyte'
```

**Phase 5 `masterPanel.ts` imports** (same pattern, different tables/types; `sql` tag not needed — no case-insensitive name match in this file):
```typescript
import { eq, and } from 'drizzle-orm'
import { getDatabase } from '../client'
import { masterPanels } from '../schema'
import type {
  MasterPanel,
  MasterPanelUpsertInput,
  UpsertResult
} from '../../../shared/types/masterPanel'
```

**Repository-object shape** (mirror analyte.ts:6 — `export const xRepository = { ... }`):
```typescript
// analyte.ts:6
export const analyteRepository = {
  getByPlatformAndSpecies(...) { ... },
  getById(...) { ... },
  create(...) { ... },
  findByNamePlatformSpecies(...) { ... },
  ...
}
```

**`findBy` composite pattern** (mirror analyte.ts:60-74 structure but WITHOUT `lower()` — platform/species IDs are already normalized UUIDs per CONTEXT.md D-16):
```typescript
// PATTERN SOURCE — analyte.ts:60-74:
findByNamePlatformSpecies(name, platformId, speciesId): Analyte | null {
  const db = getDatabase()
  const result = db
    .select()
    .from(analytes)
    .where(
      and(
        sql`lower(${analytes.name}) = lower(${name})`,
        eq(analytes.platformId, platformId),
        eq(analytes.speciesId, speciesId)
      )
    )
    .get()
  return result ?? null
}
```

**`create` pattern** (mirror analyte.ts:39-58 — `crypto.randomUUID()` + `new Date().toISOString()` + inline `db.insert().values().run()`):
```typescript
// PATTERN SOURCE — analyte.ts:39-58:
create(data: AnalyteCreate): Analyte {
  const db = getDatabase()
  const now = new Date().toISOString()
  const id = crypto.randomUUID()

  const analyte: Analyte = {
    id,
    name: data.name,
    beadRegion: data.beadRegion,
    premixConc: data.premixConc,
    singleConc: data.singleConc,
    platformId: data.platformId,
    speciesId: data.speciesId,
    createdAt: now,
    updatedAt: now
  }

  db.insert(analytes).values(analyte).run()
  return analyte
}
```

**`update` pattern** (mirror analyte.ts:84-97 — `db.update().set({...data, updatedAt: now}).where(eq(id)).run()`):
```typescript
// PATTERN SOURCE — analyte.ts:84-97:
update(id, data): Analyte {
  const db = getDatabase()
  const now = new Date().toISOString()
  db.update(analytes)
    .set({ ...data, updatedAt: now })
    .where(eq(analytes.id, id))
    .run()
  const updated = analyteRepository.getById(id)
  if (!updated) throw new Error(`Analyte not found: ${id}`)
  return updated
}
```

**Phase 5 `upsertByPlatformAndSpecies`** (fuse all three patterns above; RESEARCH.md §Pattern 4):
```typescript
upsertByPlatformAndSpecies(input: MasterPanelUpsertInput): UpsertResult {
  const db = getDatabase()
  const now = new Date().toISOString()

  // findBy pattern — IDs are already normalized, no lower() needed
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
    // update pattern — all fields except id and created_at
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

  // create pattern — new UUID, both timestamps = now
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
```

**Error handling pattern** (none — synchronous, throws `better-sqlite3`'s native error on constraint violation; repositories do not try/catch per D-18). Matches analyte.ts (no try/catch anywhere).

**DO NOT open a transaction** (D-18; transaction ownership belongs to Phase 7 importer).

---

### `src/main/db/repositories/analyte.ts` — MODIFY (add `upsertByNameInMaster`)

**Analog (same file):** existing `findByNamePlatformSpecies` (60-74) + `create` (39-58) + `update` (84-97).

**Case-insensitive name match pattern** (VERBATIM reuse of analyte.ts:60-74, lines 67-69 in particular):
```typescript
// SOURCE — analyte.ts:60-74 (the critical Pitfall-1 adoption-gate lookup):
findByNamePlatformSpecies(name: string, platformId: string, speciesId: string): Analyte | null {
  const db = getDatabase()
  const result = db
    .select()
    .from(analytes)
    .where(
      and(
        sql`lower(${analytes.name}) = lower(${name})`,   // ← REUSE VERBATIM
        eq(analytes.platformId, platformId),
        eq(analytes.speciesId, speciesId)
      )
    )
    .get()
  return result ?? null
}
```

**Phase 5 `upsertByNameInMaster` — append as new method on the repository object** (D-17, RESEARCH.md §Pattern 4 critical Pitfall-1 gate):
```typescript
upsertByNameInMaster(input: {
  name: string
  platformId: string
  speciesId: string
  masterPanelId: string
  beadRegion: number
  concentration: number  // → single_conc per D-04 / D-22
}): { id: string; action: 'created' | 'adopted' | 'updated' } {
  const db = getDatabase()
  const now = new Date().toISOString()

  // VERBATIM reuse of findByNamePlatformSpecies lookup (analyte.ts:60-74)
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
    // Pitfall-1 gate: null master_panel_id → 'adopted'; non-null → 'updated'
    const action: 'adopted' | 'updated' =
      existing.masterPanelId === null ? 'adopted' : 'updated'

    db.update(analytes)
      .set({
        beadRegion: input.beadRegion,
        singleConc: input.concentration,
        masterPanelId: input.masterPanelId,
        updatedAt: now
        // NOTE: premix_conc is NEVER touched on UPDATE (D-17, D-22).
        // NOTE: name is NOT touched — existing row's casing wins (idempotent re-import).
      })
      .where(eq(analytes.id, existing.id))
      .run()
    return { id: existing.id, action }
  }

  // INSERT path — both premix_conc (legacy NOT NULL) and single_conc get input.concentration (D-22 lock)
  const id = crypto.randomUUID()
  db.insert(analytes)
    .values({
      id,
      name: input.name,
      beadRegion: input.beadRegion,
      premixConc: input.concentration,   // D-22: mirror into legacy column on INSERT only
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

**Placement:** Insert this method between existing `findByNamePlatformSpecies` (line 74) and `createMany` (line 76), keeping the methods logically grouped.

---

### `src/shared/types/masterPanel.ts` — CREATE

**Analog:** `src/shared/types/panel.ts` (hand-written interface pattern — NOT `$inferSelect` re-export).

**Source pattern** (panel.ts:1-28 in its entirety):
```typescript
import type { Analyte } from './analyte'

export interface PremixPanel {
  id: string
  name: string
  description: string | null
  platformId: string
  speciesId: string
  createdAt: string
  updatedAt: string
}

export interface PremixPanelCreate {
  name: string
  description?: string | null
  platformId: string
  speciesId: string
}

export interface PremixPanelUpdate {
  id: string
  name?: string
  description?: string | null
}

export interface PanelWithAnalytes extends PremixPanel {
  analytes: Analyte[]
}
```

**Phase 5 `masterPanel.ts` content** (mirror shape; no `*Update` or `*WithChildren` needed in Phase 5):
```typescript
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

// Phase 7 importer calls masterPanelRepository.upsertByPlatformAndSpecies(input)
export interface MasterPanelUpsertInput extends MasterPanelCreate {}

// Shared with analyte upsert — three-way discriminator (Phase 7 banner consumer)
export type UpsertAction = 'created' | 'adopted' | 'updated'

export interface UpsertResult {
  id: string
  action: UpsertAction
}
```

---

### `src/shared/types/panel.ts` — MODIFY (add 2 fields)

**Analog (same file):** existing `PremixPanel` and `PremixPanelCreate` at lines 3-18.

**Phase 5 edit** (append two fields on both interfaces; D-10, D-21):
```typescript
// MODIFY panel.ts:3-11 — add masterPanelId + subPanelConc:
export interface PremixPanel {
  id: string
  name: string
  description: string | null
  platformId: string
  speciesId: string
  masterPanelId: string | null     // NEW (Phase 5 D-10); NULL for pre-existing rows
  subPanelConc: number             // NEW (Phase 5 D-10 / D-21); 1 for regular, 20 for JAMMate
  createdAt: string
  updatedAt: string
}

// MODIFY panel.ts:13-18 — add optional masterPanelId + subPanelConc on Create:
export interface PremixPanelCreate {
  name: string
  description?: string | null
  platformId: string
  speciesId: string
  masterPanelId?: string | null    // NEW; Phase 7 importer sets it, v1 callers can omit
  subPanelConc?: number            // NEW; DB default is 1 if omitted
}
```

**Do NOT modify** `PremixPanelUpdate` or `PanelWithAnalytes` in Phase 5 (Phase 7 concern).

---

### `src/shared/types/analyte.ts` — MODIFY (add 1 field + 1 new type)

**Analog (same file):** existing `Analyte` and `AnalyteCreate` at lines 1-28.

**Phase 5 edit** (D-11, D-17):
```typescript
// MODIFY analyte.ts:1-11 — add masterPanelId:
export interface Analyte {
  id: string
  name: string
  beadRegion: number
  premixConc: number
  singleConc: number
  platformId: string
  speciesId: string
  masterPanelId: string | null     // NEW (Phase 5 D-11)
  createdAt: string
  updatedAt: string
}

// MODIFY analyte.ts:13-20 — add optional masterPanelId:
export interface AnalyteCreate {
  name: string
  beadRegion: number
  premixConc: number
  singleConc: number
  platformId: string
  speciesId: string
  masterPanelId?: string | null    // NEW; optional — only upsertByNameInMaster sets it
}

// NEW — append to the bottom of the file (input shape for upsertByNameInMaster, D-17):
export interface AnalyteUpsertInMasterInput {
  name: string
  platformId: string
  speciesId: string
  masterPanelId: string
  beadRegion: number
  concentration: number            // → single_conc (D-04)
}
```

**Do NOT modify** `AnalyteUpdate`.

---

### `package.json` — MODIFY (add vitest devDep + `test` script)

**Analog (same file):** existing `devDependencies` block (lines 37-58) + `scripts` block (lines 7-24).

**`scripts` pattern** (package.json:7-24 — 2-space indent, alphabetical-ish within sections):
```json
"scripts": {
  "format": "prettier --write .",
  "lint": "eslint . --ext .js,.jsx,.cjs,.mjs,.ts,.tsx,.cts,.mts --fix",
  "typecheck:node": "tsc --noEmit -p tsconfig.node.json --composite false",
  "typecheck:web": "tsc --noEmit -p tsconfig.web.json --composite false",
  "typecheck": "npm run typecheck:node && npm run typecheck:web",
  "start": "electron-vite preview",
  "dev": "electron-vite dev",
  ...
}
```

**Phase 5 additions** (D-20):
```json
// In "scripts" block — add:
"test": "vitest run",
"test:watch": "vitest",

// In "devDependencies" block — add alphabetically near `vite`:
"vitest": "^2.1.9",
```

**Exact version is planner discretion; use `^2.x` stable.** No other devDeps needed (node environment, no DOM, no @vitest/ui required for Phase 5).

---

### `vitest.config.ts` — CREATE

**Analog:** `drizzle.config.ts` (root-level `satisfies Config` pattern).

**Source pattern** (drizzle.config.ts:1-7):
```typescript
import type { Config } from 'drizzle-kit'

export default {
  schema: './src/main/db/schema.ts',
  out: './drizzle/migrations',
  dialect: 'sqlite'
} satisfies Config
```

**Phase 5 `vitest.config.ts`** (RESEARCH.md §Wave 0 Gaps — minimal node config):
```typescript
import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    environment: 'node',
    globals: true,
    include: ['src/**/*.test.ts'],
    // Better-sqlite3 is native; ensure per-test isolation for in-memory DBs
    pool: 'forks'
  }
})
```

---

### `src/main/db/__tests__/testDb.ts` — CREATE (test fixture)

**No in-repo analog** — first project test fixture.

**Pattern source:** RESEARCH.md §Wave 0 Gaps (lines 816-831); mirrors `src/main/db/client.ts` initialization shape (in-memory variant).

**Reused primitives:**
- `new Database(':memory:')` — mirrors client.ts:16 (`new Database(dbPath)` variant)
- `sqlite.pragma('foreign_keys = ON')` — mirrors the client.ts:20 line Phase 5 is adding (D-12)
- `drizzle(sqlite, { schema })` — identical to client.ts:21
- `migrate(db, { migrationsFolder })` — identical to migrate.ts:16

**Implementation:**
```typescript
// src/main/db/__tests__/testDb.ts
import Database from 'better-sqlite3'
import { drizzle } from 'drizzle-orm/better-sqlite3'
import { migrate } from 'drizzle-orm/better-sqlite3/migrator'
import path from 'path'
import * as schema from '../schema'

export type TestDb = {
  sqlite: Database.Database
  db: ReturnType<typeof drizzle<typeof schema>>
}

export function createTestDb(): TestDb {
  const sqlite = new Database(':memory:')
  sqlite.pragma('foreign_keys = ON')
  const db = drizzle(sqlite, { schema })
  migrate(db, {
    migrationsFolder: path.join(__dirname, '../../../../drizzle/migrations')
  })
  return { sqlite, db }
}

// Minimal seed helper — platform + species row so master_panel insert tests have FK parents
export function seedPlatformAndSpecies(
  sqlite: Database.Database
): { platformId: string; speciesId: string } {
  const platformId = crypto.randomUUID()
  const speciesId = crypto.randomUUID()
  const now = new Date().toISOString()

  sqlite
    .prepare(
      `INSERT INTO platforms (id, name, description, stock_concentration, created_at, updated_at)
       VALUES (?, 'TestPlatform', NULL, 100, ?, ?)`
    )
    .run(platformId, now, now)
  sqlite
    .prepare(
      `INSERT INTO species (id, name, platform_id, created_at, updated_at)
       VALUES (?, 'TestSpecies', ?, ?, ?)`
    )
    .run(speciesId, platformId, now, now)

  return { platformId, speciesId }
}
```

---

### `src/main/db/__tests__/client.test.ts` — CREATE (SC #4 PRAGMA + FK)

**No in-repo analog.** Pattern source: vitest basic test shape + RESEARCH.md §Phase Requirements → Test Map.

**Implementation shape:**
```typescript
import { describe, it, expect } from 'vitest'
import { createTestDb, seedPlatformAndSpecies } from './testDb'

describe('client PRAGMA + FK enforcement', () => {
  it('has foreign_keys = ON after createTestDb()', () => {
    const { sqlite } = createTestDb()
    const result = sqlite.pragma('foreign_keys', { simple: true })
    expect(result).toBe(1)   // better-sqlite3 returns 1/0 (not true/false)
  })

  it('rejects DELETE of a platform referenced by a master_panel (onDelete: restrict)', () => {
    const { sqlite } = createTestDb()
    const { platformId, speciesId } = seedPlatformAndSpecies(sqlite)
    const now = new Date().toISOString()
    sqlite
      .prepare(
        `INSERT INTO master_panels
         (id, name, platform_id, species_id, beads_volume_per_well, ab_volume_per_well, sape_volume_per_well, vendor_singles_term, created_at, updated_at)
         VALUES (?, 'P1', ?, ?, 25, 25, 25, NULL, ?, ?)`
      )
      .run(crypto.randomUUID(), platformId, speciesId, now, now)

    expect(() =>
      sqlite.prepare(`DELETE FROM platforms WHERE id = ?`).run(platformId)
    ).toThrow(/FOREIGN KEY constraint failed/)
  })

  it('nulls analytes.master_panel_id when its master_panel is deleted (onDelete: set null)', () => {
    // Insert platform + species + master_panel + analyte, delete master, assert analyte.master_panel_id IS NULL
    // (shape per RESEARCH.md §Environment Availability vitest fallback step 8)
  })
})
```

---

### `src/main/db/__tests__/migration.test.ts` — CREATE (SC #1)

**No in-repo analog.** Purpose: prove 0004 applies against an "as-of-v1" DB dump without data loss.

**Implementation shape:**
```typescript
import { describe, it, expect } from 'vitest'
import Database from 'better-sqlite3'
import { drizzle } from 'drizzle-orm/better-sqlite3'
import { migrate } from 'drizzle-orm/better-sqlite3/migrator'
import path from 'path'
import * as schema from '../schema'

describe('migration 0004 applies to v1 dev DB without data loss', () => {
  it('preserves existing premix_panels and analytes rows; new columns default correctly', () => {
    // 1. Open in-memory DB
    // 2. Apply only migrations 0000-0003 (simulate v1 state)
    // 3. Insert a dummy premix_panel + analyte row
    // 4. Apply migration 0004
    // 5. SELECT the rows: sub_panel_conc === 1 (default), master_panel_id === null
    // 6. Assert master_panels table exists with the composite unique index
  })
})
```

---

### `src/main/db/repositories/__tests__/masterPanel.test.ts` — CREATE (SC #3, SC #5)

**No in-repo analog.**

**Implementation shape (covers composite-UNIQUE + upsert action discriminator):**
```typescript
import { describe, it, expect, beforeEach } from 'vitest'
import { createTestDb, seedPlatformAndSpecies } from '../../__tests__/testDb'
import { masterPanelRepository } from '../masterPanel'
// NOTE: repositories read the singleton getDatabase(); tests must initialize it.
// Option: export a test-only setDatabase() helper from client.ts, OR refactor
// repositories to accept an injected db. Planner decision (Wave 0 scope).

describe('masterPanelRepository.upsertByPlatformAndSpecies', () => {
  it('returns action: "created" on miss', () => { /* ... */ })
  it('returns action: "updated" on composite match', () => { /* ... */ })
  it('updates all fields except id and created_at on match', () => { /* ... */ })
})

describe('master_panels composite unique index (SC #3)', () => {
  it('rejects a second row with identical (platform_id, species_id)', () => {
    // Direct INSERT via sqlite.prepare — expect UNIQUE constraint failed
  })
})
```

---

### `src/main/db/repositories/__tests__/analyte.test.ts` — CREATE (SC #5 Pitfall-1 gate)

**No in-repo analog. This is the critical Pitfall-1 adoption-gate test.**

**Implementation shape (covers the three-way discriminator):**
```typescript
describe('analyteRepository.upsertByNameInMaster (Pitfall-1 adoption gate)', () => {
  it('action: "created" when no existing row matches (name, platform, species)', () => { /* ... */ })

  it('action: "adopted" when existing row matches AND master_panel_id IS NULL', () => {
    // v1 row exists (from seed). upsertByNameInMaster sets master_panel_id.
    // Expect: NO new row created, master_panel_id now set, action === 'adopted'.
    // This IS the Pitfall-1 critical gate.
  })

  it('action: "updated" when existing row matches AND master_panel_id IS NOT NULL', () => { /* ... */ })

  it('case-insensitive match: "IL-6" and "il-6" collapse to one row', () => { /* ... */ })

  it('UPDATE path never touches premix_conc (D-17)', () => {
    // Insert an analyte with premix_conc = 99. Call upsertByNameInMaster.
    // Expect: premix_conc still 99 post-call.
  })

  it('INSERT path writes premix_conc = input.concentration (D-22)', () => { /* ... */ })
})
```

---

## Shared Patterns

### UUID + timestamp generation
**Sources:**
- `src/main/db/repositories/analyte.ts:41-42` (`now = new Date().toISOString(); id = crypto.randomUUID()`)
- `src/main/db/repositories/panel.ts:70-71` (same pattern)

**Apply to:** Every INSERT in `masterPanelRepository.upsertByPlatformAndSpecies` and `analyteRepository.upsertByNameInMaster`.

```typescript
const now = new Date().toISOString()
const id = crypto.randomUUID()
```

### Drizzle composed `where` clause
**Sources:**
- `src/main/db/repositories/analyte.ts:12` (`and(eq(...), eq(...))` two-column)
- `src/main/db/repositories/analyte.ts:66-70` (`and(sql\`lower(col) = lower(?)\`, eq(...), eq(...))` three-condition)

**Apply to:** `masterPanelRepository.upsertByPlatformAndSpecies` uses the two-column form; `analyteRepository.upsertByNameInMaster` uses the three-condition form (with `sql` tag).

### Case-insensitive name match
**Source:** `src/main/db/repositories/analyte.ts:67` — `sql\`lower(${analytes.name}) = lower(${name})\``
Also at `src/main/db/repositories/panel.ts:59` — same pattern on `premixPanels.name`.

**Apply to:** `analyteRepository.upsertByNameInMaster` only. DO NOT apply to `masterPanelRepository.upsertByPlatformAndSpecies` — IDs are normalized (D-16).

### Repository = no transaction, no Zod, no try/catch
**Source:** All existing repositories — `analyte.ts`, `panel.ts`, `platform.ts`, `species.ts`, `operator.ts`, `run.ts` — none open transactions, none import `zod`, none wrap calls in `try/catch` (let better-sqlite3 throw on constraint violation).

**Apply to:** Both Phase 5 repositories. Phase 7 importer owns transaction scope (D-18).

### Drizzle `$inferSelect` / `$inferInsert` type export (bottom of schema.ts)
**Source:** `src/main/db/schema.ts:128-150` — each table gets a `{Table}` / `New{Table}` pair.

**Apply to:** `masterPanels` gets a `MasterPanel` / `NewMasterPanel` pair appended to the type-export tail.

### Hand-written shared-type interface (NOT `$inferSelect` re-export)
**Source:** `src/shared/types/panel.ts`, `analyte.ts`, `platform.ts`, etc. — every shared type is hand-written, NOT re-exported from schema.ts.

**Apply to:** `src/shared/types/masterPanel.ts`. **Rationale (per Pitfall 5):** schema-ts-derived types would leak `$inferSelect` nullability differences into the UI layer; hand-written forces an intentional review on every schema change.

### Drizzle-kit generate → grep-verify → commit (migration workflow)
**Source:** CLAUDE.md decision-log note ("kept drizzle-kit auto-generated name to avoid hand-editing _journal.json"), RESEARCH.md §Code Examples §drizzle-kit migration generation.

**Apply to:** The Phase 5 migration-creation step.

```bash
npm run db:generate                                                # emit 0004_*.sql
ls -lt drizzle/migrations/0004_*.sql                               # confirm generated
grep -E "CREATE UNIQUE INDEX.*master_panels_platform_species_uniq.*platform_id.*species_id" \
  drizzle/migrations/0004_*.sql                                    # Pitfall 1 / SC #2
grep -E "ON DELETE (restrict|set null)" drizzle/migrations/0004_*.sql    # 2 restrict + 2 set null
git add src/main/db/schema.ts drizzle/migrations/0004_*.sql drizzle/migrations/meta/_journal.json
```

---

## No Analog Found

Files with no close match in the codebase (planner uses RESEARCH.md §Wave 0 Gaps + §Validation Architecture verbatim):

| File | Role | Data Flow | Reason |
|------|------|-----------|--------|
| `vitest.config.ts` | test-config | test-runner-config | First vitest usage in repo (node_modules/zod has tests but those are vendored). Root-level config style mirrors drizzle.config.ts. |
| `src/main/db/__tests__/testDb.ts` | test-fixture | in-memory-db | First test fixture in repo. Scaffold comes from RESEARCH.md §Wave 0 Gaps. |
| `src/main/db/__tests__/client.test.ts` | test-case | unit | First project test. Shape from RESEARCH.md §Phase Requirements → Test Map. |
| `src/main/db/__tests__/migration.test.ts` | test-case | integration | First project test. Shape from RESEARCH.md §Phase Requirements → Test Map. |
| `src/main/db/repositories/__tests__/masterPanel.test.ts` | test-case | unit | First project test. |
| `src/main/db/repositories/__tests__/analyte.test.ts` | test-case | unit | First project test; covers the critical Pitfall-1 adoption gate. |

**Note on composite `uniqueIndex(...).on(col1, col2)`:** The Drizzle 3-arg callback form is NOT used anywhere in the current schema.ts — existing uniqueness lives on single columns via `.unique()` (e.g. `operators.name` at schema.ts:66). Phase 5 introduces the first use. Grep-verify the generated SQL (Pitfall 1) compensates for this lack of in-repo precedent.

**Note on `relations()` declarations (Claude's Discretion per CONTEXT.md):** No `relations()` calls exist in the current schema.ts — Phase 5 can either introduce them (minor convenience for future query-builder use) or skip them (consistent with current style). Recommendation: skip. No existing code calls `db.query.X.findMany({ with: ... })`, so adding relations is unused scaffolding. Phase 5 schema uses plain `.select().from().where()` everywhere, which needs no `relations()` declarations.

---

## Metadata

**Analog search scope:**
- `src/main/db/` (schema, client, migrate, repositories/)
- `src/shared/types/`
- `drizzle/migrations/` (0000 through 0003 + meta/_journal.json)
- Root configs (`drizzle.config.ts`, `package.json`)

**Files scanned:** 18 (4 migrations + 4 db-layer + 6 repositories + 1 shared-types subset + 2 configs + CONTEXT + RESEARCH)

**Pattern extraction date:** 2026-04-23

**Confidence:** HIGH on all patterns with in-repo analogs (9 files). MEDIUM on the 6 test-infrastructure files where the scaffold comes from RESEARCH.md rather than from working in-repo code.

## PATTERN MAPPING COMPLETE
