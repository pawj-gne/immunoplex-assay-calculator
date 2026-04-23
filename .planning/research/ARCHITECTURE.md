# Architecture Research — v2.0 Panel XLSX Upload + Master-Panel Data Model

**Project:** Immunoplex Assay Calculator (v2.0 milestone)
**Researched:** 2026-04-23
**Confidence:** HIGH — all claims grounded in direct reads of current source; no second-guessing of v1 patterns.
**Scope note:** This document ONLY describes deltas against the validated v1 architecture. For v1 patterns (IPC registry, Zustand stores, Drizzle repos, contextBridge bridge), see `.planning/research/v1.0-archive/ARCHITECTURE.md`.

---

## 1. Integration Overview — What Changes, What Stays

### 1.1 Change Map (concrete files)

| Area | Action | File | Notes |
|---|---|---|---|
| Schema | MODIFY | `src/main/db/schema.ts` | Add `masterPanels` table; add `masterPanelId` on `premixPanels` + `analytes` |
| Migration | ADD | `drizzle/migrations/0004_*.sql` | Drizzle-kit generated from schema diff |
| Types (shared) | ADD | `src/shared/types/masterPanel.ts` | `MasterPanel`, `MasterPanelCreate`, `MasterPanelUpdate` |
| Types (shared) | MODIFY | `src/shared/types/panel.ts`, `analyte.ts` | Add optional `masterPanelId: string \| null` |
| Repo | ADD | `src/main/db/repositories/masterPanel.ts` | CRUD + `findByPlatformAndSpecies`, `upsert` |
| Repo | MODIFY | `src/main/db/repositories/panel.ts` | Add `findByMasterPanelAndName`, thread `masterPanelId` through create |
| Repo | MODIFY | `src/main/db/repositories/analyte.ts` | Add `upsertForMaster`, set `masterPanelId` on create |
| Parser | ADD | `src/main/import/masterPanel/parser.ts` | Multi-tab xlsx parser (per-tab coords B1–B4, A6, cols A/B/C, E+) |
| Validator | ADD | `src/main/import/masterPanel/validator.ts` | Zod schemas + case-insensitive platform/species resolution + premix-membership cross-check |
| Importer | ADD | `src/main/import/masterPanel/importer.ts` | Orchestrates per-tab pipeline inside a single Drizzle transaction |
| IPC handler | MODIFY | `src/main/ipc/import.ts` | Register new `IMPORT_MASTER_PANEL_FILE` alongside existing `IMPORT_PANEL_DATA` |
| IPC channel | MODIFY | `src/shared/constants/channels.ts` | Add `IMPORT_MASTER_PANEL_FILE: 'import:master-panel-file'` |
| Preload bridge | MODIFY | `src/preload/index.ts` | Add `import.masterPanelFile()` method |
| Preload types | MODIFY | `src/preload/index.d.ts` | Declare the new method on `electronAPI` |
| UI button | ADD | `src/renderer/src/features/import/MasterPanelImportButton.tsx` | Sibling to `ImportButton.tsx`; .xlsx only; multi-tab summary banner |
| UI placement | MODIFY | `src/renderer/src/features/manage/ManagePage.tsx` | Mount new button in Panels section alongside existing import |
| Selector wiring | MODIFY | `src/renderer/src/stores/selectionStore.ts` | Expose `selectedMasterPanel` (by platform+species) + `getSinglesSectionLabel()` |
| IPC surface | MODIFY | `src/main/ipc/panel.ts` or add `masterPanel.ts` | New handler `MASTER_PANEL_GET_BY_PLATFORM_SPECIES` so renderer can read `vendor_singles_term` + `reagent_volume_per_well` |
| AnalyteGrid wiring | MODIFY | `src/renderer/src/features/selection/components/AnalyteSelectionPanel.tsx` | Pass `sectionLabel={masterPanel?.vendorSinglesTerm ?? 'Analytes'}` when no premix selected (line 63) |
| Calculator input | MODIFY | `src/renderer/src/stores/calculatorStore.ts` | Replace hard-coded `DEFAULT_VOLUME_PER_WELL` with master-panel lookup + fallback |
| Calculator hook | MODIFY | `src/renderer/src/features/calculator/hooks/useCalculator.ts` | Read `volumePerWell` from selection store's master panel, fall through to default constant |

