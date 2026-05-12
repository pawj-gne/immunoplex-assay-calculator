# Phase 13: Smoke 3 — Panel XLSX Parser v3 - Pattern Map

**Mapped:** 2026-05-12
**Files analyzed:** 22 (10 NEW, 4 REWRITTEN, 6 MODIFIED, 2 DELETED)
**Analogs found:** 20 / 20 in-scope (DELETED files need no analog)

## File Classification

| New/Modified File | Status | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|--------|------|-----------|----------------|---------------|
| `src/main/import/parser.ts` | REWRITE | parser (main-process util) | file-I/O → transform | self (`src/main/import/parser.ts` v0.7.0) | exact role; data-flow generalizes single-sheet → multi-sheet |
| `src/main/import/validator.ts` | REWRITE | validator (pure function) | transform → aggregate-errors | self (`src/main/import/validator.ts` v0.7.0) | exact |
| `src/main/import/importer.ts` | REWRITE | service orchestrator | request-response (IPC) → transactional CRUD | self (`src/main/import/importer.ts` v0.7.0) | exact |
| `src/main/import/normalize.ts` | NEW | utility (pure functions) | transform (string → string) | inline helpers in `src/main/import/parser.ts` (e.g. `findRowAbove`) | partial — extract pure helpers into own module |
| `src/main/import/blockParser.ts` | NEW (optional helper) | utility (pure functions) | transform (rows[] → block-typed) | inline helpers in `src/main/import/parser.ts` lines 33-149 | role-match |
| `src/main/import/__tests__/parser.test.ts` | REWRITE | unit test | fixture-load + assertion | self (lines 1-38) | exact |
| `src/main/import/__tests__/normalize.test.ts` | NEW | unit test (pure) | input/output table | `src/main/db/repositories/__tests__/analyte.test.ts` (describe/it/expect with no DB) | partial — pure-function tests don't need testDb |
| `src/main/import/__tests__/validator.test.ts` | NEW | unit test (pure) | input/output table | `src/main/import/__tests__/parser.test.ts` v0.7.0 shape | partial |
| `src/main/import/__tests__/importer.test.ts` | NEW | integration test (in-memory DB + transaction) | repository + transaction | `src/main/db/repositories/__tests__/analyte.test.ts` + `src/main/__tests__/expressServer.test.ts` | role-match (DB + transaction wrapping) |
| `src/main/import/__tests__/allPanelsFixture.test.ts` | NEW | integration test (load .xlsx fixture) | fixture-load + DB | `src/main/db/__tests__/migration.test.ts` (loads fs artifacts) + parser test pattern | partial |
| `src/main/db/repositories/masterPanelReagent.ts` | NEW | repository | CRUD | `src/main/db/repositories/masterPanel.ts` (Phase 5) | exact role + data flow |
| `src/main/db/repositories/__tests__/masterPanelReagent.test.ts` | NEW | repository test | CRUD + constraint enforcement | `src/main/db/repositories/__tests__/masterPanel.test.ts` | exact |
| `src/shared/types/masterPanelReagent.ts` | NEW | type module | (none — declarations only) | `src/shared/types/masterPanel.ts` + `src/shared/types/analyte.ts` | exact |
| `scripts/build-panels-fixture.ts` | NEW | standalone Node script | file-I/O (CSV → XLSX) | NONE in repo — closest pattern is xlsx read in `src/main/import/parser.ts:26-28` (READ); inverted for WRITE |
| `drizzle/migrations/0007_<auto>.sql` | NEW | DDL migration | DDL | `drizzle/migrations/0004_lame_deathstrike.sql` (add table + alter + add UNIQUE index) | exact |
| `src/main/db/schema.ts` | MODIFY | schema definition | DDL (TS) | self (lines 22-48 `masterPanels`) | self-extend |
| `src/main/db/repositories/masterPanel.ts` | MODIFY | repository | CRUD | self (lines 10-83) | self-extend |
| `src/main/db/repositories/panel.ts` | MODIFY | repository | CRUD | self (`src/main/db/repositories/panel.ts` lines 68-95, 118-122) | self-extend |
| `src/main/db/repositories/analyte.ts` | MODIFY | repository | CRUD | self (`src/main/db/repositories/analyte.ts` lines 176-181 `delete()`) | self-extend |
| `src/main/db/__tests__/migration.test.ts` | MODIFY | migration test | DDL assertions | self (lines 121-218 — already asserts schema artifacts for migration 0005) | exact |
| `src/renderer/src/features/import/ImportButton.tsx` | MODIFY | React component | request-response (IPC) → state | self (lines 1-130) | self-extend |
| `package.json` | MODIFY | config | (none) | self | self-extend |
| `templates/panel-template.csv` | DELETE | fixture | — | (no analog needed) | — |
| `templates/sample-panel-import.csv` | DELETE | fixture | — | (no analog needed) | — |

---

## Pattern Assignments — Feature Area: Import

### `src/main/import/parser.ts` (parser, file-I/O → transform) — REWRITE

**Analog:** `src/main/import/parser.ts` (v0.7.0, 161 lines) — same file, generalized for multi-sheet + marker-driven block scan.

**XLSX read pattern** (existing lines 1, 25-28 — replicate, but extend with hardened options per RESEARCH "xlsx Library Specifics"):
```typescript
import * as XLSX from 'xlsx'

export function parseImportFile(filePath: string): ParsedPanel {
  const workbook = XLSX.readFile(filePath)
  const sheet = workbook.Sheets[workbook.SheetNames[0]]
  const rows = XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1, blankrows: false }) as unknown[][]

  return parseLabFormat(rows)
}
```
→ Phase 13 changes: enumerate `workbook.SheetNames`, skip case-insensitive `'Table'`, push `XLSX.readFile(filePath, { cellFormula: false, cellDates: false })` (Pitfalls 10 + Pitfall A) and add `defval: null` to `sheet_to_json` options.

**Cell-access helper pattern** (existing line 34 — keep verbatim, extend with `cellNumber` / `cellNumberOrVariable`):
```typescript
const cell = (r: number, c: number): string => String(rows[r]?.[c] ?? '').trim()
```

