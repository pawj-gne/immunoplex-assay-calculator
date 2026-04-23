# Stack Research — v2.0 Panel XLSX Upload + Master-Panel Data Model

**Domain:** Desktop Electron app (subsequent milestone — additive deltas only)
**Researched:** 2026-04-23
**Confidence:** HIGH (all recommendations verified against Context7 or official docs)

## Scope

This is a **subsequent-milestone stack research**. The Electron + electron-vite + React 18 + TypeScript + Tailwind 4 + Zustand 5 + Drizzle 0.45 + better-sqlite3 12 + electron-builder 25 baseline is already shipped and validated (v0.1.0 through v0.6.0). **Do not re-evaluate that baseline.** This doc covers only the deltas required for v2.0:

1. Multi-tab xlsx parsing (v1 was flat CSV → v2 is multi-tab, per-tab metadata at fixed cells).
2. New `master_panels` table + FKs on `panels` and `analytes`.
3. Calculator wiring to read `reagent_volume_per_well` from the master panel with a platform-default fallback.

## TL;DR — Recommended Deltas

| Decision | Recommendation |
|---|---|
| **xlsx library** | **Keep `xlsx@^0.18.5` as-is, but migrate to SheetJS CDN tarball `0.20.3`** (no npm-registry vuln exposure). No switch to exceljs. |
| **Parser helpers** | None. Use `XLSX.utils.decode_range` + cell-address reads + `sheet_to_json({ header: 1, range })`. No new deps. |
| **Validation** | Reuse installed `zod@^3.24.2` for per-tab schema validation. No `zod-xlsx`. |
| **Drizzle patterns** | Composite `unique().on(platformId, speciesId)` on `master_panels`; `onDelete: 'restrict'` on all new FKs; nullable `masterPanelId` on `panels`/`analytes` for v1 backfill. |
| **Zustand** | Augment existing `selectionStore` + `panelStore` with a `masterPanelByPlatformSpecies` slice. Do **not** add a separate `masterPanelStore`. |
| **Testing** | Defer. Project has no test runner today; adding Vitest is a milestone-sized decision, not a v2.0 delta. Use on-disk xlsx fixtures + manual Windows smoke test per existing pattern. |
| **Version upgrades** | None required for v2.0. `drizzle-orm@0.45.2` is current. `electron@33.4.11` is supported. |

---

## 1. XLSX Library — Keep SheetJS, Migrate Install Source

### Current state (verified)

- Installed: `xlsx@^0.18.5` (package.json line 33)
- Used in: `src/main/import/parser.ts` via `XLSX.readFile` + `XLSX.utils.sheet_to_json`
- Multi-tab capability: **already supported** — `workbook.SheetNames[]` returns all tabs; `workbook.Sheets[name]` gives each tab. The v1 parser just happens to pick `SheetNames[0]`. No library change is needed to read all tabs.

### The version problem