### 1.2 Stays Untouched

- `src/main/ipc/index.ts` (only appends one `register*` call — mechanical, not architectural)
- `src/main/db/client.ts`, `migrate.ts` (migration loader already resolves `drizzle/migrations/*` in prod and dev)
- `src/renderer/src/lib/calculator.ts` (pure math — takes `volumePerWell` as an input, doesn't care where it came from)
- `src/main/import/{parser,validator,importer}.ts` (v1 CSV path — continues to exist per §8 of the spec)
- All existing v1 IPC channels, preload methods, and v1 `ImportButton.tsx`
- `plateStore`, `platformStore`, `operatorsStore`, `runStore`, `calculator.ts` domain logic

---

## 2. IPC Channel Separation vs Unification

### 2.1 Recommendation — Separate channels (matches spec §Parser spec)

**Use a new channel: `IMPORT_MASTER_PANEL_FILE: 'import:master-panel-file'`**, distinct from the existing `IMPORT_PANEL_DATA: 'import:panel-data'`.

### 2.2 Why separate beats unified (trade-off analysis)

| Dimension | Separate channels (spec default) | Unified `importFile` + dispatch |
|---|---|---|
| Payload shape | Each channel returns its own shaped `ImportResult` — different fields (v1 has flat row errors, v2 has tab-keyed per-tab errors). No discriminated union needed at the preload/renderer boundary. | Return type must be a discriminated union; renderer must branch on `kind` before using `errors`. Every consumer site pays this tax. |
| File dialog filter | v1 accepts `.csv/.xlsx/.xls`; v2 is `.xlsx` only. One dialog per button = clean filter. | Single dialog can't sensibly filter both shapes, pushing the user into ambiguity ("which of my xlsx files is a v1 flat sheet vs a v2 multi-tab?"). |
| Error handling | v1 sketches one error per row; v2 sketches per-tab-per-row-per-cell errors. Distinct UX. | Either fold v2 errors into v1's shape (lossy) or widen v1's shape (breaking). |
| Discovery | Existing pattern in `src/main/ipc/import.ts` is one-handler-per-operation (`registerImportHandlers()` adds handlers individually). Adding `ipcMain.handle(IPC_CHANNELS.IMPORT_MASTER_PANEL_FILE, ...)` next to it is idiomatic. | Would need a discriminator param (`kind: 'v1' \| 'v2'`) plus runtime `switch`. More failure modes (unknown kind), harder to remove v1 later. |
| Deprecation path | Spec §Migration path: ship v2 alongside v1, eventually delete v1 handler. Deleting one handler is a trivial `rm` + bridge-method delete. | Deleting a discriminator branch inside a unified handler is subtler — preload surface still exists. |
| Audit / logging | Per-channel log lines ("Panel import started", "Master panel import started") self-document in stack traces. | Single log path with dispatch arg to decode. |

**Value in a shared abstraction:** near zero at this scale (two channels). Ducking unification keeps the renderer import surface readable (`window.electronAPI.import.panelData()` vs `window.electronAPI.import.masterPanelFile()`) and matches the spec's intent. Revisit only if a v3 introduces a third importer; at that point extract a common orchestrator inside main/, not at the IPC layer.

### 2.3 Registration pattern (delta only)

```ts
// src/shared/constants/channels.ts  — ADD:
IMPORT_MASTER_PANEL_FILE: 'import:master-panel-file',

// src/main/ipc/import.ts  — EXTEND registerImportHandlers():
ipcMain.handle(IPC_CHANNELS.IMPORT_MASTER_PANEL_FILE, async (): Promise<MasterPanelImportResult> => {
  const win = BrowserWindow.getFocusedWindow()
  const result = await dialog.showOpenDialog(win ?? BrowserWindow.getAllWindows()[0], {
    title: 'Import Master Panel (.xlsx)',
    filters: [{ name: 'Excel Workbook', extensions: ['xlsx'] }],
    properties: ['openFile']
  })
  if (result.canceled || result.filePaths.length === 0) return { success: false, canceled: true, tabs: [], errors: [] }
  try { return importMasterPanelFile(result.filePaths[0]) }
  catch (err) { return { success: false, tabs: [], errors: [{ tab: null, issues: [err instanceof Error ? err.message : 'Unknown error'] }] } }
})
```

```ts
// src/preload/index.ts  — ADD under import: {}
masterPanelFile: () => ipcRenderer.invoke(IPC_CHANNELS.IMPORT_MASTER_PANEL_FILE)
```

This mirrors the v1 pattern exactly; nothing new in the registry architecture.

---

## 3. Data Flow — One XLSX Upload, End to End

Boundaries numbered; payload shape given at each. "→" denotes a process or layer boundary.

```
[User] --clicks "Import Master Panel (.xlsx)" on Manage > Panels-->
```

### Boundary 1: React event → preload bridge (renderer process)

- **Call:** `window.electronAPI.import.masterPanelFile()` from `MasterPanelImportButton.tsx` onClick.
- **Payload out:** none (no args — the dialog is opened inside main).
- **Return type (awaited):** `Promise<MasterPanelImportResult>`.

### Boundary 2: preload → main (IPC — Electron's `invoke/handle`)

- **Channel:** `'import:master-panel-file'` (string).
- **Serialization:** structured-clone. No args, so nothing to sanitize.
- **Main-process side:** `ipcMain.handle(IPC_CHANNELS.IMPORT_MASTER_PANEL_FILE, ...)` in `src/main/ipc/import.ts`.

### Boundary 3: handler → Electron dialog → filesystem

- **Dialog:** `dialog.showOpenDialog` with `filters: [{ name: 'Excel Workbook', extensions: ['xlsx'] }]`, `properties: ['openFile']`.
- **If canceled:** return `{ success: false, canceled: true, tabs: [], errors: [] }` immediately. (Matches v1's `ImportButton.tsx` `result.canceled` check.)
- **Payload out of handler:** the absolute file path as a `string` to the importer.

### Boundary 4: importer → parser (function call, synchronous)

- **Entry:** `importMasterPanelFile(filePath: string): MasterPanelImportResult` in `src/main/import/masterPanel/importer.ts`.
- **Parser call:** `parseMasterPanelWorkbook(filePath) → ParsedWorkbook`.
- **ParsedWorkbook shape:**
  ```ts
  interface ParsedWorkbook {
    tabs: Array<{
      tabName: string // the sheet name (informational)
      metadata: { panelName: string; platformRaw: string; speciesRaw: string; reagentVolumeRaw: unknown; vendorSinglesTermRaw?: string }
      master: Array<{ row: number; name: string; beadRegionRaw: unknown; concentrationRaw: unknown }>
      premixes: Array<{ columnIndex: number; columnLetter: string; name: string; analyteNames: Array<{ row: number; name: string }> }>
    }>
  }
  ```
- **Parser responsibility:** read raw cell values using `xlsx` (already a dep — see v1 `parser.ts`). No validation, no coercion. `xlsx` is called per sheet; master-list and premix-column blank-stop rules are implemented here. Output is intentionally unvalidated.

### Boundary 5: parser → validator (function call)

- **Entry:** `validateWorkbook(parsed: ParsedWorkbook, platforms: Platform[], species: Species[]): ValidationResult`.
- **Per-tab validation pipeline** (spec §Per-tab parse pipeline):
  1. Zod-coerce B1–B4 metadata (panel name string, platform string, species string, reagent volume positive number).
  2. Case-insensitive platform lookup → produce `platformId` or tab-level error with list of valid platforms.
  3. Case-insensitive species lookup scoped to resolved platform → `speciesId` or error.
  4. Zod-coerce master rows (name non-empty, bead region positive int, concentration positive number).
  5. For each premix, verify every analyte name is present (case-insensitive) in the master list — collect offending (column, row, name) tuples.
- **Strictness:** collect errors across ALL tabs before returning. No partial import. Matches v1's fail-fast and spec §Open decision 5 suggested default.
- **ValidationResult shape:**
  ```ts
  interface ValidationResult {
    resolved: ResolvedTab[] // only populated if errors.length === 0
    errors: Array<{ tab: string; row?: number; column?: string; issues: string[] }>
  }
  interface ResolvedTab {
    platformId: string; speciesId: string; panelName: string; reagentVolumePerWell: number; vendorSinglesTerm: string | null
    analytes: Array<{ name: string; beadRegion: number; concentration: number }>
    premixes: Array<{ name: string; analyteNames: string[] }> // already verified against master
  }
  ```

### Boundary 6: validator → transactional writer (Drizzle, main process)

- **Invocation:** `getSqlite().transaction(() => { for (const tab of resolved) writeTab(tab) })()`. Matches v1 `importer.ts` pattern exactly.
- **Per-tab writes (upsert semantics, spec §Idempotency):**
  1. `masterPanelRepository.upsertByPlatformAndSpecies({ platformId, speciesId, name, reagentVolumePerWell, vendorSinglesTerm })` → returns `masterPanelId`.
  2. For each master analyte: `analyteRepository.upsertByNameInMaster({ masterPanelId, platformId, speciesId, name, beadRegion, concentration })`. Insert new with `masterPanelId` FK; if existing (by case-insensitive name), update `beadRegion` + `premixConc`/`singleConc` (see §7 for concentration mapping) + set `masterPanelId`.
  3. For each premix: `panelRepository.upsertByMasterAndName({ masterPanelId, platformId, speciesId, name })`, then replace its `panel_analytes` membership wholesale (`DELETE` then `INSERT` all).
- **No deletion of orphaned rows.** Spec §Idempotency: dropping an analyte from the file does not remove it from DB.

### Boundary 7: main → preload (IPC return — structured clone)

- **MasterPanelImportResult shape:**
  ```ts
  interface MasterPanelImportResult {
    success: boolean
    canceled?: boolean
    tabs: Array<{
      tabName: string; masterPanelId: string; panelName: string
      counts: { analytesCreated: number; analytesUpdated: number; premixesCreated: number; premixesUpdated: number }
    }>
    errors: Array<{ tab: string | null; row?: number; column?: string; issues: string[] }>
  }
  ```

### Boundary 8: preload → renderer (awaited return)

- **Renderer consumer:** `MasterPanelImportButton` awaits the promise.
- **On success:** format banner per spec §Result banner: `"Imported N master panels: {name} ({analytes}, {premixes}); ..."`.
- **State refresh:** call `useSelectionStore.getState().loadPanelsAndAnalytes(platformId, speciesId)` for the currently-selected platform+species (if any) so the calculator picks up the new master panel and premix membership. Also refresh `PanelList` and `AnalyteTable` via their existing `fetchPanels()` / fetchers — trigger through an event or prop callback identical to how `PanelEditModal`'s `onSaved` prop works today. Simplest mechanism: add an `onImported` callback prop to `MasterPanelImportButton`; `ManagePage` passes a handler that re-fetches.
- **Toast/banner:** reuse the banner pattern from existing `ImportButton.tsx` (success auto-dismiss 10s, error with details list).

---

## 4. Data Model Delta

### 4.1 New schema (Drizzle, `src/main/db/schema.ts`)

```ts
export const masterPanels = sqliteTable('master_panels', {
  id: text('id').primaryKey(),
  platformId: text('platform_id').notNull().references(() => platforms.id),
  speciesId: text('species_id').notNull().references(() => species.id),
  name: text('name').notNull(),
  reagentVolumePerWell: real('reagent_volume_per_well').notNull(),
  vendorSinglesTerm: text('vendor_singles_term'), // nullable
  createdAt: text('created_at').notNull(),
  updatedAt: text('updated_at').notNull()
}, (t) => ({
  uniqPlatformSpecies: uniqueIndex('master_panels_platform_species_uniq').on(t.platformId, t.speciesId)
}))
```

Drizzle-kit's `unique()` index on `(platform_id, species_id)` models the spec's "exactly one master panel per (platform, species)" rule at the DB layer.

### 4.2 Modifications to existing tables

```ts
// premixPanels — ADD column
masterPanelId: text('master_panel_id').references(() => masterPanels.id) // nullable

// analytes — ADD column
masterPanelId: text('master_panel_id').references(() => masterPanels.id) // nullable
```

Both are nullable on purpose (spec §Proposed schema changes): v1-imported rows have no master panel, and nullable is the simplest way to model coexistence.

### 4.3 Drizzle migration mechanics

- Run `npx drizzle-kit generate` from the schema change. It will produce `drizzle/migrations/0004_*.sql` with `CREATE TABLE master_panels (...)` + `ALTER TABLE premix_panels ADD COLUMN master_panel_id ...` + `ALTER TABLE analytes ADD COLUMN master_panel_id ...`.
- SQLite ALTER TABLE ADD COLUMN for a nullable FK works in-place (no table rebuild). No data backfill needed.
- The existing `migrate.ts` at `src/main/db/migrate.ts` picks up new migration files automatically via `drizzle-orm/better-sqlite3/migrator`. No code change needed there.
- Migration is idempotent on re-run because drizzle-kit journals each applied migration (`drizzle/migrations/meta/_journal.json`).

### 4.4 Coexistence with v1-imported rows

- **v1 `premix_panels` rows:** `master_panel_id = NULL`. They continue to work for calculator selection; the calculator falls back to platform default for reagent volume (§5).
- **v1 `analytes` rows:** `master_panel_id = NULL`. Displayed in `AnalyteGrid` under the generic "Analytes" label (since no master panel exists to supply `vendor_singles_term`).
- **v2 re-import adopts v1 rows:** upsert-by-name (case-insensitive) promotes existing analyte/premix rows by setting their `master_panel_id`. No row duplication. No data loss. Historical `runs.panelId` references remain valid because IDs don't change.

### 4.5 Type additions (`src/shared/types/masterPanel.ts`)

```ts
export interface MasterPanel {
  id: string
  platformId: string
  speciesId: string
  name: string
  reagentVolumePerWell: number
  vendorSinglesTerm: string | null
  createdAt: string
  updatedAt: string
}
export interface MasterPanelCreate { /* omit id/timestamps */ }
```

Add optional `masterPanelId: string | null` to existing `PremixPanel` and `Analyte` types.

---

## 5. Calculator Wiring — Reagent Volume Resolution

### 5.1 Current state (what it does today)

- `calculatorStore.volumePerWell` is initialized to `DEFAULT_VOLUME_PER_WELL = 25` (from `src/shared/constants/calculator.ts`).
- It is NEVER set from a platform config. `platforms` table has `stockConcentration` but no `volumePerWell` column today — "platform default" in the spec is literally the hard-coded constant, not a DB value.
- `useCalculator` hook reads `volumePerWell` from `calculatorStore` and passes it unchanged to `calculator.ts` pure math.

### 5.2 Target resolution priority (spec §Calculator behavior change)

1. If the run's master panel (resolved via currently-selected platform+species+panel→masterPanel) has `reagent_volume_per_well` → use it.
2. Otherwise fall back to platform default. For v2.0 this means the existing `DEFAULT_VOLUME_PER_WELL = 25`, UNLESS the platform config gains a `defaultVolumePerWell` column later.
3. Full-custom (no panel selected) also falls to platform default.

### 5.3 Where the lookup happens

**Recommendation: resolve in the renderer, inside `calculatorStore` (or a dedicated selector hook).** Reasons:
- The calculator already lives in the renderer — an IPC round-trip every keystroke is unacceptable.
- `selectionStore` already loads panels+analytes for the current (platform, species). Extending it to also load the master panel row is one more `window.electronAPI.masterPanel.getByPlatformAndSpecies(platformId, speciesId)` call in `loadPanelsAndAnalytes`.
- The master panel is a single row — trivial to cache in `selectionStore`.

### 5.4 Concrete changes

1. **Add IPC channel + handler:** `MASTER_PANEL_GET_BY_PLATFORM_SPECIES: 'master-panel:get-by-platform-species'` in `src/main/ipc/masterPanel.ts` (new file) or folded into `panel.ts`. Returns `MasterPanel | null`.
2. **Preload bridge:** add `masterPanel.getByPlatformAndSpecies(platformId, speciesId)` method.
3. **`selectionStore.ts`:** extend state with `selectedMasterPanel: MasterPanel | null`, set inside `loadPanelsAndAnalytes`. Reset it in `clearSpecies`, `selectSpecies`, `resetAllSelections`.
4. **`calculatorStore.ts`:** remove `volumePerWell: DEFAULT_VOLUME_PER_WELL` initializer; replace with a derived getter `getEffectiveVolumePerWell()`. Logic:
   ```ts
   getEffectiveVolumePerWell: () => {
     const master = useSelectionStore.getState().selectedMasterPanel
     return master?.reagentVolumePerWell ?? DEFAULT_VOLUME_PER_WELL
   }
   ```
   Call `getEffectiveVolumePerWell()` inside `getOutputs` where `volumePerWell` is currently read.
5. **`useCalculator.ts`:** no change to the destructured surface — `volumePerWell` now comes from the getter. Run persistence (`useRunSnapshot.ts` line 100) continues to snapshot whatever value was used — no change needed, the value just flows through.
6. **Files that DON'T change:**
   - `src/renderer/src/lib/calculator.ts` — pure math, accepts `volumePerWell` as input. Zero change.
   - `src/shared/types/calculator.ts` — `volumePerWell` still a `number`, still serializable.
   - `src/main/db/repositories/run.ts` — `runs.volume_per_well` column already exists and is populated from the calculator value at save time. The column stays; it stores the resolved-at-save-time value.

### 5.5 Safety / low-risk observation

- All existing v0.5.x runs were saved with `volumePerWell = 25`. Not touching `runs.volume_per_well` on read means historical data renders identically. This is pure behavior change for NEW calculations when a master panel is in play.
- Strictness decision (spec §Open decision 2) lives here: if the chosen policy is "strict — master panel required for v2-aware flow," add a validation gate. If "graceful fallback," no gate — the fallback constant does the work. The default proposed above is graceful.

---

## 6. AnalyteGrid + Vendor Singles Term

### 6.1 Current state (already in place after Phase 4.1-04)

- `AnalyteGrid.tsx` accepts `sectionLabel: string` prop (see line 5–6 of the file). Renders it as the section `<h4>` header.
- `AnalyteSelectionPanel.tsx` sets it at line 63: `sectionLabel={selectedPanelId && selectedPanel ? selectedPanel.name : 'Analytes'}`.
- So when a premix is selected, the premix name is shown. When no premix is selected, the hard-coded string "Analytes" is shown.

### 6.2 Delta

Replace the fallback string `'Analytes'` with the vendor term from the master panel.

```tsx
// AnalyteSelectionPanel.tsx  — line 63 target:
const singlesLabel = selectedMasterPanel?.vendorSinglesTerm ?? 'Analytes'
...
sectionLabel={selectedPanelId && selectedPanel ? selectedPanel.name : singlesLabel}
```

### 6.3 Where `selectedMasterPanel` comes from

**Pattern: extend `selectionStore` (not `panelStore`).** Rationale:
- `selectionStore` is already the authority on "what is selected right now for this (platform, species)." Adding `selectedMasterPanel` to that store is semantically congruent and reuses the existing load triggers (`loadPanelsAndAnalytes` runs on platform/species change).
- There is no `panelStore` today — `panels` are loaded inside `selectionStore` already. No architectural precedent to resurrect.
- Exposing via the existing `useAnalyteSelection` hook gives `AnalyteSelectionPanel` one-line access to `selectedMasterPanel`.

Concretely:
- `selectionStore.ts`: add `selectedMasterPanel: MasterPanel | null`; inside `loadPanelsAndAnalytes`, await `window.electronAPI.masterPanel.getByPlatformAndSpecies(platformId, speciesId)` in the Promise.all and set the result.
- `useAnalyteSelection` hook: destructure and return `selectedMasterPanel`.
- `AnalyteSelectionPanel`: consume and compute `singlesLabel`.

**Trivial change**, bounded to 3 files. Matches the "trivial" framing in the prompt.

### 6.4 Edge cases

- **No master panel exists for the current (platform, species)** (v1-imported data only): `selectedMasterPanel === null` → `singlesLabel = 'Analytes'`. Generic label, no regression.
- **Master panel exists but `vendorSinglesTerm === null`** (A6 was blank in xlsx): fallback to `'Analytes'` via the `?? 'Analytes'` guard.
- **Premix is selected:** the label shows the premix name, not the vendor term. Matches existing behavior.

---

## 7. Concentration Column Mapping (minor but consequential)

The v1 `analytes` schema has BOTH `premix_conc` and `single_conc`. The v2 xlsx format has one `Concentration` column (col C). The spec doesn't explicitly resolve this.

**Recommendation — treat xlsx column C as the single analyte stock concentration (`single_conc`).** Rationale:
- Spec §File-level shape labels col C as "Concentration (stock conc as multiplier, e.g. 20 = 20×)". "Stock concentration" in v1 vocabulary is `singleConc` — used in the single-addition formula `mastermix_volume / stock_conc`.
- Premixes are 1× ready-to-use (domain rule: no dilution math). So `premix_conc` is either 1.0 or unused in v2 imports.
- On upsert for an analyte imported via v2, set `singleConc = C_value`, `premixConc = 1.0` (or preserve existing v1 value to avoid clobbering). Flag this as an explicit decision for `/gsd-discuss-phase`.

This is a minor schema-semantics item worth surfacing to the roadmap author, not a blocker.

---

## 8. Build Order — Recommended Phase Sequencing

The roadmapper can lift this directly. Each phase is a cut where integration is verifiable in isolation.

### Phase A — Schema + Repository foundation
**Scope:** Add `masterPanels` table + `masterPanelId` columns on existing tables. Generate Drizzle migration 0004. Add `MasterPanel` shared types. Create `masterPanelRepository` with CRUD + `findByPlatformAndSpecies` + `upsertByPlatformAndSpecies`. Extend `panelRepository` and `analyteRepository` with master-panel-aware upsert helpers.
**Verifiable without UI:** Unit-test repos directly; run migration against a test SQLite db; confirm existing rows get `master_panel_id = NULL` and queries still work.
**Blocks:** Everything else — parsers, IPC, UI all reference these types/repos.

### Phase B — Parser + Validator (pure main-process logic)
**Scope:** `src/main/import/masterPanel/{parser,validator}.ts`. Zod schemas for metadata + analyte rows. Blank-stop rules. Case-insensitive platform/species resolution. Cross-tab premix-membership validation.
**Verifiable without UI:** Unit tests with fixture .xlsx files. `ParsedWorkbook` + `ValidationResult` are pure functions of input.
**Depends on:** Phase A (shared types include `MasterPanel`).
**Cross-phase dependency:** Phase B's output shape (`ResolvedTab`) is what Phase C's importer consumes — lock it here so Phase C can be written against a stable interface.

### Phase C — Importer + IPC + Preload bridge
**Scope:** `src/main/import/masterPanel/importer.ts` orchestration (transactional writes using Phase A repos). Add `IMPORT_MASTER_PANEL_FILE` channel, handler, preload method, and `MASTER_PANEL_GET_BY_PLATFORM_SPECIES` read channel for the calculator/AnalyteGrid.
**Verifiable without UI:** Manual IPC call from devtools (`window.electronAPI.import.masterPanelFile()`); inspect DB after.
**Depends on:** Phases A + B.
**Why combined with IPC:** Importer and handler are tightly coupled — importer signature is the handler's return type. No value in splitting.

### Phase D — UI integration (import button + state refresh)
**Scope:** `MasterPanelImportButton.tsx`, mount in `ManagePage.tsx` alongside existing v1 `ImportButton`. Extend `selectionStore` with `selectedMasterPanel` load path. Wire re-fetch on successful import.
**Verifiable end-to-end:** File picker → banner → tables refresh → master panel row appears in DB.
**Depends on:** Phase C.
**Cross-phase dependency:** Phase D ships the import user-flow complete. Vendor-term UI (Phase E) and calculator wiring (Phase F) can then be layered without re-touching import code.

### Phase E — Vendor singles term wiring
**Scope:** 3-file change: extend `useAnalyteSelection` + `AnalyteSelectionPanel` to read `selectedMasterPanel.vendorSinglesTerm`; fall back to `'Analytes'`. Closes D-4.1-05.
**Verifiable:** Re-import a vendor xlsx with A6 set; confirm grid header shows "Simplex"/"Singleplex".
**Depends on:** Phase D (needs `selectedMasterPanel` in the store). Independent of Phase F — can ship in either order after D.

### Phase F — Calculator reagent-volume wiring
**Scope:** Replace `DEFAULT_VOLUME_PER_WELL` init in `calculatorStore` with `getEffectiveVolumePerWell()` derived from `selectionStore.selectedMasterPanel`. Zero change to `calculator.ts` math or `runs.volume_per_well` column.
**Verifiable:** Import a master panel with B4=50; select a panel on that (platform, species); calculator now uses 50 µL/well. Select a v1-only panel; calculator still uses 25. Full custom; still uses 25.
**Depends on:** Phase D.

### Phase G — Verification / UAT
**Scope:** Windows build + smoke test matrix. Same shape as v1.0 HUMAN-UAT: re-import a known-good vendor file, confirm all four user-visible behaviors (imported data appears, vendor term renders, calculator math shifts, re-import is idempotent). Regression-test v1 flat-CSV import still works.
**Depends on:** Phases D, E, F.

### Cross-phase dependency summary

- **A must complete before B, C, D, E, F** (everyone needs the schema + types).
- **B must complete before C** (importer consumes validator output).
- **C must complete before D** (UI button calls the IPC method).
- **D must complete before E and F** (both need `selectedMasterPanel` in the selection store).
- **E and F can parallel** after D. They touch different files (AnalyteGrid path vs calculator path).
- **G comes last** — everything needs to exist to test.

Tighter packaging if desired: A+B as one phase (both main-process-only, both unit-testable), C+D as another (end-to-end import works), E+F as a third (both consume `selectedMasterPanel`), G as UAT. That collapses 7 phases into 4, which matches the spec's preference for small milestones.

---

## 9. Confidence Assessment

| Claim | Confidence | Basis |
|---|---|---|
| IPC registration pattern is additive | HIGH | Read `src/main/ipc/index.ts` and `import.ts` directly |
| Preload bridge is `contextBridge.exposeInMainWorld('electronAPI', ...)` | HIGH | Read `src/preload/index.ts` |
| Drizzle migrations auto-apply on startup | HIGH | Read `src/main/db/migrate.ts` |
| `platforms` table has no `volumePerWell` column | HIGH | Read `schema.ts` — only `stockConcentration` |
| `DEFAULT_VOLUME_PER_WELL = 25` is the "platform default" today | HIGH | Traced via grep — it's the init value in `calculatorStore` |
| `AnalyteGrid` already accepts `sectionLabel` prop | HIGH | Read `AnalyteGrid.tsx` — line 5–6 |
| `selectionStore` is the right home for `selectedMasterPanel` | HIGH | No separate `panelStore` exists; `selectionStore` already handles panel+analyte loading |
| Concentration column mapping ambiguity | MEDIUM | Spec labels col C "Concentration"; existing schema splits into premix/single. Flagged for discuss-phase. |
| Drizzle-kit will produce a clean ALTER TABLE ADD COLUMN | MEDIUM | SQLite supports this for nullable columns; drizzle-kit v0.29+ generates it. Verify by running the generator. |

---

## Sources

- `src/main/db/schema.ts` — Drizzle schema (direct read)
- `src/main/db/migrate.ts` — migration loader (direct read)
- `src/main/db/repositories/panel.ts` — v1 repository pattern (direct read)
- `src/main/ipc/index.ts`, `import.ts`, `panel.ts` — IPC registration pattern (direct read)
- `src/main/import/{parser,validator,importer}.ts` — v1 import pipeline (direct read)
- `src/preload/index.ts` — contextBridge exposure (direct read)
- `src/renderer/src/stores/selectionStore.ts`, `calculatorStore.ts`, `platformStore.ts` — Zustand store patterns (direct read)
- `src/renderer/src/features/selection/components/AnalyteGrid.tsx`, `AnalyteSelectionPanel.tsx` — UI integration point (direct read)
- `src/renderer/src/features/import/ImportButton.tsx` — banner/toast pattern (direct read)
- `src/renderer/src/features/manage/ManagePage.tsx`, `PanelList.tsx` — Manage page layout (direct read)
- `src/shared/constants/channels.ts`, `calculator.ts` — channel + constant definitions (direct read)
- `.planning/PANEL-UPLOAD-V2-SPEC.md` — v2 specification (authoritative)

---

*Architecture delta for: Immunoplex Assay Calculator v2.0 — Panel XLSX Upload + Master-Panel Data Model*
*Researched: 2026-04-23 — source of truth: direct reads of current codebase on branch `dev/v1-01`*