**Header-scan pattern** (existing lines 54-65 — apply same approach but with section markers `Criteria` / `Values` / `Category` in col A, plus `Premix Name` / `Premix Concentration` / `Analyte`+`Bead Region`+`Concentration` in Category block per RESEARCH §parseCategory):
```typescript
let analyteHeaderRow = -1
for (let i = 0; i < rows.length; i++) {
  if (cell(i, 0).toLowerCase() === 'target' && cell(i, 1).toLowerCase() === 'bead region') {
    analyteHeaderRow = i
    break
  }
}
if (analyteHeaderRow === -1) {
  throw new ParseError('Could not find analyte header row...')
}
```

**Walk-rows-until-blank pattern** (existing lines 102-126 — preserve idiom; col A blank stops the walk, see Pitfall 8):
```typescript
for (let r = analyteHeaderRow + 1; r < rows.length; r++) {
  const name = cell(r, 0)
  if (!name) continue
  // collect typed values; reject NaN / duplicate-name
}
```

**ParseError pattern** (existing line 23 — extend to include optional `sheetName` for multi-sheet error attribution):
```typescript
export class ParseError extends Error {}
// Phase 13: extend with sheetName arg per RESEARCH lines 280-285
```

**Interface naming convention** (existing lines 3-21): `ParsedAnalyte`, `ParsedSubPanel`, `ParsedPanel`. Phase 13 adds `ParsedReagent`, renames `ParsedSubPanel` → `ParsedPremix`, extends `ParsedPanel` with `sheetName`, `panelNameRaw`, `panelNameNormalized`, `panelDescription`, `sapeName`, `reagents`.

---

### `src/main/import/validator.ts` (validator, transform → aggregate-errors) — REWRITE

**Analog:** `src/main/import/validator.ts` (v0.7.0, 69 lines) — keep the platform/species lookup loop + premix-member case-insensitive set check; ADD cross-sheet duplicate-normalize pass for D-21.

**Error-aggregation pattern** (existing lines 20-57 — preserve the `errors: string[]` accumulator with `if (errors.length > 0) return { resolved: null, errors }`):
```typescript
const errors: string[] = []
const platform = platforms.find((p) => p.name.toLowerCase() === parsed.platform.toLowerCase())
if (!platform) {
  const valid = platforms.map((p) => p.name).join(', ')
  errors.push(`Unknown platform "${parsed.platform}". Valid platforms: ${valid}`)
}
// ... more validations push to errors[]
if (errors.length > 0 || !platform || !matchedSpecies) {
  return { resolved: null, errors }
}
return { resolved: { ... }, errors: [] }
```
→ Phase 13 extends to multi-sheet: takes `ParsedPanel[]`, returns `ResolvedPanel[] | null` per RESEARCH §Validator Algorithm. Error shape upgrades to `{ sheetName: string; message: string }[]` per RESEARCH lines 583-591.

**Case-insensitive premix-member set lookup** (existing lines 44-53 — VERBATIM reuse, only renaming `sub_panels` → `premixes`):
```typescript
const masterNamesLC = new Set(parsed.analytes.map((a) => a.name.toLowerCase()))
for (const sp of parsed.sub_panels) {
  for (const name of sp.analyte_names) {
    if (!masterNamesLC.has(name.toLowerCase())) {
      errors.push(`Sub-panel "${sp.name}" references analyte "${name}" that does not appear in the master analyte list`)
    }
  }
}
```

**New D-21 cross-sheet pass** (no analog; pattern is a second sweep over already-resolved panels with `Map<triple, sheetName>`; see RESEARCH lines 641-653).

---

### `src/main/import/importer.ts` (orchestrator + transaction boundary) — REWRITE

**Analog:** `src/main/import/importer.ts` (v0.7.0, 142 lines) — same orchestration shape; wholesale-replace replaces upsert-by-name; full transaction wrapping unchanged.

**Module imports + entry shape** (existing lines 1-16 — preserve the `ImportResult` discriminated-union return + early-fail pattern):
```typescript
import { parseImportFile, ParseError } from './parser'
import { validateAndResolve } from './validator'
import { getDatabase, getSqlite } from '../db/client'
import { platforms, species } from '../db/schema'
import { analyteRepository } from '../db/repositories/analyte'
import { panelRepository } from '../db/repositories/panel'

export interface ImportResult { /* success/canceled/created/errors */ }

export function importPanelData(filePath: string): ImportResult {
  let parsed
  try { parsed = parseImportFile(filePath) } catch (err) {
    const message = err instanceof ParseError ? err.message : err instanceof Error ? err.message : 'Failed to parse file'
    return failure(message)
  }
  // ...
}
```
→ Phase 13 adds `masterPanelRepository`, `masterPanelReagentRepository`; rewrites `ImportResult` to carry `summaries: PanelSummary[]` + `errors: { sheetName: string; issues: string[] }[]` per RESEARCH Recommendation 6.

**Platform/species pre-load pattern** (existing lines 27-29 — VERBATIM reuse):
```typescript
const db = getDatabase()
const allPlatforms = db.select().from(platforms).all().map((p) => ({ id: p.id, name: p.name }))
const allSpecies = db.select().from(species).all().map((s) => ({ id: s.id, name: s.name, platformId: s.platformId }))
```

**Transactional IIFE pattern** (existing lines 48-120 — THE critical pattern to replicate; see Pitfall 27. ALL DB writes for the entire file wrap inside ONE `sqlite.transaction(() => {...})()` call):
```typescript
const sqlite = getSqlite()
sqlite.transaction(() => {
  // 3a. Create or find the master panel
  let masterPanel = panelRepository.findByNamePlatformSpecies(
    resolved.panel_name,
    resolved.platformId,
    resolved.speciesId
  )
  if (!masterPanel) {
    masterPanel = panelRepository.create({ ... })
    createdPanels++
  }
  // 3b. Create or find each master analyte; link to master panel
  // 3c. Create sub-panels and link their analytes
})()
```
→ Phase 13's transaction body wholesale-DELETEs old children then INSERTs fresh per `ResolvedPanel` (loop over all parsed panels inside one transaction; see RESEARCH §Importer Transaction Architecture lines 708-781).

