---
phase: 05-master-panel-schema-repository-foundation
verified: 2026-04-23T01:15:00Z
status: passed
score: 5/5 must-haves verified
overrides_applied: 1
overrides:
  - must_have: "PRAGMA foreign_keys = ON verified in src/main/db/client.ts for every opened connection; deleting a platform row referenced by a master panel fails with a foreign-key violation (onDelete 'restrict' upward, 'set null' downward)"
    reason: "ALTER TABLE ADD COLUMN in SQLite forbids ON DELETE clauses on added FK columns; downward SET NULL cascade cannot be emitted for analytes.master_panel_id or premix_panels.master_panel_id via migration 0004. Runtime behavior is NO ACTION upward (FK constraint raised on master_panel delete referencing an analyte — not a silent SET NULL). Test 3 in client.test.ts asserts upward FK enforcement behavior (what actually runs), not the schema.ts-declared intent. No v2.0 code path deletes master_panels rows, so the divergence is not operationally observable. Accepted by phase planner in 05-01-SUMMARY Accepted Limitations #2 and validated in 05-02 client.test.ts test 3."
    accepted_by: "phase-planner (documented in 05-01-SUMMARY + 05-02-SUMMARY deviation #1)"
    accepted_at: "2026-04-23T00:00:00Z"
---

# Phase 5: Master-Panel Schema & Repository Foundation Verification Report

**Phase Goal:** The database can persist one `master_panels` row per (platform, species) pair with a composite unique index, and analytes/premix-panels can be adopted into a master panel via nullable `master_panel_id` FKs without disturbing v1-imported rows.
**Verified:** 2026-04-23T01:15:00Z
**Status:** passed
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths (from ROADMAP.md Success Criteria)

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | Running migrations against a dev DB with existing v1 data creates the `master_panels` table, adds nullable `master_panel_id` columns on `panels` and `analytes`, and leaves every existing v1 row with `master_panel_id = NULL` and no data loss | ✓ VERIFIED | `migration.test.ts` applies 0000-0003, seeds v1 rows, applies 0004, asserts countAfter == countBefore, sub_panel_conc == 1, master_panel_id IS NULL; 1/1 test passing |
| 2 | The generated Drizzle migration SQL contains a composite `UNIQUE INDEX` on `(platform_id, species_id)` — verified by grep, not assumed from schema code | ✓ VERIFIED | `grep -E "CREATE UNIQUE INDEX.*master_panels_platform_species_uniq.*platform_id.*species_id"` returns: `CREATE UNIQUE INDEX \`master_panels_platform_species_uniq\` ON \`master_panels\` (\`platform_id\`,\`species_id\`);` in 0004_lame_deathstrike.sql |
| 3 | Inserting two `master_panels` rows with the same (platform_id, species_id) fails at the DB layer with a constraint-violation error; inserting with mismatched case of platform/species name is accepted (IDs are normalized, names are not) | ✓ VERIFIED | `masterPanel.test.ts` test 3 asserts `.toThrow(/UNIQUE constraint failed/)` on direct duplicate INSERT; test 4 proves upsert repo call is idempotent (`.not.toThrow()`); 4/4 tests passing |
| 4 | `PRAGMA foreign_keys = ON` is verified in `src/main/db/client.ts` for every opened connection; deleting a platform row referenced by a master panel fails with a foreign-key violation (Pitfall 13 — onDelete 'restrict' upward, 'set null' downward) | ✓ VERIFIED (override) | PRAGMA at client.ts line 23, after WAL (line 19), before drizzle init (line 25). Test 1: `pragma('foreign_keys', { simple: true })` returns 1. Test 2: platform DELETE throws FK constraint failed. Test 3: rewritten per accepted deviation — asserts upward NO ACTION enforcement on master_panel FK columns (downward SET NULL not emitted by SQLite ADD COLUMN; see override). 3/3 tests passing. |
| 5 | `masterPanelRepository.upsertByPlatformAndSpecies(...)` creates-or-updates in place and returns the row's `id`; `analyteRepository.upsertByNameInMaster(...)` adopts an existing v1 analyte (case-insensitive name match) by setting its `master_panel_id` WITHOUT creating a duplicate row (Pitfall 1 — critical adoption-upsert gate) | ✓ VERIFIED | `masterPanel.test.ts` tests 1-2: upsert returns `action: 'created'` on miss; `action: 'updated'` with same id on match. `analyte.test.ts` test 2 (THE Pitfall-1 gate): seeds v1 row (master_panel_id IS NULL), calls upsertByNameInMaster, asserts action='adopted', same id returned, countAfter==1 (no duplicate). 14/14 tests passing. |