`xlsx@0.18.5` (from the npm registry) is affected by **CVE-2023-30533** (prototype pollution, CVSS 5.3, CWE-1321). Fixed in `0.19.3+`. Critically: **the npm-registry `xlsx` package has been abandoned by SheetJS and no longer tracks upstream.** The maintained release stream moved to the SheetJS CDN. ([CVE-2023-30533](https://cdn.sheetjs.com/advisories/CVE-2023-30533), [npm package notice](https://www.npmjs.com/package/xlsx))

Current maintained version: **`0.20.3`** via `https://cdn.sheetjs.com/xlsx-0.20.3/xlsx-0.20.3.tgz`. ([SheetJS docs — Node installation](https://docs.sheetjs.com/docs/getting-started/installation/nodejs/))

### Recommendation

- **Switch install source to the SheetJS CDN tarball.** Replace the package.json entry with `"xlsx": "https://cdn.sheetjs.com/xlsx-0.20.3/xlsx-0.20.3.tgz"`. Imports (`import * as XLSX from 'xlsx'`) remain unchanged.
- **Do not switch to exceljs or node-xlsx.** Rationale:
  - SheetJS API is already in use; migration cost is zero.
  - Our workflow is **read-only** — we don't need exceljs's richer writing/formatting features. (SheetJS vs exceljs comparison — [pkgpulse analysis 2026](https://www.pkgpulse.com/blog/sheetjs-vs-exceljs-vs-node-xlsx-excel-files-node-2026))
  - The CVE-2023-30533 attack surface is **read of untrusted file** — we always read user-provided files, so the CDN upgrade is required regardless of library choice.
  - `read-excel-file` and `write-excel-file` are write-focused and thinner on parsing options than we need for cell-level metadata extraction.

**Confidence: HIGH** — verified via SheetJS official docs + CVE advisory + existing code using the same API surface.

### Parser API surface we actually need (all already in `xlsx`)

The v2 spec requires: read a workbook with N tabs, extract exact-cell metadata (B1–B4, A6), read an open-ended column range starting at row 8 with blank-stop, read Row 6 across columns E+ with blank-stop. All of this is native `xlsx`:

```typescript
import * as XLSX from 'xlsx'

const wb = XLSX.readFile(filePath)
for (const sheetName of wb.SheetNames) {
  const ws = wb.Sheets[sheetName]

  // Exact-cell metadata reads — direct indexing on cell-address keys
  const panelName   = ws['B1']?.v  // v = raw value; w = formatted text
  const platform    = ws['B2']?.v
  const species     = ws['B3']?.v
  const reagentVol  = ws['B4']?.v
  const vendorTerm  = ws['A6']?.v

  // Full-sheet range bounds
  const range = XLSX.utils.decode_range(ws['!ref'] ?? 'A1')

  // Row-6 premix discovery — iterate E onward until blank
  // Row-8+ master list / premix cols — iterate rows until target cell blank
  // (plain for-loops on ws[XLSX.utils.encode_cell({c, r})])
}
```

**Context7 confirmed** (`/websites/sheetjs`): `sheet_to_json` supports `{ header: 1, range }` for array-of-arrays with subrange control, and `raw`/`blankrows`/`defval` options for controlling type coercion and blank handling. We likely won't need `sheet_to_json` at all for v2 — the per-tab layout is deterministic enough that direct cell-address reads are simpler and more auditable than mapping through the utility.

### What NOT to install

| Don't add | Why |
|---|---|
| `exceljs` | Richer write support we don't need; second xlsx library in the bundle inflates the installer. |
| `node-xlsx` | Thin wrapper over `xlsx` — would replace one abstraction with another, no net benefit. |
| `read-excel-file` / `write-excel-file` | Targeted at simple header-row tabular files; doesn't fit our fixed-cell metadata layout cleanly. |
| `zod-xlsx` | Not a real maintained package for this pattern; roll the integration with plain `zod` + cell reads. |
| `xlsx-populate` | Unmaintained, Node-only variant. |

---

## 2. Validation — Reuse `zod@3.24.2`

Already installed and in use in `src/main/import/validator.ts`. For v2 we need:

- **Metadata schema per tab** — `z.object({ panelName: z.string().min(1), platform: z.string().min(1), species: z.string().min(1), reagentVolume: z.number().positive(), vendorSinglesTerm: z.string().optional() })`
- **Master-row schema** — `z.object({ target: z.string().min(1), beadRegion: z.number().int().positive(), concentration: z.number().positive() })` (same shape the v1 validator already uses, just split into master + premix rows).
- **Premix reference check** — not a zod job; do it post-parse as a set-membership check against the master analyte names (case-insensitive, matching v1 convention in `validator.ts` line 64).

No version bump. No new deps. The `zod@4` upgrade path exists but is not required for v2 — `3.24.2` is stable and the API we use (`z.object`, `.safeParse`, `z.infer`) is unchanged in v4.

**Confidence: HIGH** — verified against existing project code.

---

## 3. Drizzle Schema Additions — Patterns

Drizzle 0.45.1 is installed. Current is `0.45.2` (verified via npm). No bump needed.

### Schema delta (from v2 spec + Drizzle best practices)

```typescript
// NEW: master_panels table
export const masterPanels = sqliteTable(
  'master_panels',
  {
    id: text('id').primaryKey(),
    platformId: text('platform_id')
      .notNull()
      .references(() => platforms.id, { onDelete: 'restrict' }),
    speciesId: text('species_id')
      .notNull()
      .references(() => species.id, { onDelete: 'restrict' }),
    name: text('name').notNull(),
    reagentVolumePerWell: real('reagent_volume_per_well').notNull(),
    vendorSinglesTerm: text('vendor_singles_term'), // nullable per spec
    createdAt: text('created_at').notNull(),
    updatedAt: text('updated_at').notNull()
  },
  (t) => ({
    // Composite UNIQUE on (platformId, speciesId) — one master per pair
    platformSpeciesUnique: unique('master_panels_platform_species_unique')
      .on(t.platformId, t.speciesId)
  })
)

// EXISTING: premixPanels — add nullable FK
masterPanelId: text('master_panel_id').references(() => masterPanels.id, {
  onDelete: 'set null'
}),

// EXISTING: analytes — add nullable FK
masterPanelId: text('master_panel_id').references(() => masterPanels.id, {
  onDelete: 'set null'
}),
```

### Drizzle patterns worth flagging

1. **Composite unique indexes are supported natively** — use `unique('name').on(col1, col2)` returned from the third table-builder callback argument. In SQLite, Drizzle emits these as `CREATE UNIQUE INDEX` (not inline constraints). ([Drizzle Context7 — Indexes & Constraints](https://orm.drizzle.team/docs/indexes-constraints))

2. **`onDelete` choice matters and must be explicit.** Options: `'cascade' | 'restrict' | 'no action' | 'set null' | 'set default'`. ([Drizzle Context7 — relations.mdx](https://orm.drizzle.team/docs/relations))
   - **`master_panels.platform_id` / `species_id`** → `'restrict'`. Platforms and species are reference data; we should never cascade-delete a master panel because a platform got removed.
   - **`premix_panels.master_panel_id`** → `'set null'`. If a master is deleted, premixes survive as orphaned v1-style panels. Matches spec §Idempotency: "Deletion of orphaned analytes or premixes is not automatic."
   - **`analytes.master_panel_id`** → `'set null'`. Same reasoning — analytes outlive their master so historical runs still resolve.

3. **SQLite FK enforcement gotcha** — SQLite requires `PRAGMA foreign_keys = ON` per-connection. **Check** that `src/main/db/client.ts` sets this; if not, it's a pre-existing bug that v2 will expose for the first time (v1 has no multi-table FK chains requiring enforcement).

4. **Composite unique migration bug flag** — [drizzle-orm issue #3411](https://github.com/drizzle-team/drizzle-orm/issues/3411) reports composite unique indexes sometimes not emitted in generated migrations. **Mitigation:** after `npm run db:generate`, grep the new migration SQL for `UNIQUE INDEX` and hand-verify the composite is present. If missing, hand-edit the migration. Low-probability but cheap to check.

5. **Nullable FKs for v1 back-compat** — both `masterPanelId` columns must be nullable. v1-imported analytes and panels have no master, and we're not backfilling at migration time (per spec §Migration path: "No data loss — v1 imports stay functional throughout"). Drizzle makes nullable the default when `.notNull()` is omitted.

6. **`drizzle-kit` migration workflow** — already established (`npm run db:generate`, `npm run db:push`). No changes needed. The new migration file will be `0004_*.sql` following the existing sequence.

**Confidence: HIGH** — verified against Drizzle docs via Context7 and existing schema patterns.

---

## 4. Zustand Store Strategy — Augment, Don't Add

### Current stores (verified via file listing)

- `platformStore` — platforms (global)
- `selectionStore` — species + panel + analyte selection state for the calculator (large, role-heavy)
- `calculatorStore` — calculator output state
- `runStore` — runs CRUD
- `operatorsStore` — operators CRUD
- `plateStore` — plate layout

Note: there is **no separate `panelStore`** in the current code — panel selection lives inside `selectionStore` (lines 62–67 of `selectionStore.ts`). The milestone brief's mention of "panelStore" is inaccurate; correct the mental model.

### Recommendation

**Do not add a separate `masterPanelStore`.** Augment `selectionStore` with master-panel state because:

1. Master panel is **derived from (platformId, speciesId)** — it always loads alongside species + premix panels. A separate store would duplicate that load coordination.
2. The calculator's reagent-volume wiring needs to read the master panel at the same call site where it reads the selected panel. Keeping both in one store is simpler.
3. Creating a new store forces new loading-state plumbing for a 1:1 relationship with existing data.

### Proposed slice additions to `selectionStore`

```typescript
interface SelectionState {
  // ... existing ...

  // NEW: master panel for the current (platformId, speciesId)
  masterPanel: MasterPanel | null
  masterPanelLoading: boolean
  masterPanelError: string | null

  // NEW: derived getter
  getReagentVolumePerWell: () => number // master → platform default fallback
  getVendorSinglesTerm: () => string   // master value → "Single" fallback
}
```

Modify `loadPanelsAndAnalytes` to load the master panel in the same `Promise.all` block (there's a natural extension point at lines 125–128 of `selectionStore.ts`).

### Separate concern: admin/import flows

The master-panel **import result banner** (per-tab summary) lives in a separate local-component state or in a small import-status slice. It does not belong in `selectionStore` because it's a one-shot UI event, not shared selection state. This matches how the v1 importer surfaces results today (`src/renderer/src/features/import/`).

**Confidence: MEDIUM** — architectural judgment based on inspection of `selectionStore.ts` + v1 import feature structure. The architecture-research sibling doc may counter-propose; defer the final split to that doc if it conflicts.

---

## 5. Testing — Defer the Runner Decision

### Current state

No test runner is installed. `package.json` scripts contain `typecheck`, `lint`, `build`, `build:win` — no `test`. The project ships via a manual Windows smoke-test protocol (per CLAUDE.md: "dev happens on macOS; no runtime testing on macOS; test cycle: build → Windows install → manual verification").

### v2.0 recommendation

**Do not introduce a test runner as part of v2.0.** Rationale:

1. Adding Vitest + fixtures + main-process mocking is a milestone-sized scope bump — it would change the dev loop for every future phase and deserves its own decision.
2. The v2 parser is pure-function — `parseImportFile(filePath) → ParsedWorkbook | ParseError[]`. It can be exercised via a throwaway CLI script (`tsx scripts/test-parser.ts ./fixtures/milliplex.xlsx`) during development without a full test framework.
3. Validation-gate failures are caught by the existing flow: type-check + lint + manual Windows smoke test. For a small-team lab-internal app this is adequate.

### Fixture approach

Commit a `fixtures/` directory with 3 hand-crafted .xlsx files:
- `happy-path.xlsx` — 2 tabs, one Milliplex Human, one BioRad Mouse, all valid.
- `validation-errors.xlsx` — each tab exercises a different error class (missing metadata, non-integer bead region, unknown platform, premix analyte not in master).
- `edge-cases.xlsx` — empty cells interleaved, case-insensitive platform match, missing optional A6 vendor term.

Hand-craft these in LibreOffice/Excel rather than generating programmatically — the spec is layout-sensitive and we want fixtures that match real vendor files.

### If a test runner IS pulled forward

If the orchestrator/user decides to add testing in v2.0, the recommendation is:
- **Runner:** Vitest (integrates with the existing electron-vite toolchain, zero Jest config churn).
- **xlsx fixture generation:** use `XLSX.utils.aoa_to_sheet` + `XLSX.utils.book_new` + `XLSX.write` inside test setup. Do **not** commit binary fixtures in that case — generate in `beforeAll`.
- **Electron main-process testing:** Vitest does not run Electron natively. Structure the parser and importer as pure Node-importable modules (they already are — they don't touch `electron` APIs). Test those modules directly. Do not attempt to test IPC handlers in Vitest.

**Confidence: HIGH** — based on project conventions in CLAUDE.md + verified absence of any test setup in package.json.

---

## 6. Other Dependency Audit — All Green for v2.0

Versions verified against project `package.json`:

| Package | Installed | Current Stable | v2.0 action |
|---|---|---|---|
| `electron` | 33.4.11 | 35.0.0 | **Stay on 33.** Major upgrades should not ride a feature milestone. ([Electron releases](https://releases.electronjs.org/)) |
| `electron-vite` | 2.3.0 | 2.x | Stay |
| `electron-builder` | 25.1.8 | 25.x | Stay |
| `better-sqlite3` | 12.6.2 | 12.x | Stay |
| `drizzle-orm` | 0.45.1 | 0.45.2 | Stay (0.45.2 is a patch; non-urgent) |
| `drizzle-kit` | 0.31.8 | 0.31.x | Stay |
| `react` / `react-dom` | 18.3.1 | 18 / 19 | Stay on 18. React 19 migration is a separate decision. |
| `zod` | 3.24.2 | 3.24 / 4 | Stay |
| `zustand` | 5.0.3 | 5.x | Stay |
| `tailwindcss` | 4.1.18 | 4.x | Stay |
| `typescript` | 5.7.3 | 5.7.x | Stay |
| `xlsx` | 0.18.5 (npm) | 0.20.3 (CDN) | **BUMP via CDN tarball** (see §1) |

**Nothing is on an outdated major for v2.0 purposes.** The only must-do dependency change is the `xlsx` migration to the SheetJS CDN tarball.

---

## Installation — Exact Commands

```bash
# The one required change for v2.0 — swap xlsx install source
npm uninstall xlsx
npm install --save https://cdn.sheetjs.com/xlsx-0.20.3/xlsx-0.20.3.tgz

# Then regenerate lockfile + rebuild native bindings
npm install
```

After install, verify:

```bash
# Confirm 0.20.3 is resolved
node -e "console.log(require('xlsx').version)"
```

No other new dependencies. All v2.0 work is additive to the existing stack.

---

## Alternatives Considered

| Decision | Recommended | Alternative | When to use alternative |
|---|---|---|---|
| xlsx lib | SheetJS CDN `0.20.3` | `exceljs` | If we later need rich xlsx *writing* (formatted templates for operators). Not for reading. |
| xlsx lib | SheetJS CDN `0.20.3` | `xlsx@0.18.5` (stay) | Never — CVE exposure on untrusted input makes this unacceptable. |
| Validation | `zod@3` | `valibot`, `@effect/schema` | Not justified; zod is already woven through the v1 importer and calculator. |
| Store shape | Augment `selectionStore` | Dedicated `masterPanelStore` | If master-panel data needs independent loading cadence (e.g., admin UI for CRUD separate from selection). Not true today. |
| Testing | Defer runner | Vitest + fixtures in setup | If stakeholder mandates automated tests before shipping v2.0. |
| Drizzle | `0.45.1` + manual migration check | Upgrade to `0.45.2` or `0.50.x` beta | If `drizzle-kit generate` produces incorrect SQL for composite unique (issue #3411). |

---

## What NOT to Use / Add

| Avoid | Why | Use Instead |
|---|---|---|
| `exceljs` | Second xlsx lib in bundle; write-focused features we don't need. | Keep SheetJS. |
| `node-xlsx` / `read-excel-file` | Thinner API, less flexible for fixed-cell metadata reads. | Keep SheetJS. |
| New `masterPanelStore` | Duplicates loading coordination that already lives in `selectionStore`. | Augment `selectionStore`. |
| Jest / Mocha | Would require dual-config alongside electron-vite. | If adding tests, use Vitest. |
| `onDelete: 'cascade'` on master_panels FKs | Would delete master panel when its platform row is removed (unsafe). | `'restrict'` for upward FKs, `'set null'` for downward FKs. |
| Auto-deleting orphaned analytes on re-import | Spec explicitly says "Deletion of orphaned analytes or premixes is not automatic." | Upsert-only. Defer cleanup to a later admin action. |
| React 19 upgrade during v2.0 | Orthogonal to the milestone; risk of regressions in existing features. | Stay on 18; schedule as its own decision. |

---

## Stack Patterns by Variant

**If Decision 1 (replace-vs-coexist) = "replace v1":**
- Delete `src/main/import/` contents after v2 is live.
- Keep v1's `panels` rows (they keep working via nullable `masterPanelId`).
- UI shows only the v2 importer; no "legacy import" link.

**If Decision 1 = "coexist":**
- Keep both IPC channels (`IMPORT_PANEL_DATA` for v1 CSV, `IMPORT_MASTER_PANEL_FILE` for v2 xlsx).
- Add a "legacy CSV import" link under the v2 button.
- Plan to remove v1 in v2.1+ once all production panels are migrated.

**If Decision 2 (calculator strictness) = "strict, require master panel":**
- Block run creation for v1-imported panels until they're re-imported.
- Add a pre-flight check in `runStore.createRun` returning a user-facing error.

**If Decision 2 = "fallback":**
- `selectionStore.getReagentVolumePerWell()` returns `masterPanel?.reagentVolumePerWell ?? platform.volumePerWell`.
- No blocking. No data migration required.

---

## Version Compatibility Notes

- **SheetJS `0.20.3` + Node 20** (shipped with Electron 33) — supported. The SheetJS CDN tarball targets Node 18+. ([SheetJS Node docs](https://docs.sheetjs.com/docs/getting-started/installation/nodejs/))
- **Drizzle composite unique + SQLite** — emitted as `CREATE UNIQUE INDEX`, not inline `UNIQUE` constraint. Verify in the generated migration. ([Drizzle docs](https://orm.drizzle.team/docs/indexes-constraints))
- **better-sqlite3 12 + Electron 33** — already validated by existing seed/migrate flow; no compatibility change.
- **xlsx CDN tarball + electron-builder asar packaging** — the SheetJS tarball is a normal npm package (it just happens to be hosted on SheetJS's CDN instead of the public registry); asar packaging works identically.
- **xlsx CDN tarball + `postinstall` rebuild hook** — the `electron-builder install-app-deps && electron-rebuild -f -w better-sqlite3` hook only rebuilds native modules. xlsx is pure JS; no rebuild needed and no conflict.

---

## Sources

- [SheetJS — CVE-2023-30533 advisory](https://cdn.sheetjs.com/advisories/CVE-2023-30533)
- [SheetJS Community Edition docs — Node.js installation](https://docs.sheetjs.com/docs/getting-started/installation/nodejs/)
- [SheetJS — sheet_to_json API](https://docs.sheetjs.com/docs/api/utilities/array/) (via Context7 `/websites/sheetjs`)
- [npm — xlsx package (abandonment notice)](https://www.npmjs.com/package/xlsx)
- [SheetJS vs ExcelJS vs node-xlsx — 2026 comparison](https://www.pkgpulse.com/blog/sheetjs-vs-exceljs-vs-node-xlsx-excel-files-node-2026)
- [Drizzle ORM — Indexes & Constraints](https://orm.drizzle.team/docs/indexes-constraints) (via Context7 `/drizzle-team/drizzle-orm-docs`)
- [Drizzle ORM — Relations (onDelete)](https://orm.drizzle.team/docs/relations) (via Context7)
- [Drizzle issue #3411 — composite unique migration bug](https://github.com/drizzle-team/drizzle-orm/issues/3411)
- [Electron releases](https://releases.electronjs.org/)
- Existing project files: `package.json`, `src/main/db/schema.ts`, `src/main/import/{parser,importer,validator}.ts`, `src/renderer/src/stores/selectionStore.ts`, `.planning/PANEL-UPLOAD-V2-SPEC.md`