**Repository wholesale-replace inside transaction** (no v0.7.0 analog — new pattern per RESEARCH lines 711-779):
```typescript
const existing = masterPanelRepository.findByPlatformSpeciesName(r.platformId, r.speciesId, r.panelNameNormalized)
if (existing) {
  analyteRepository.deleteByMasterPanelId(existing.id)
  panelRepository.deleteByMasterPanelId(existing.id)
  masterPanelReagentRepository.deleteByMasterPanelId(existing.id) // cascade is automatic; explicit for clarity
  masterPanelRepository.updateMetadata(existing.id, { ... })
} else {
  masterPanelRepository.createWithMetadata({ ... })
}
// then INSERT fresh: reagents, analytes, premixes, panel_analytes links
```

**Failure-return helper pattern** (existing lines 135-142 — keep):
```typescript
function failure(message: string): ImportResult {
  return {
    success: false,
    created: { ... },
    skipped: { analytes: 0 },
    errors: [{ row: 0, issues: [message] }]
  }
}
```

---

### `src/main/import/normalize.ts` (utility, transform) — NEW

**Analog:** No dedicated `normalize.ts` exists. The closest pattern is the inline `findRowAbove(rows, belowRow, predicate)` helper in `parser.ts:152-161` — pure function, exported alongside parser. Phase 13 extracts pure helpers into their own module.

**Imports pattern** (none needed — pure module):
```typescript
// src/main/import/normalize.ts
// no Drizzle / sqlite / electron imports — pure string transforms
```

**Pure-helper export pattern** (mirrors `findRowAbove` style — top-level `function`, plus a typed `Record` lookup table):
```typescript
const ROMAN_TO_ARABIC: Record<string, number> = {
  I: 1, II: 2, III: 3, IV: 4, V: 5, VI: 6, VII: 7, VIII: 8, IX: 9, X: 10
}
const PANEL_NAME_REGEX = /^Panel\s+([IVX]+|\d+)$/i

export function normalizePanelName(raw: string, sheetName: string): string { /* per RESEARCH lines 1211-1233 */ }
export function canonReagentKind(raw: string): ReagentKind | null { /* per RESEARCH lines 1242-1248 */ }
export function isSapeNameLabel(raw: string): boolean { /* per RESEARCH lines 1250-1252 */ }
```

**Error-throw pattern** — reuse the `ParseError` class from `parser.ts:23` (import it) rather than introducing a new error type. Mirrors how the v0.7.0 `findRowAbove` shares its parent's error idiom.

---

### `src/main/import/blockParser.ts` (utility, optional helper) — NEW

**Analog:** `src/main/import/parser.ts` lines 33-149 — the inline `parseLabFormat` function. Phase 13 splits into `parseCriteria` / `parseValues` / `parseCategory` pure functions.

**Function signature shape** (per RESEARCH §Pattern 2 line 332):
```typescript
export function parseCriteria(sheetName: string, rows: unknown[][], startRow: number, endRow: number): CriteriaResult { ... }
export function parseValues(sheetName: string, rows: unknown[][], startRow: number, endRow: number): ParsedReagent[] { ... }
export function parseCategory(sheetName: string, rows: unknown[][], startRow: number): { analytes: ParsedAnalyte[]; premixes: ParsedPremix[] } { ... }
```

**Shared `cell`/`cellNumber` accessor pattern** (existing line 34 — replicate as a local helper inside the module, OR export from normalize.ts for reuse). Pure functions; throw `ParseError`; do not mutate inputs.

---

### `src/main/import/__tests__/parser.test.ts` (unit test) — REWRITE

**Analog:** self (lines 1-38) — preserves the `describe('parseImportFile (...)', ...)` + `it('parses ... correctly', ...)` shell.

**Existing test shell** (lines 1-8 — REPLACE the deleted-CSV path with the generated all-panels.xlsx OR with inline AoA fixtures via `XLSX.utils.aoa_to_sheet`):
```typescript
import { describe, it, expect } from 'vitest'
import * as path from 'path'
import { parseImportFile } from '../parser'

describe('parseImportFile (lab panel format)', () => {
  it('parses panel-template.csv correctly', () => {
    const templatePath = path.resolve(__dirname, '../../../../templates/panel-template.csv')
    const parsed = parseImportFile(templatePath)
    // ...
  })
})
```
→ Phase 13: REPLACE with multiple `describe` blocks (`parseCriteria`, `parseValues`, `parseCategory`, `parseSheet integration`); per-test inline AoA fixtures using `XLSX.utils.aoa_to_sheet` + `XLSX.utils.book_new` to avoid fs dependency on the (yet-to-be-generated) `all-panels.xlsx`.

**Deep-equality assertion pattern** (existing lines 14-37 — keep this style for the `allPanelsFixture.test.ts` gold-file checks; Recommendation A in RESEARCH §Per-fixture deep-equality strategy):
```typescript
expect(parsed.analytes).toHaveLength(5)
expect(parsed.analytes[0]).toEqual({ name: 'Analyte 1', bead_region: 12, single_conc: 20 })
const premix = parsed.sub_panels.find((sp) => sp.name === 'Premix Example 5-plex')
expect(premix?.sub_panel_conc).toBe(1)
expect(premix?.analyte_names).toEqual([ 'Analyte 1', 'Analyte 2', 'Analyte 3', 'Analyte 4', 'Analyte 5' ])
```

---

### `src/main/import/__tests__/normalize.test.ts` (pure unit test) — NEW

**Analog:** `src/main/import/__tests__/parser.test.ts` v0.7.0 shape — pure-function tests need no DB setup, no `beforeEach`, no `createTestDb()`.

**Test structure** (mirrors v0.7.0 parser.test.ts; one `describe` per pure function, table-driven `it` cases):
```typescript
import { describe, it, expect } from 'vitest'
import { normalizePanelName, canonReagentKind } from '../normalize'

describe('normalizePanelName', () => {
  it('Roman I..X maps to Arabic 1..10', () => {
    expect(normalizePanelName('Panel I', 'sheet')).toBe('Panel 1')
    expect(normalizePanelName('Panel VII', 'sheet')).toBe('Panel 7')
  })
  it('Arabic 1..N passes through', () => {
    expect(normalizePanelName('Panel 1', 'sheet')).toBe('Panel 1')
  })
  it('out-of-range Roman throws ParseError with D-20 message', () => {
    expect(() => normalizePanelName('Panel XI', 'sheet')).toThrow(/I through X/)
  })
})
```