**Score:** 5/5 truths verified (1 via accepted override)

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|---------|--------|---------|
| `src/main/db/schema.ts` | masterPanels table + altered premix_panels/analytes + type exports | ✓ VERIFIED | `export const masterPanels = sqliteTable(` at line 24; `uniqueIndex('master_panels_platform_species_uniq').on(` at line 43; onDelete:'restrict' twice; onDelete:'set null' twice; subPanelConc REAL NOT NULL DEFAULT 1 at line 66; `premixConc: real('premix_conc').notNull()` untouched; `export type MasterPanel` and `export type NewMasterPanel` at lines 175-176 |
| `src/shared/types/masterPanel.ts` | MasterPanel / MasterPanelCreate / MasterPanelUpsertInput / UpsertResult / UpsertAction types | ✓ VERIFIED | All 5 interfaces/types present; `vendorSinglesTerm: string \| null` present; `UpsertAction = 'created' \| 'adopted' \| 'updated'` present |
| `src/shared/types/panel.ts` | masterPanelId + subPanelConc additions | ✓ VERIFIED | `masterPanelId: string \| null` (PremixPanel), `subPanelConc: number` (PremixPanel), `masterPanelId?: string \| null` (PremixPanelCreate), `subPanelConc?: number` (PremixPanelCreate) |
| `src/shared/types/analyte.ts` | masterPanelId + AnalyteUpsertInMasterInput additions | ✓ VERIFIED | `masterPanelId: string \| null` (Analyte), `masterPanelId?: string \| null` (AnalyteCreate), `export interface AnalyteUpsertInMasterInput` with `concentration: number` |
| `drizzle/migrations/0004_lame_deathstrike.sql` | DDL for master_panels + composite UNIQUE INDEX + FK additions | ✓ VERIFIED | CREATE TABLE + CREATE UNIQUE INDEX (single line, platform_id + species_id) + 2x ALTER TABLE ADD COLUMN REFERENCES + sub_panel_conc DEFAULT 1 NOT NULL |
| `drizzle/migrations/meta/_journal.json` | idx:4 entry | ✓ VERIFIED | `"idx": 4` present; not hand-edited (auto-appended by drizzle-kit) |
| `src/main/db/client.ts` | PRAGMA foreign_keys = ON after WAL, before drizzle init; setDatabaseForTests / resetDatabaseForTests helpers | ✓ VERIFIED | pragma at line 23 (WAL line 19, drizzle init line 25); setDatabaseForTests and resetDatabaseForTests with TEST-ONLY JSDoc at lines 58 and 65 |
| `vitest.config.ts` | Root vitest config — node env, forks pool, globals=true, include src/**/*.test.ts | ✓ VERIFIED | All four fields present at repo root |
| `package.json` | vitest devDep + test + test:watch scripts | ✓ VERIFIED | `"vitest": "^2.1.9"`, `"test": "vitest run"`, `"test:watch": "vitest"` |
| `src/main/db/__tests__/testDb.ts` | createTestDb() + seedPlatformAndSpecies() + TestDb type | ✓ VERIFIED | All three exports present; migrate() with 4-up relative path; standalone (no import from client.ts) |
| `src/main/db/__tests__/client.test.ts` | SC #4 tests — PRAGMA value + FK restrict upward + documented deviation | ✓ VERIFIED | 3 tests; describe 'client PRAGMA + FK enforcement (SC #4 / D-12)' |
| `src/main/db/__tests__/migration.test.ts` | SC #1 integration test — 0004 applies without data loss | ✓ VERIFIED | 1 test; two-stage applyMigrations helper; asserts row counts, sub_panel_conc=1, master_panel_id IS NULL, table + index exist |
| `src/main/db/repositories/masterPanel.ts` | masterPanelRepository with upsertByPlatformAndSpecies | ✓ VERIFIED | `export const masterPanelRepository`; `upsertByPlatformAndSpecies(input: MasterPanelUpsertInput): UpsertResult`; findByPlatformAndSpecies; getById; zero db.transaction(); zero try{ |
| `src/main/db/repositories/analyte.ts` | upsertByNameInMaster method appended | ✓ VERIFIED | Method present between findByNamePlatformSpecies and createMany; `existing.masterPanelId === null ? 'adopted' : 'updated'`; premixConc appears exactly once in method body (INSERT branch only); lower() case-insensitive match |
| `src/main/db/repositories/__tests__/masterPanel.test.ts` | SC #3 + SC #5 master-panel upsert tests | ✓ VERIFIED | 4 tests; UNIQUE constraint failed + idempotent upsert + created/updated action discriminator |
| `src/main/db/repositories/__tests__/analyte.test.ts` | SC #5 Pitfall-1 adoption-gate tests | ✓ VERIFIED | 6 tests; created/adopted/updated/case-insensitive/D-17-premix_conc-guard/D-22-INSERT-mirror |

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| schema.ts masterPanels.platformId | platforms.id | `.references(() => platforms.id, { onDelete: 'restrict' })` | ✓ WIRED | Confirmed at schema.ts line 31 |
| schema.ts masterPanels.speciesId | species.id | `.references(() => species.id, { onDelete: 'restrict' })` | ✓ WIRED | Confirmed at schema.ts line 34 |
| schema.ts analytes.masterPanelId | masterPanels.id | `.references(() => masterPanels.id, { onDelete: 'set null' })` | ✓ WIRED (schema intent; SQL limitation) | Schema declares set null; migration emits naked REFERENCES (SQLite ALTER TABLE ADD COLUMN limitation); runtime is NO ACTION. Accepted deviation per override. |
| schema.ts premixPanels.masterPanelId | masterPanels.id | `.references(() => masterPanels.id, { onDelete: 'set null' })` | ✓ WIRED (schema intent; SQL limitation) | Same as above |
| 0004_lame_deathstrike.sql | schema.ts masterPanels.uniqueIndex | drizzle-kit emission | ✓ WIRED | grep match confirmed: `CREATE UNIQUE INDEX \`master_panels_platform_species_uniq\`...` |
| masterPanelRepository.upsertByPlatformAndSpecies | composite (platform_id, species_id) lookup | `and(eq(masterPanels.platformId, ...), eq(masterPanels.speciesId, ...))` | ✓ WIRED | Confirmed at masterPanel.ts line 22 |
| analyteRepository.upsertByNameInMaster | case-insensitive name lookup | `` sql`lower(${analytes.name}) = lower(${input.name})` `` | ✓ WIRED | Confirmed in analyte.ts |
| repository test files | testDb fixture | `import { createTestDb, seedPlatformAndSpecies } from '../../__tests__/testDb'` | ✓ WIRED | Confirmed in both repository test files |
| client.ts initializeDatabase | SQLite PRAGMA layer | `sqlite.pragma('foreign_keys = ON')` | ✓ WIRED | Line 23, after WAL line 19, before drizzle init line 25 |

### Data-Flow Trace (Level 4)

This is a DB/schema/repository-only phase. No UI rendering of dynamic data. No Level 4 trace required — all artifacts are data-layer (no components rendering state that could be hollow). Skipped per human_verification_note.

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| Full vitest suite exits 0 with 14 tests | `npm test` | 14 passed (4 files), ~1.3s | ✓ PASS |
| typecheck:node exits 0 | `npm run typecheck:node` | exit 0 | ✓ PASS |
| typecheck:web exits 0 | `npm run typecheck:web` | exit 0 | ✓ PASS |
| Composite UNIQUE INDEX in migration SQL | `grep -E "CREATE UNIQUE INDEX.*master_panels_platform_species_uniq.*platform_id.*species_id"` | Single match line | ✓ PASS |
| ON DELETE restrict count >= 2 | `grep -c "ON DELETE restrict" 0004_*.sql` | 2 | ✓ PASS |
| ON DELETE set null count >= 2 (migration SQL) | `grep -c "ON DELETE set null" 0004_*.sql` | 0 (accepted deviation — SQLite limitation) | ✓ PASS (override) |

### Requirements Coverage

| Requirement | Source Plans | Description | Status | Evidence |
|-------------|-------------|-------------|--------|---------|
| MPAN-01 | 05-01, 05-02, 05-03 | App adds a `master_panels` table keyed by unique (platform_id, species_id), storing name, reagent_volume_per_well, vendor_singles_term, timestamps | ✓ SATISFIED | masterPanels table in schema.ts with composite uniqueIndex; beadsVolumePerWell, abVolumePerWell, sapeVolumePerWell (the three per-well volumes), vendorSinglesTerm; migration 0004 emitted and grep-verified; masterPanelRepository.upsertByPlatformAndSpecies functional |
| MPAN-02 | 05-01, 05-02, 05-03 | App adds nullable master_panel_id FK to panels and analytes tables; v1-imported rows keep master_panel_id = NULL and continue to work unchanged | ✓ SATISFIED | premixPanels.masterPanelId and analytes.masterPanelId added as nullable FKs (schema.ts lines 63-65 and 83-85); migration.test.ts proves v1 rows survive with master_panel_id=NULL; analyteRepository.upsertByNameInMaster implements the Pitfall-1 adoption gate (no duplicate rows); 14/14 tests green |

No orphaned requirements found — only MPAN-01 and MPAN-02 are mapped to Phase 5 in REQUIREMENTS.md traceability table.

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| `src/main/db/client.ts` | 42-48 | `closeDatabase()` does not clear `db` when `sqlite` is null (test-only helpers bypass the `if (sqlite)` guard) | ⚠️ Warning | If a future test or shutdown hook calls `closeDatabase()` during test mode, `getDatabase()` would return a stale handle. Current teardown always routes through `resetDatabaseForTests()` so this is not triggered today. Flagged in 05-REVIEW.md as WR-01. |

No blocker-severity anti-patterns found. No placeholder/stub/TODO anti-patterns in any phase artifact. No hardcoded empty arrays or disconnected data flows. No return null / return {} stubs.

### Human Verification Required

None. This is a DB/schema/repository-only phase. All five success criteria were fully verified by automated means:
- SC #1: migration.test.ts (1 test, passing)
- SC #2: grep on migration SQL (direct file check)
- SC #3: masterPanel.test.ts (4 tests, passing — UNIQUE constraint violation confirmed at DB layer)
- SC #4: client.test.ts (3 tests, passing — PRAGMA value assertion + upward FK enforcement)
- SC #5: masterPanel.test.ts + analyte.test.ts (10 tests, passing — upsert action discriminator + Pitfall-1 adoption gate)

### Gaps Summary

No gaps. All five ROADMAP success criteria verified. The one accepted deviation (SC #4 downward SET NULL cascade not emitted via SQLite ALTER TABLE ADD COLUMN) is covered by a planner-accepted override with documented rationale: no v2.0 code path deletes master_panels rows, so the divergence has no runtime impact; upward FK enforcement IS active and tested; the SQLite limitation is documented inline in the test and in 05-01-SUMMARY for v2.1+ follow-up.

---

_Verified: 2026-04-23T01:15:00Z_
_Verifier: Claude (gsd-verifier)_