---

### `src/main/import/__tests__/validator.test.ts` (pure unit test) — NEW

**Analog:** `src/main/import/__tests__/parser.test.ts` v0.7.0 (lines 1-38) for the bare shell, PLUS the inline-fixture style used in `migration.test.ts:42-71` for constructing `ParsedPanel[]` test inputs.

**Test structure** (pure function; no DB; build `ParsedPanel[]` literals + platforms/species mock arrays, call `validateAndResolve`, assert on `{ resolved, errors }`):
```typescript
import { describe, it, expect } from 'vitest'
import { validateAndResolve } from '../validator'

describe('validateAndResolve (multi-sheet)', () => {
  const platforms = [{ id: 'plat-1', name: 'Millipore' }]
  const speciesList = [{ id: 'spec-1', name: 'Human', platformId: 'plat-1' }]

  it('aggregates errors across multiple sheets before returning', () => {
    const parsed = [/* parsedPanel-A with bad platform */, /* parsedPanel-B with bad premix member */]
    const result = validateAndResolve(parsed, platforms, speciesList)
    expect(result.resolved).toBeNull()
    expect(result.errors).toHaveLength(2)
  })

  it('D-21: rejects whole file when two sheets normalize to same (platform, species, name)', () => {
    // ...
  })
})
```

---

### `src/main/import/__tests__/importer.test.ts` (integration test) — NEW

**Analog:** `src/main/db/repositories/__tests__/analyte.test.ts` (lines 1-39 for test-DB setup; lines 63-104 for the wholesale-replace + DB-state assertion pattern) PLUS `src/main/__tests__/expressServer.test.ts:24-25` for the `setSqliteForTests` (required when the importer uses `getSqlite().transaction(...)`).

**Test-DB setup pattern** (analyte.test.ts:14-39 — VERBATIM reuse, except ALSO call `setSqliteForTests`):
```typescript
import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { createTestDb, seedPlatformAndSpecies } from '../../db/__tests__/testDb'
import { setDatabaseForTests, setSqliteForTests, resetDatabaseForTests } from '../../db/client'
import { importPanelData } from '../importer'

describe('importPanelData (wholesale-replace transaction)', () => {
  let sqlite: ReturnType<typeof createTestDb>['sqlite']
  let platformId: string
  let speciesId: string

  beforeEach(() => {
    const testDb = createTestDb()
    sqlite = testDb.sqlite
    setDatabaseForTests(testDb.db)
    setSqliteForTests(testDb.sqlite)   // importer uses getSqlite().transaction()
    const ids = seedPlatformAndSpecies(sqlite)
    platformId = ids.platformId
    speciesId = ids.speciesId
  })

  afterEach(() => {
    resetDatabaseForTests()
    sqlite.close()
  })

  // tests here ...
})
```

**Direct-INSERT seed pattern + assertion pattern** (analyte.test.ts:65-104 — seed v1 row with raw `sqlite.prepare(...).run(...)` then assert post-state via raw SELECT):
```typescript
const v1AnalyteId = crypto.randomUUID()
const now = new Date().toISOString()
sqlite
  .prepare(
    `INSERT INTO analytes (id, name, bead_region, premix_conc, single_conc, platform_id, species_id, master_panel_id, created_at, updated_at)
     VALUES (?, 'IL-6', 12, 99, 99, ?, ?, NULL, ?, ?)`
  )
  .run(v1AnalyteId, platformId, speciesId, now, now)

// ... run wholesale-replace ...

const countAfter = (sqlite.prepare('SELECT COUNT(*) AS c FROM analytes').get() as { c: number }).c
expect(countAfter).toBe(1)
```

**Fixture-file generation pattern for parser-input** (no v0.7.0 analog — Phase 13 importer-test seeds via raw INSERTs and then exercises `importPanelData(filePath)` against an .xlsx written at test-time via `XLSX.utils.aoa_to_sheet` + `XLSX.writeFile` to a tmp path, OR by stubbing parser.parseImportFile in module-mock fashion).

---

### `src/main/import/__tests__/allPanelsFixture.test.ts` (integration test, SC #6 gate) — NEW

**Analog:** `src/main/db/__tests__/migration.test.ts:1-31` for the fs-based fixture-load pattern + `src/main/import/__tests__/parser.test.ts:6-8` for the `path.resolve(__dirname, '../../../../templates/panels/all-panels.xlsx')` pattern.

**File-path pattern** (parser.test.ts:7 — verbatim, swap filename):
```typescript
import * as path from 'path'
const fixturePath = path.resolve(__dirname, '../../../../templates/panels/all-panels.xlsx')
```

**Migration-test fs-load pattern** (migration.test.ts:7, 21-22 — applies to reading the fixture file deterministically):
```typescript
const fixtureDir = path.join(__dirname, '../../../../templates/panels')
// ... read file ...
```

**17/17 count + per-vendor spot-check assertion pattern** (Recommendation A from RESEARCH §Per-fixture deep-equality strategy):
```typescript
import { describe, it, expect } from 'vitest'
import { parseWorkbook } from '../parser'

describe('SC #6: all 17 fixture panels parse', () => {
  const panels = parseWorkbook(fixturePath)
  it('parses 17 panels (Table sheet skipped)', () => {
    expect(panels).toHaveLength(17)
  })
  it('Millipore Human Panel I normalizes to Panel 1', () => {
    const p = panels.find((p) => p.sheetName === 'Millipore Human Panel I')
    expect(p?.panelNameNormalized).toBe('Panel 1')
  })
  // ... 17 spot-checks + 1 deep-equality on smallest fixture (Thermofisher Human Panel I)
})
```

---

## Pattern Assignments — Feature Area: DB

### `src/main/db/repositories/masterPanelReagent.ts` (repository, CRUD) — NEW

**Analog:** `src/main/db/repositories/masterPanel.ts` (Phase 5, 83 lines).

**Imports pattern** (masterPanel.ts:1-8 — VERBATIM shape, swap table name + types):
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
→ Phase 13: swap `masterPanels` → `masterPanelReagents`; types from `../../../shared/types/masterPanelReagent`.

**Repository object pattern** (masterPanel.ts:10 — single exported const object with method properties):
```typescript
export const masterPanelRepository = {
  findByPlatformAndSpecies(platformId, speciesId): MasterPanel | null { ... },
  upsertByPlatformAndSpecies(input: MasterPanelUpsertInput): UpsertResult { ... },
  getById(id: string): MasterPanel | null { ... }
}
```
→ Phase 13: `export const masterPanelReagentRepository = { create, deleteByMasterPanelId, findByMasterPanelId, getById }`.

**Drizzle select pattern** (masterPanel.ts:16-26):
```typescript
findByPlatformAndSpecies(platformId: string, speciesId: string): MasterPanel | null {
  const db = getDatabase()
  const result = db
    .select()
    .from(masterPanels)
    .where(and(eq(masterPanels.platformId, platformId), eq(masterPanels.speciesId, speciesId)))
    .get()
  return (result as MasterPanel | undefined) ?? null
}
```

**Drizzle insert pattern + `crypto.randomUUID()` + ISO timestamp pair** (masterPanel.ts:60-75 — VERBATIM shape):
```typescript
const id = crypto.randomUUID()
const now = new Date().toISOString()
db.insert(masterPanels)
  .values({
    id,
    name: input.name,
    /* ...fields... */,
    createdAt: now,
    updatedAt: now
  })
  .run()
return { id, action: 'created' }
```

**Drizzle delete pattern** (analyte.ts:177-180 — for the new `deleteByMasterPanelId` method):
```typescript
deleteByMasterPanelId(masterPanelId: string): number {
  const db = getDatabase()
  const result = db.delete(masterPanelReagents).where(eq(masterPanelReagents.masterPanelId, masterPanelId)).run()
  return result.changes
}
```

**No-transaction-inside-repo convention** (masterPanel.ts:32-34 doc comment — "Does NOT open a transaction — Phase 7 importer owns transaction scope (D-18)"). Carry forward this convention; the importer wraps everything.

---

### `src/main/db/repositories/__tests__/masterPanelReagent.test.ts` (repository test) — NEW

**Analog:** `src/main/db/repositories/__tests__/masterPanel.test.ts` (Phase 5, 141 lines).

**Test-DB setup + teardown pattern** (masterPanel.test.ts:9-26 — VERBATIM shape):
```typescript
import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { createTestDb, seedPlatformAndSpecies } from '../../__tests__/testDb'
import { setDatabaseForTests, resetDatabaseForTests } from '../../client'
import { masterPanelRepository } from '../masterPanel'

describe('masterPanelRepository.upsertByPlatformAndSpecies ...', () => {
  let sqlite: ReturnType<typeof createTestDb>['sqlite']
  let platformId: string
  let speciesId: string

  beforeEach(() => {
    const testDb = createTestDb()
    sqlite = testDb.sqlite
    setDatabaseForTests(testDb.db)
    const ids = seedPlatformAndSpecies(sqlite)
    platformId = ids.platformId
    speciesId = ids.speciesId
  })

  afterEach(() => {
    resetDatabaseForTests()
    sqlite.close()
  })
  // ...
})
```

**UNIQUE constraint enforcement test pattern** (masterPanel.test.ts:97-115 — direct sqlite.prepare INSERT × 2 with `toThrow(/UNIQUE constraint failed/)`):
```typescript
sqlite.prepare(`INSERT INTO master_panels (id, name, ...) VALUES (?, 'First', ...)`)
  .run(crypto.randomUUID(), platformId, speciesId, now, now)

expect(() =>
  sqlite.prepare(`INSERT INTO master_panels (id, name, ...) VALUES (?, 'Duplicate', ...)`)
    .run(crypto.randomUUID(), platformId, speciesId, now, now)
).toThrow(/UNIQUE constraint failed/)
```
→ Phase 13 uses this pattern for the composite `(master_panel_id, reagent_kind)` UNIQUE; ALSO uses it for the CHECK constraint with `toThrow(/CHECK constraint failed/)`.

---

### `src/shared/types/masterPanelReagent.ts` (type module) — NEW

**Analog:** `src/shared/types/masterPanel.ts` (33 lines) + `src/shared/types/analyte.ts` (40 lines).

**Interface declaration pattern** (masterPanel.ts:1-12 — VERBATIM shape):
```typescript
export interface MasterPanel {
  id: string
  name: string
  platformId: string
  speciesId: string
  beadsVolumePerWell: number
  // ...
  createdAt: string
  updatedAt: string
}
```
→ Phase 13:
```typescript
export type ReagentKind = 'beads' | 'antibodies' | 'sape'

export interface MasterPanelReagent {
  id: string
  masterPanelId: string
  reagentKind: ReagentKind
  concentration: number | null   // NULL for 'variable' on beads/antibodies (D-07)
  diluent: string | null
  volumePerWell: number
  createdAt: string
  updatedAt: string
}

export interface MasterPanelReagentCreate {
  masterPanelId: string
  reagentKind: ReagentKind
  concentration: number | null
  diluent: string | null
  volumePerWell: number
}
```

**Naming convention** (analyte.ts:14-22 — `<Name>` for SELECT shape, `<Name>Create` for INSERT input). Use camelCase TS field names (DB is snake_case; Drizzle does the mapping per schema.ts).

---

### `src/main/db/repositories/masterPanel.ts` — EXTEND

**Analog:** self (Phase 5 file).

**Add methods (no new patterns; replicate existing repo style):**

`findByPlatformSpeciesName(platformId, speciesId, normalizedName): MasterPanel | null` — pattern is identical to existing `findByPlatformAndSpecies` (lines 16-26) but add a third `eq` clause inside the `and(...)`:
```typescript
.where(and(
  eq(masterPanels.platformId, platformId),
  eq(masterPanels.speciesId, speciesId),
  eq(masterPanels.name, normalizedName)
))
```

`createWithMetadata(input)` — pattern is identical to the INSERT branch of `upsertByPlatformAndSpecies` (lines 60-75). Replace the `beadsVolumePerWell` / `abVolumePerWell` / `sapeVolumePerWell` fields with `description` + `sapeName` (the dropped columns are gone post-migration).

`updateMetadata(id, input): void` — pattern is identical to the UPDATE branch of `upsertByPlatformAndSpecies` (lines 46-56). Updates only `name`, `description`, `sapeName`, `updatedAt`.

`deleteCascadeMasterPanelChildren(id)` — Phase 13 may compose this from the other repos' deleteByMasterPanelId methods (called from the importer's transaction body) rather than implementing inside masterPanelRepository. See OQ in RESEARCH §wholesaleReplace API.

---

### `src/main/db/repositories/panel.ts` — EXTEND

**Analog:** self (Phase 5 file).

**Add methods:**

`deleteByMasterPanelId(masterPanelId): number` — pattern per RESEARCH lines 1326-1345 (select premix ids, bulk-delete panel_analytes for each, then bulk-delete premix_panels). Mirrors existing `delete(id)` (lines 118-122) which already does the junction-then-table sequence.

`setMasterPanelId(panelId, masterPanelId): void` — pattern per RESEARCH lines 1346-1352 (simple `db.update().set({ masterPanelId, updatedAt }).where(eq(premixPanels.id, panelId)).run()`). Mirrors existing `update(id, data)` (lines 106-116) which uses the same shape.

Alternatively per RESEARCH OQ-1: extend `create(data)` to accept `masterPanelId?: string | null` — change one line in existing lines 80-91 (`masterPanelId: data.masterPanelId ?? null`). Defer to planner's choice.

---

### `src/main/db/repositories/analyte.ts` — EXTEND

**Analog:** self (Phase 5 file).

**Add method:**

`deleteByMasterPanelId(masterPanelId): number` — pattern per RESEARCH lines 1313-1321:
```typescript
deleteByMasterPanelId(masterPanelId: string): number {
  const db = getDatabase()
  const result = db.delete(analytes).where(eq(analytes.masterPanelId, masterPanelId)).run()
  return result.changes
}
```
Mirrors existing `delete(id)` (lines 176-180). The hard-delete of analyte rows in turn fires `run_single_analytes.analyte_id` FK SET NULL (post-migration 0007), so no manual junction cleanup needed.

---

### `src/main/db/__tests__/migration.test.ts` — EXTEND

**Analog:** self.

**Schema-artifact assertion patterns** (lines 121-167 — `describe('migration 0005 — ...')` block):

**PRAGMA table_info introspection** (lines 130-137 — verbatim reuse for `master_panel_reagents` table column check):
```typescript
const cols = sqlite.prepare("PRAGMA table_info('offline_queue')").all() as Array<{ name: string }>
const colNames = cols.map((c) => c.name)
expect(colNames).toContain('id')
expect(colNames).toContain('run_id')
```
→ Phase 13: assert `master_panel_reagents` columns `id`, `master_panel_id`, `reagent_kind`, `concentration`, `diluent`, `volume_per_well`, `created_at`, `updated_at` exist; assert `master_panels.beads_volume_per_well` does NOT exist; assert `master_panels.sape_name` + `master_panels.description` exist.

**sqlite_master table-existence pattern** (lines 122-128 — verbatim reuse):
```typescript
const tableInfo = sqlite
  .prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='offline_queue'")
  .get()
expect(tableInfo).toBeDefined()
```

**sqlite_master index-existence pattern** (lines 112-117 from the migration-0004 block):
```typescript
const indexes = sqlite
  .prepare("SELECT name FROM sqlite_master WHERE type='index' AND name='master_panels_platform_species_uniq'")
  .all()
expect(indexes.length).toBe(1)
```
→ Phase 13: assert `master_panels_platform_species_name_uniq` exists AND `master_panels_platform_species_uniq` does NOT exist (D-14 swap).

**Forward-migration test pattern** (lines 33-118 — stage-1 seed pre-migration, apply migration, assert post-state). Used to verify that pre-existing v1 rows survive the schema delta — Phase 13 should add a similar block that seeds runs + analytes with `master_panel_id IS NULL`, runs migration 0007, and asserts row counts unchanged. PLUS verify Pitfall F: row counts preserved through the SQLite FK-change recreate-table dance.

**FK SET NULL assertion pattern** (no v0.7.0 analog — new pattern): assert via `sqlite.prepare("SELECT sql FROM sqlite_master WHERE name = 'runs'").get()` and string-match `ON DELETE SET NULL`.

---

### `drizzle/migrations/0007_<auto>.sql` (DDL migration) — NEW (generated)

**Analog:** `drizzle/migrations/0004_lame_deathstrike.sql` (18 lines — CREATE TABLE master_panels + CREATE UNIQUE INDEX + 3× ALTER TABLE ADD COLUMN).

**SQL structure pattern** (0004_lame_deathstrike.sql:1-19 — VERBATIM shape):
```sql
CREATE TABLE `master_panels` (
    `id` text PRIMARY KEY NOT NULL,
    `name` text NOT NULL,
    `platform_id` text NOT NULL,
    /* ... */,
    `created_at` text NOT NULL,
    `updated_at` text NOT NULL,
    FOREIGN KEY (`platform_id`) REFERENCES `platforms`(`id`) ON UPDATE no action ON DELETE restrict,
    FOREIGN KEY (`species_id`) REFERENCES `species`(`id`) ON UPDATE no action ON DELETE restrict
);
--> statement-breakpoint
CREATE UNIQUE INDEX `master_panels_platform_species_uniq` ON `master_panels` (`platform_id`,`species_id`);--> statement-breakpoint
ALTER TABLE `analytes` ADD `master_panel_id` text REFERENCES master_panels(id);--> statement-breakpoint
ALTER TABLE `premix_panels` ADD `master_panel_id` text REFERENCES master_panels(id);--> statement-breakpoint
ALTER TABLE `premix_panels` ADD `sub_panel_conc` real DEFAULT 1 NOT NULL;
```
→ Phase 13: drizzle-kit auto-generates; expected order in RESEARCH §Migration content lines 800-849. Statement-breakpoint separator pattern (`--> statement-breakpoint`) is required for migration.test.ts parsing (testDb.ts:14-31).

**DO NOT hand-edit generated file** — let drizzle-kit emit; only inspect for correctness per Pitfall F (FK recreate-table dance for `runs` and `run_single_analytes`).

---

## Pattern Assignments — Feature Area: UI

### `src/renderer/src/features/import/ImportButton.tsx` — EXTEND

**Analog:** self (130 lines).

**Component-state + IPC-call pattern** (lines 17-71 — keep verbatim shell; ONLY change the `ImportResult` shape + banner rendering):
```typescript
const [loading, setLoading] = useState(false)
const [banner, setBanner] = useState<BannerState | null>(null)

// Auto-dismiss success banners after 10s
useEffect(() => {
  if (banner?.type !== 'success') return undefined
  const timer = setTimeout(() => setBanner(null), 10000)
  return () => clearTimeout(timer)
}, [banner])

const handleImport = useCallback(async () => {
  setLoading(true)
  setBanner(null)
  try {
    const result: ImportResult = await window.electronAPI.import.panelData()
    if (result.canceled) return
    if (result.success) {
      // ...build msg...
      setBanner({ type: 'success', message: msg })
    } else {
      const details = result.errors.flatMap((e) => e.issues.map((issue) => /*...*/))
      setBanner({ type: 'error', message: '...', details })
    }
  } catch (err) {
    setBanner({ type: 'error', message: err instanceof Error ? err.message : 'Unknown' })
  } finally {
    setLoading(false)
  }
}, [])
```
→ Phase 13: `ImportResult` shape changes to `{ success, canceled?, summaries: PanelSummary[], errors: { sheetName, issues }[] }` per RESEARCH Recommendation 6 lines 1044-1063. Banner rendering loops over `summaries` for success and groups errors by `sheetName` for failure. The existing `BannerState` discriminated union stays; `details: string[]` is the right shape for the multi-line per-sheet content.

**Banner JSX pattern** (lines 98-127 — VERBATIM reuse; only the strings in `<li>{d}</li>` get richer content):
```typescript
{banner && (
  <div className={`rounded-md p-4 ${banner.type === 'success' ? 'bg-green-50 ...' : 'bg-red-50 ...'}`}>
    <p className="text-sm font-medium">{banner.message}</p>
    {banner.details && banner.details.length > 0 && (
      <ul className="mt-2 text-sm space-y-1 list-disc list-inside">
        {banner.details.map((d, i) => (<li key={i}>{d}</li>))}
      </ul>
    )}
    {/* dismiss button */}
  </div>
)}
```

---

## Pattern Assignments — Feature Area: Scripts

### `scripts/build-panels-fixture.ts` (standalone Node script) — NEW

**Analog:** NONE in repo — `scripts/` directory does not yet exist. Closest existing pattern is the XLSX read pattern in `src/main/import/parser.ts:25-28`, INVERTED for write.

**XLSX write pattern** (per RESEARCH §Recommendation 4 + xlsx@0.18.5 docs):
```typescript
// scripts/build-panels-fixture.ts
import * as XLSX from 'xlsx'
import * as fs from 'fs'
import * as path from 'path'

const PANELS_DIR = path.resolve(__dirname, '../templates/panels')

function csvToRows(csvText: string): unknown[][] {
  return csvText.split(/\r?\n/).map((line) => line.split(','))
}

function main(): void {
  const wb = XLSX.utils.book_new()
  const csvFiles = fs.readdirSync(PANELS_DIR)
    .filter((f) => f.endsWith('.csv') && f !== '_table.csv')
    .sort()
  for (const csvFile of csvFiles) {
    const text = fs.readFileSync(path.join(PANELS_DIR, csvFile), 'utf-8')
    const sheet = XLSX.utils.aoa_to_sheet(csvToRows(text))
    const sheetName = deriveSheetName(csvFile)  // e.g., "Millipore Human Panel I"
    XLSX.utils.book_append_sheet(wb, sheet, sheetName)
  }
  // append _table.csv as 'Table' sheet
  const tableText = fs.readFileSync(path.join(PANELS_DIR, '_table.csv'), 'utf-8')
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(csvToRows(tableText)), 'Table')
  XLSX.writeFile(wb, path.join(PANELS_DIR, 'all-panels.xlsx'))
  console.log(`Wrote ${csvFiles.length + 1} sheets to all-panels.xlsx`)
}

main()
```

**Invocation pattern** (added to `package.json` `scripts`):
```json
"fixtures:panels": "tsx scripts/build-panels-fixture.ts"
```
Add `tsx` to `devDependencies` (zero-config TS runner; lighter than ts-node). The migration.test.ts pattern (lines 7, 14-31) for fs-reading the drizzle migrations directory is the closest precedent for this kind of standalone fs+filename-scan script logic.

---

### `package.json` — EXTEND

**Analog:** self.

**Add to `scripts`:**
```json
"fixtures:panels": "tsx scripts/build-panels-fixture.ts"
```
Match the existing one-line `"format"`, `"lint"` style at lines 8-9 of package.json.

**Add to `devDependencies`:**
```json
"tsx": "^4.x"
```
Match alphabetical position alongside `typescript`, `vite`, `vitest`.

---

## Shared Patterns

### `crypto.randomUUID()` for primary keys
**Source:** `src/main/db/repositories/masterPanel.ts:60`, `analyte.ts:42`, `panel.ts:78`.
**Apply to:** Every NEW insert in Phase 13 (master_panel_reagents.id; re-INSERTed analytes/premixes/panel_analytes).
```typescript
const id = crypto.randomUUID()
```

### ISO timestamp pair (`createdAt` + `updatedAt`)
**Source:** `src/main/db/repositories/masterPanel.ts:38, 71-72`, `analyte.ts:41, 146-147`.
**Apply to:** Every NEW insert + every UPDATE in Phase 13.
```typescript
const now = new Date().toISOString()
// ...createdAt: now, updatedAt: now
```

### Repo methods never open a transaction
**Source:** `src/main/db/repositories/masterPanel.ts:32-35` doc comment, `analyte.ts:89` doc comment.
**Apply to:** All NEW repositories (masterPanelReagent.ts) AND all extended methods (deleteByMasterPanelId on analyte/panel; createWithMetadata/updateMetadata on masterPanel). The importer owns transaction scope (Pitfall 27).

### Single transaction wrapping whole-file writes
**Source:** `src/main/import/importer.ts:48-120` (IIFE `sqlite.transaction(() => { ... })()`).
**Apply to:** Phase 13 importer.ts MUST wrap ALL per-panel wholesale-replace + INSERT-fresh loops in ONE call. Validator must aggregate errors first; importer must early-return on any error BEFORE opening the transaction (carries Phase 5 D-06 + Pitfall 27).
```typescript
const sqlite = getSqlite()
sqlite.transaction(() => {
  for (const resolved of resolvedPanels) { /* DELETE old + INSERT fresh */ }
})()
```

### Case-insensitive name lookup via `lower()` SQL
**Source:** `src/main/db/repositories/analyte.ts:67-71`, `panel.ts:57-63`.
**Apply to:** `masterPanelRepository.findByPlatformSpeciesName` — case-insensitive on `name`? Per D-18, name is already normalized form (`Panel 1`), so exact match is sufficient. But for consistency with the rest of the codebase, prefer `sql\`lower(...)\`` if any uncertainty about source casing.
```typescript
sql`lower(${analytes.name}) = lower(${input.name})`
```

### Validate-first / single-error-aggregation
**Source:** `src/main/import/validator.ts:21-57` (`const errors: string[] = []`; push; final `if (errors.length > 0) return { resolved: null, errors }`).
**Apply to:** Phase 13 validator (extended to `errors: { sheetName, message }[]`); the D-21 cross-sheet pass uses the same accumulator.

### Test isolation: forks pool + per-test in-memory DB
**Source:** `src/main/db/__tests__/testDb.ts:17-25` + `vitest.config.ts pool: 'forks'`.
**Apply to:** All NEW DB-touching tests (importer, masterPanelReagent, allPanelsFixture). `beforeEach` calls `createTestDb()` → `setDatabaseForTests` → `seedPlatformAndSpecies`; `afterEach` calls `resetDatabaseForTests()` + `sqlite.close()`. When test exercises a `getSqlite().transaction(...)`, ALSO call `setSqliteForTests(testDb.sqlite)` per `expressServer.test.ts:25`.

### `setSqliteForTests` for transaction-using tests
**Source:** `src/main/__tests__/expressServer.test.ts:6, 25`.
**Apply to:** `src/main/import/__tests__/importer.test.ts` ONLY (parser/validator/normalize tests don't touch DB so they don't need this; repository tests don't open transactions themselves so they don't need it either).
```typescript
import { setSqliteForTests } from '../db/client'
// in beforeEach:
setSqliteForTests(testDb.sqlite)
```

### ParseError-throw pattern
**Source:** `src/main/import/parser.ts:23, 37-65` (`export class ParseError extends Error {}`; thrown from helpers; caught at importer.ts boundary line 21-24).
**Apply to:** All NEW parser submodules (normalize.ts, blockParser.ts). Importer's catch shape (`err instanceof ParseError ? err.message : ...`) stays unchanged.

### Drizzle `uniqueIndex(...).on(t.colA, t.colB, ...)` for composite UNIQUE
**Source:** `src/main/db/schema.ts:42-47` (`platformSpeciesUniq: uniqueIndex('master_panels_platform_species_uniq').on(t.platformId, t.speciesId)`).
**Apply to:** Phase 13 schema delta — `master_panel_reagents_master_kind_uniq` on (masterPanelId, reagentKind), AND swapped `master_panels_platform_species_name_uniq` on (platformId, speciesId, name). NEVER use column-level `.unique()` for composites (Pitfall 14).

### Explicit FK `onDelete` declaration
**Source:** `src/main/db/schema.ts:64-66` (`onDelete: 'set null'`), `:31-34` (`onDelete: 'restrict'`).
**Apply to:** Every NEW FK in Phase 13 schema (master_panel_reagents.masterPanelId → masterPanels with `'cascade'`); ALSO the gap closure on `runs.panelId` and `run_single_analytes.analyteId` to `'set null'` per RESEARCH Pitfall E.

### Migration test: PRAGMA + sqlite_master introspection
**Source:** `src/main/db/__tests__/migration.test.ts:112-117, 130-137, 142-167`.
**Apply to:** Extension of migration.test.ts for 0007 — PRAGMA table_info for column existence/types/nullability; sqlite_master for table/index existence; `SELECT sql FROM sqlite_master WHERE name = ?` for FK clause text matching.

---

## No Analog Found

| File | Role | Data Flow | Reason | Fallback |
|------|------|-----------|--------|----------|
| `scripts/build-panels-fixture.ts` | standalone script | CSV → XLSX | No `scripts/` directory exists yet; no standalone Node-runnable script precedent in repo | Use RESEARCH §Recommendation 4 + invert the existing `XLSX.readFile` / `sheet_to_json` pattern from `src/main/import/parser.ts:26-28` |

All other files have at least a role-match analog in the codebase.

---

## Metadata

**Analog search scope:**
- `src/main/import/` (parser, validator, importer, tests)
- `src/main/db/` (schema, client, repositories, tests, testDb helpers)
- `src/main/__tests__/` (integration test patterns with transactions)
- `src/shared/types/` (interface declaration conventions)
- `src/renderer/src/features/import/` (ImportButton React state + IPC)
- `drizzle/migrations/` (SQL DDL emission patterns)
- `package.json`, `scripts/` (script-runner conventions)

**Files scanned:** 17 source files read in detail (parser.ts, importer.ts, validator.ts, parser.test.ts, masterPanel.ts, masterPanel.test.ts, analyte.ts, analyte.test.ts, panel.ts, schema.ts, testDb.ts, migration.test.ts, expressServer.test.ts excerpt, ImportButton.tsx, 0004_lame_deathstrike.sql, 0005_worried_mordo.sql, masterPanel.ts type module, analyte.ts type module, package.json).

**Pattern extraction date:** 2026-05-12

## PATTERN MAPPING COMPLETE
