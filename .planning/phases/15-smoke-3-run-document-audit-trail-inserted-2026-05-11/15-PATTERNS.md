# Phase 15: Smoke 3 — Run Document Audit Trail — Pattern Map

**Mapped:** 2026-05-12
**Files analyzed:** 15 (NEW: 7, MODIFIED: 11; some IPC/preload entries cluster into single touchpoints)
**Analogs found:** 15 / 15 (every file has a strong, recent in-repo analog — Phase 14-08 + Phase 13 + Phase 12 + Phase 6 ship the patterns Phase 15 follows; no greenfield)

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| `drizzle/migrations/0009_<name>.sql` | migration (drizzle-generated SQL) | DDL — `ALTER TABLE` against `runs` | `drizzle/migrations/0008_runs_setups_and_old_reagents.sql` | exact (same table, same `ALTER TABLE … ADD …;--> statement-breakpoint` shape) |
| `src/main/db/schema.ts` (MOD) | schema (Drizzle DSL table def) | DDL — Drizzle column declarations | `runs` table lines 196-207 (Phase 6 + 14-08 columns) | exact |
| `src/shared/types/run.ts` (MOD) | shared type (TS interface) | type — `RunRecord` + `RunCreate` extension | lines 25-47, 81-94 (`numberOfSetups`/`oldBeads`/`oldAntibodies` Phase 14-04) | exact |
| `src/shared/validation/run.ts` (MOD) | zod schema | request-response validation at IPC boundary | `runCreateSchema` lines 27-37 (Phase 12 + 14 numeric defaults) | exact |
| `src/main/db/repositories/run.ts` (MOD) | repository (CRUD) | request-response — `runRepository.create/update` extension | lines 49-87 (create) + 121-164 (update) Phase 14-08 conditional-write pattern | exact |
| `src/main/db/repositories/masterPanel.ts` (MOD) | repository (read method) | request-response — new `getByIdWithReagents()` composed read | `masterPanelRepository.getById` line 160-164 + composes `masterPanelReagentRepository.findByMasterPanelId` line 32-39 | role-match (compose, not copy) |
| `src/shared/constants/channels.ts` (MOD) | shared constant (IPC channel name) | constant addition | existing `MASTER_PANEL_*` would be ideal but ABSENT — use `PANEL_*` shape (lines 12-17) | role-match |
| `src/main/ipc/panel.ts` (MOD — extend) | IPC handler (main-process) | request-response — `ipcMain.handle` for new channel | `panelRepository.getWithAnalytes` handler at panel.ts:26-31 | exact |
| `src/preload/index.ts` (MOD) | preload bridge | request-response — `contextBridge.exposeInMainWorld` extension | `panel.getWithAnalytes` line 20-21 | exact |
| `src/renderer/src/features/run/hooks/useRunSnapshot.ts` (MOD — sync→async) | renderer hook + builder | event-driven snapshot capture (Save click → IPC fetch → assemble payload) | existing buildRunSnapshot lines 46-129 (Phase 12-04 + 14-04 extensions) | exact (extension, with sync→async refactor) |
| `src/renderer/src/stores/runStore.ts` (MOD — single line) | renderer store | event-driven — `await buildRunSnapshot` callsite | line 56 — CHANGE `const payload = buildRunSnapshot(metadata)` → `const payload = await buildRunSnapshot(metadata)` | exact |
| `src/renderer/src/features/calculator/components/CalculatorForm.tsx` (MOD) + `src/renderer/src/stores/calculatorStore.ts` (MOD — risk item) | renderer store + form (lift override-accepted into store) | state flow — local component state → store state → snapshot | `capPaused` field + `setCapPaused` setter at calculatorStore.ts:74,84,109,231 | role-match (mirror `capPaused` for two new boolean flags) |
| `src/renderer/src/features/run/components/FinalizedRunHeader.tsx` (MOD) | renderer component (display) | render-from-record | `<dl>` row pattern lines 70-138 (Phase 4) | exact (single new row insertion) |
| `src/renderer/src/features/run/components/FinalizedRunView.tsx` (MOD) | renderer component (composition) | render composition | composition pattern lines 170-240 (Phase 4) | exact (insert two new components into the JSX tree) |
| `src/renderer/src/features/run/components/AuditTrailSection.tsx` (NEW) | renderer component (display) | render-from-record + pure derivation (`resolveDiluent`, `ceilToTenthML`) | `FinalizedRunHeader` `<dl>` block lines 64-148 | exact (4 reuses of the same `<dl>` shell) |
| `src/renderer/src/features/run/components/HistoricalRunBanner.tsx` (NEW) | renderer component (display) | conditional render-from-record | `validationError` red banner at CalculatorForm.tsx:385-389 | role-match (same banner shape, amber instead of red) |
| `src/renderer/src/features/run/lib/auditTrail.ts` (NEW) | pure helper module | transform — `computePeVolume(finalVolumeML, sapeConcentration)` + `deriveDiluentBranchLabel(diluentResult, panelName)` | `resolveDiluent` at diluentResolver.ts:41 + `ceilToTenthML` at decimal.ts:44 | exact (pure-fn pattern, decimal.js usage) |
| `src/renderer/src/features/run/lib/__tests__/auditTrail.test.ts` (NEW) | test (vitest) | unit | calculator.integration.test.ts Group A-L pattern (lines 41-225) | exact |
| `src/renderer/src/features/run/hooks/__tests__/useRunSnapshot.test.ts` (NEW) | test (vitest) | unit (with IPC mock) | `runStore.loadRun` cascade tests in calculator.integration.test.ts Group G/J (lines 681-846) | role-match (mock `window.electronAPI` similarly) |
| `src/main/db/__tests__/migration.test.ts` (MOD) | test (vitest) | unit (DDL inspection) | Phase 14-08 column-presence describe block lines 369-417 | exact |
| `src/main/db/repositories/__tests__/run.test.ts` (MOD) | test (vitest) | unit (round-trip persistence) | Phase 14-08 T-1..T-6 round-trip pattern lines 19-175 | exact |
| `src/renderer/src/lib/__tests__/calculator.integration.test.ts` (MOD) | test (vitest) | unit (PE math edge cases) | existing Group A-L describe blocks (next free letter = M) | exact |

## Pattern Assignments

### `drizzle/migrations/0009_<name>.sql` (NEW — drizzle-generated)

**Analog:** `drizzle/migrations/0008_runs_setups_and_old_reagents.sql`

**Full file pattern (Phase 14-08, all 3 lines):**
```sql
ALTER TABLE `runs` ADD `number_of_setups` real DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE `runs` ADD `old_beads` real DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `runs` ADD `old_antibodies` real DEFAULT 0 NOT NULL;
```

**Phase 15 expected output (10 ALTER TABLE statements):**
- 7 columns NULLABLE no default (snake_case names): `sape_name text`, `sape_concentration real`, `beads_diluent text`, `antibodies_diluent text`, `beads_volume_per_well real`, `antibodies_volume_per_well real`, `premix_concentration real`, `calculation_rules_version text`
- 2 boolean columns NOT NULL DEFAULT false: `old_beads_override integer NOT NULL DEFAULT false` (mirror `is_offline_save` from migration 0005), `old_antibodies_override integer NOT NULL DEFAULT false`

**Generation method (do NOT hand-write):** Edit `src/main/db/schema.ts` first; run `npm run db:generate`; commit emitted file. Filename is autogenerated.

---

### `src/main/db/schema.ts` (MODIFIED — runs table, append after line 207)

**Analog:** Same file, lines 196-207 (Phase 6 `machineName`/`isOfflineSave` + Phase 14-08 `numberOfSetups`/`oldBeads`/`oldAntibodies`).

**Existing pattern to copy** (lines 196-207):
```ts
  // Phase 6: machine provenance for D-02 conflict display
  machineName: text('machine_name'), // os.hostname() at save time; null for pre-Phase-6 rows
  isOfflineSave: integer('is_offline_save', { mode: 'boolean' }).notNull().default(false),
  // Phase 14 Plan 08 — DB persistence for the three Smoke-3 fields …
  numberOfSetups: real('number_of_setups').notNull().default(1),
  oldBeads: real('old_beads').notNull().default(0),
  oldAntibodies: real('old_antibodies').notNull().default(0)
```

**Phase 15 columns to append (10) — verbatim Drizzle DSL:**
```ts
  // Phase 15 — SMK3-12/15/16/17 audit-trail snapshot fields. All 8
  // master-panel-derived fields are nullable so pre-Phase-15 rows tolerate
  // the migration without backfill (D-15-04). The 2 override booleans
  // mirror Phase 6 isOfflineSave shape with default false.
  sapeName: text('sape_name'),                                                   // SMK3-12; from master_panels.sape_name
  sapeConcentration: real('sape_concentration'),                                 // SMK3-17; from master_panel_reagents where reagent_kind='sape'
  beadsDiluent: text('beads_diluent'),                                           // SMK3-DIL-01 verbatim; from master_panel_reagents
  antibodiesDiluent: text('antibodies_diluent'),                                 // SMK3-DIL-01 verbatim; from master_panel_reagents
  beadsVolumePerWell: real('beads_volume_per_well'),                             // from master_panel_reagents
  antibodiesVolumePerWell: real('antibodies_volume_per_well'),                   // from master_panel_reagents
  premixConcentration: real('premix_concentration'),                             // selectionStore.selectedPanel.subPanelConc; null for custom
  oldBeadsOverride: integer('old_beads_override', { mode: 'boolean' }).notNull().default(false),
  oldAntibodiesOverride: integer('old_antibodies_override', { mode: 'boolean' }).notNull().default(false),
  calculationRulesVersion: text('calculation_rules_version')                     // 'smoke3' for new saves; NULL for pre-Phase-15
```

**Critical:** keep this block as the LAST 10 columns of the `runs` table object literal so the closing `})` at line 208 stays the closing paren.

---

### `src/shared/types/run.ts` (MODIFIED — RunRecord + RunCreate)

**Analog:** Same file. Phase 14-04 comment+field block at lines 25-47 (`RunRecord`) and lines 81-94 (`RunCreate`).

**Existing comment template (Phase 14, lines 35-42):**
```ts
  /**
   * Smoke 3 SMK3-02 input: operator-entered Old Beads volume in mL.
   * Default 0; optional — pre-Phase-14 saved runs lack this field and
   * round-trip with `?? 0` defaulting (equivalent to v1.0 behavior).
   * Stored as the raw typed value per D-08; floor-rounded at consumption
   * inside calculatorStore.getOutputs (SMK3-16 snapshot fidelity).
   */
  oldBeads?: number
```

**Phase 15 — insert 10 fields into BOTH `RunRecord` (after line 47, before `hamilton`) AND `RunCreate` (after line 94, before `hamilton`).** Mirror this comment style; keep all fields optional + nullable for the 8 master-panel-derived ones, optional + boolean for the 2 overrides, optional + string for the marker.

```ts
  // Phase 15 — SMK3-12/15/16/17 audit-trail snapshot fields. See PATTERNS.md
  // pattern assignments / RESEARCH §Pattern 1 for column nullability rationale.
  sapeName?: string | null
  sapeConcentration?: number | null
  beadsDiluent?: string | null
  antibodiesDiluent?: string | null
  beadsVolumePerWell?: number | null
  antibodiesVolumePerWell?: number | null
  premixConcentration?: number | null
  oldBeadsOverride?: boolean
  oldAntibodiesOverride?: boolean
  calculationRulesVersion?: string | null
```

---

### `src/shared/validation/run.ts` (MODIFIED — zod schema)

**Analog:** Same file, lines 27-37 (Phase 12 `numberOfSetups` + Phase 14 `oldBeads`/`oldAntibodies` defaults).

**Existing pattern (lines 27-37):**
```ts
    numberOfSetups: z.number().int().min(1).default(1),
    oldBeads: z.number().nonnegative().default(0),
    oldAntibodies: z.number().nonnegative().default(0),
```

**Phase 15 additions (insert after `oldAntibodies`):**
```ts
    // Phase 15 SMK3-12/15/16/17 — all optional + nullable; defaults preserve
    // pre-Phase-15 round-trip semantics (no field present → null/false).
    sapeName: z.string().nullable().optional(),
    sapeConcentration: z.number().nullable().optional(),
    beadsDiluent: z.string().nullable().optional(),
    antibodiesDiluent: z.string().nullable().optional(),
    beadsVolumePerWell: z.number().nullable().optional(),
    antibodiesVolumePerWell: z.number().nullable().optional(),
    premixConcentration: z.number().nullable().optional(),
    oldBeadsOverride: z.boolean().optional().default(false),
    oldAntibodiesOverride: z.boolean().optional().default(false),
    calculationRulesVersion: z.string().nullable().optional(),
```

---

### `src/main/db/repositories/run.ts` (MODIFIED — runRepository.create + update)

**Analog:** Same file. `create()` lines 41-104; `update()` lines 112-181. Phase 14-08 conditional-write idiom at lines 85-87 (create) and 162-164 (update).

**Existing CREATE pattern (lines 85-87):**
```ts
      if (data.numberOfSetups !== undefined) insertValues.numberOfSetups = data.numberOfSetups
      if (data.oldBeads !== undefined) insertValues.oldBeads = data.oldBeads
      if (data.oldAntibodies !== undefined) insertValues.oldAntibodies = data.oldAntibodies
```

**Phase 15 CREATE — append after line 87 (10 conditional writes):**
```ts
      // Phase 15 SMK3-12/15/16/17 — write the 10 audit-trail snapshot fields
      // only when the caller supplied them; absent → DB DEFAULT (NULL for
      // master-panel-derived fields, false for overrides) preserves pre-Phase-15
      // payload round-trip.
      if (data.sapeName !== undefined) insertValues.sapeName = data.sapeName
      if (data.sapeConcentration !== undefined) insertValues.sapeConcentration = data.sapeConcentration
      if (data.beadsDiluent !== undefined) insertValues.beadsDiluent = data.beadsDiluent
      if (data.antibodiesDiluent !== undefined) insertValues.antibodiesDiluent = data.antibodiesDiluent
      if (data.beadsVolumePerWell !== undefined) insertValues.beadsVolumePerWell = data.beadsVolumePerWell
      if (data.antibodiesVolumePerWell !== undefined) insertValues.antibodiesVolumePerWell = data.antibodiesVolumePerWell
      if (data.premixConcentration !== undefined) insertValues.premixConcentration = data.premixConcentration
      if (data.oldBeadsOverride !== undefined) insertValues.oldBeadsOverride = data.oldBeadsOverride
      if (data.oldAntibodiesOverride !== undefined) insertValues.oldAntibodiesOverride = data.oldAntibodiesOverride
      if (data.calculationRulesVersion !== undefined) insertValues.calculationRulesVersion = data.calculationRulesVersion
```

**Existing UPDATE type-extension pattern (lines 151-157):**
```ts
      const setWithProvenance: typeof baseSet & {
        machineName?: string | null
        isOfflineSave?: boolean
        numberOfSetups?: number
        oldBeads?: number
        oldAntibodies?: number
      } = { ...baseSet }
```

**Phase 15 UPDATE — extend the type intersection AND add 10 conditional writes after line 164.** Append these to the type literal:
```ts
        // Phase 15 audit-trail snapshot fields
        sapeName?: string | null
        sapeConcentration?: number | null
        beadsDiluent?: string | null
        antibodiesDiluent?: string | null
        beadsVolumePerWell?: number | null
        antibodiesVolumePerWell?: number | null
        premixConcentration?: number | null
        oldBeadsOverride?: boolean
        oldAntibodiesOverride?: boolean
        calculationRulesVersion?: string | null
```

And mirror the 10 `if (data.X !== undefined) setWithProvenance.X = data.X` lines after the existing line 164.

---

### `src/main/db/repositories/masterPanel.ts` (MODIFIED — add `getByIdWithReagents`)

**Analog:** Same file `getById` at lines 160-164:
```ts
  getById(id: string): MasterPanel | null {
    const db = getDatabase()
    const result = db.select().from(masterPanels).where(eq(masterPanels.id, id)).get()
    return (result as MasterPanel | undefined) ?? null
  }
```

Plus `masterPanelReagentRepository.findByMasterPanelId` at `masterPanelReagent.ts:32-39`:
```ts
  findByMasterPanelId(masterPanelId: string): MasterPanelReagent[] {
    const db = getDatabase()
    return db
      .select()
      .from(masterPanelReagents)
      .where(eq(masterPanelReagents.masterPanelId, masterPanelId))
      .all() as MasterPanelReagent[]
  },
```

**Phase 15 NEW METHOD — append to `masterPanelRepository` object (after the `getById` closing brace, before the closing `}` at line 165):**
```ts
  /**
   * Phase 15 SMK3-15/16: composed read for the audit-trail snapshot.
   * Returns the master_panels row plus its master_panel_reagents children
   * (0..3 rows: beads, antibodies, sape) in a single call so the renderer's
   * buildRunSnapshot can pack the 6 master-panel-derived fields onto the
   * runs row at save time. Returns null when the master_panel id is unknown
   * (defensive — should not happen in normal flow because selectionStore
   * carries a valid masterPanelId post-selectPanel).
   */
  getByIdWithReagents(id: string): {
    masterPanel: MasterPanel
    reagents: MasterPanelReagent[]
  } | null {
    const masterPanel = masterPanelRepository.getById(id)
    if (!masterPanel) return null
    const reagents = masterPanelReagentRepository.findByMasterPanelId(id)
    return { masterPanel, reagents }
  }
```

**Imports to add at top of file:**
```ts
import { masterPanelReagentRepository } from './masterPanelReagent'
import type { MasterPanelReagent } from '../../../shared/types/masterPanelReagent'
```

---

### `src/shared/constants/channels.ts` (MODIFIED — add 1 channel)

**Analog:** Same file, lines 12-17 (Panel block):
```ts
  // Panel
  PANEL_GET_BY_PLATFORM_SPECIES: 'panel:get-by-platform-species',
  PANEL_GET_WITH_ANALYTES: 'panel:get-with-analytes',
```

**Phase 15 — insert between `PANEL_*` block (line 17) and `ANALYTE_*` block (line 19):**
```ts
  // Master Panel (Phase 15 — save-time snapshot fetch for audit trail)
  MASTER_PANEL_GET_WITH_REAGENTS: 'master-panel:get-with-reagents',
```

---

### `src/main/ipc/panel.ts` (MODIFIED — extend with master-panel handler)

**Analog:** Same file, lines 26-31 (`PANEL_GET_WITH_ANALYTES` handler):
```ts
  ipcMain.handle(IPC_CHANNELS.PANEL_GET_WITH_ANALYTES, async (_, panelId: unknown) => {
    if (typeof panelId !== 'string') {
      throw new Error('Invalid panel ID')
    }
    return panelRepository.getWithAnalytes(panelId)
  })
```

**Phase 15 — add new handler after the existing PANEL_REMOVE_ANALYTE handler (line 60), before the closing brace of `registerPanelHandlers`:**
```ts
  // Phase 15 SMK3-15/16: save-time snapshot fetch — returns master_panels row +
  // master_panel_reagents children for the renderer to denormalize onto the
  // runs row at save time. Read-only; no write path.
  ipcMain.handle(IPC_CHANNELS.MASTER_PANEL_GET_WITH_REAGENTS, async (_, masterPanelId: unknown) => {
    if (typeof masterPanelId !== 'string') {
      throw new Error('Invalid master panel ID')
    }
    return masterPanelRepository.getByIdWithReagents(masterPanelId)
  })
```

**Imports to add at top of file:**
```ts
import { masterPanelRepository } from '../db/repositories/masterPanel'
```

(Decision: extend `panel.ts` rather than create a new `masterPanel.ts` IPC file — single new handler, related domain, no `index.ts` registration churn. RESEARCH.md §Q1 explicitly says either is fine; planner picked the lower-friction path.)

---

### `src/preload/index.ts` (MODIFIED — add masterPanel.getWithReagents bridge)

**Analog:** Same file, lines 17-28 (Panel block):
```ts
  panel: {
    getByPlatformAndSpecies: (platformId: string, speciesId: string) =>
      ipcRenderer.invoke(IPC_CHANNELS.PANEL_GET_BY_PLATFORM_SPECIES, platformId, speciesId),
    getWithAnalytes: (panelId: string) =>
      ipcRenderer.invoke(IPC_CHANNELS.PANEL_GET_WITH_ANALYTES, panelId),
    update: (data: unknown) => ipcRenderer.invoke(IPC_CHANNELS.PANEL_UPDATE, data),
    delete: (id: string) => ipcRenderer.invoke(IPC_CHANNELS.PANEL_DELETE, id),
    addAnalyte: (panelId: string, analyteId: string) =>
      ipcRenderer.invoke(IPC_CHANNELS.PANEL_ADD_ANALYTE, panelId, analyteId),
    removeAnalyte: (panelId: string, analyteId: string) =>
      ipcRenderer.invoke(IPC_CHANNELS.PANEL_REMOVE_ANALYTE, panelId, analyteId)
  },
```

**Phase 15 — insert a new top-level `masterPanel:` block after `panel:` (line 28):**
```ts
  masterPanel: {
    // Phase 15 SMK3-15/16: save-time snapshot fetch
    getWithReagents: (masterPanelId: string) =>
      ipcRenderer.invoke(IPC_CHANNELS.MASTER_PANEL_GET_WITH_REAGENTS, masterPanelId)
  },
```

**Also update the `electronAPI` ambient type declaration** (search the renderer for `interface ElectronAPI` or `window.electronAPI` typing — typically lives in a `.d.ts` file or in `src/renderer/src/env.d.ts`; planner to verify and add `masterPanel: { getWithReagents(id: string): Promise<...> }`).

---

### `src/renderer/src/features/run/hooks/useRunSnapshot.ts` (MODIFIED — sync→async + 10 new fields)

**Analog:** Same file. Phase 14-04 extension pattern at lines 109-117 (packing `numberOfSetups`/`oldBeads`/`oldAntibodies` into the returned `RunCreate`):
```ts
    deadVolume: calculator.numberOfSetups * DEAD_VOLUME_PER_SETUP_UL,
    numberOfSetups: calculator.numberOfSetups,
    // Smoke 3 SMK3-02/03 + SMK3-16: persist raw typed values per D-08 …
    oldBeads: calculator.oldBeads,
    oldAntibodies: calculator.oldAntibodies,
```

**Existing signature (line 46) — CHANGE THIS:**
```ts
export function buildRunSnapshot(metadata: MetadataFields): RunCreate | { error: string }
```

**Phase 15 NEW signature:**
```ts
export async function buildRunSnapshot(
  metadata: MetadataFields
): Promise<RunCreate | { error: string }>
```

**Phase 15 NEW snapshot-fetch block — insert AFTER the existing sync gates (line 82) and BEFORE the `const singleAnalyteIds = …` line (84):**
```ts
  // Phase 15 SMK3-15/16: snapshot-at-save fetch of master-panel + reagents.
  // Skipped when no premix selected (custom assay) — leaves all 6 master-panel
  // fields null and the audit trail renders `—` (D-15-12). Premix concentration
  // comes from selectionStore.selectedPanel.subPanelConc directly (NO IPC needed
  // — already in renderer state post-selectPanel; verified in RESEARCH §Q2).
  const premixConcentration = selection.selectedPanel?.subPanelConc ?? null

  let sapeName: string | null = null
  let sapeConcentration: number | null = null
  let beadsDiluent: string | null = null
  let antibodiesDiluent: string | null = null
  let beadsVolumePerWell: number | null = null
  let antibodiesVolumePerWell: number | null = null

  const masterPanelId = selection.selectedPanel?.masterPanelId ?? null
  if (masterPanelId) {
    try {
      const result = await window.electronAPI.masterPanel.getWithReagents(masterPanelId)
      if (result) {
        sapeName = result.masterPanel.sapeName
        const beads = result.reagents.find((r) => r.reagentKind === 'beads')
        const ab    = result.reagents.find((r) => r.reagentKind === 'antibodies')
        const sape  = result.reagents.find((r) => r.reagentKind === 'sape')
        beadsDiluent = beads?.diluent ?? null
        antibodiesDiluent = ab?.diluent ?? null
        beadsVolumePerWell = beads?.volumePerWell ?? null
        antibodiesVolumePerWell = ab?.volumePerWell ?? null
        sapeConcentration = sape?.concentration ?? null
      }
    } catch (e) {
      // Surface the failure via the existing { error } convention so
      // saveCurrentRun.set({ saveStatus: 'error' }) lights up the UI.
      return { error: `Failed to snapshot master panel: ${(e as Error).message}` }
    }
  }
```

**Phase 15 — append 10 new fields to the returned `RunCreate` object literal (after line 127 `singleAnalyteIds`):**
```ts
    singleAnalyteIds,
    // Phase 15 SMK3-12/15/16/17 audit-trail snapshot fields
    sapeName,
    sapeConcentration,
    beadsDiluent,
    antibodiesDiluent,
    beadsVolumePerWell,
    antibodiesVolumePerWell,
    premixConcentration,
    oldBeadsOverride: calculator.oldBeadsOverride,         // requires lifting from CalculatorForm into store — see Open Risk §1
    oldAntibodiesOverride: calculator.oldAntibodiesOverride,
    calculationRulesVersion: 'smoke3'
```

**`useRunSnapshot` hook surface (lines 138-164) — split sync/async:**
- The `useMemo` at lines 149-155 calls `buildRunSnapshot` synchronously to drive `canSave`/`reason`. With Phase 15's async signature, this breaks. **Fix:** factor the sync gates out of `buildRunSnapshot` into a private `validateSnapshotPreconditions(metadata): { error: string } | null` helper. `useRunSnapshot.useMemo` calls `validateSnapshotPreconditions` (sync, no IPC, no master-panel fetch). The exposed `build` function — and `runStore.saveCurrentRun` — call the full async `buildRunSnapshot`.

---

### `src/renderer/src/stores/runStore.ts` (MODIFIED — single line)

**Analog:** Same file, line 56 (existing `saveCurrentRun` callsite):
```ts
  saveCurrentRun: async (metadata) => {
    set({ saveStatus: 'saving', error: null })
    const payload = buildRunSnapshot(metadata)
```

**Phase 15 CHANGE — line 56 only:**
```ts
    const payload = await buildRunSnapshot(metadata)
```

The rest of `saveCurrentRun` (lines 57-86) requires no edits — the `'error' in payload` discriminant at line 57 already handles the union return type identically.

---

### `src/renderer/src/stores/calculatorStore.ts` (MODIFIED — lift overrides into store)

**Analog:** Same file, `capPaused` field + setter at lines 74, 84-85, 109, 231:

**Existing pattern (verbatim):**
```ts
// State (line 74):
  capPaused: boolean

// Action surface (lines 84-85):
  /** Smoke 3 D-10: UI-driven cap-pause toggle. See capPaused field above. */
  setCapPaused: (paused: boolean) => void

// Initial state (line 109):
  capPaused: false

// Implementation (line 231):
  setCapPaused: (paused: boolean) => {
    set({ capPaused: paused })
```

**Phase 15 — mirror this for two new boolean flags:**
```ts
// Add to State interface (after capPaused line 74):
  /**
   * Phase 15 D-15-08 (deferred from Phase 14): operator accepted the 20%-cap
   * override for the corresponding old-reagent input at modal-confirm time.
   * Snapshotted by buildRunSnapshot onto the runs row so the audit trail can
   * render the OVERRIDE chip on reopen. Lifted from CalculatorForm.tsx local
   * state into the store specifically because buildRunSnapshot needs to read
   * it at save time; CalculatorForm.tsx setBeadsOverrideAccepted / setAntibodies-
   * OverrideAccepted now call the store setters in addition to (or instead of)
   * local useState.
   */
  oldBeadsOverride: boolean
  oldAntibodiesOverride: boolean

// Add to Actions interface:
  setOldBeadsOverride: (overridden: boolean) => void
  setOldAntibodiesOverride: (overridden: boolean) => void

// Add to initialState:
  oldBeadsOverride: false,
  oldAntibodiesOverride: false,

// Add implementations (mirror setCapPaused at line 231):
  setOldBeadsOverride: (overridden: boolean) => set({ oldBeadsOverride: overridden }),
  setOldAntibodiesOverride: (overridden: boolean) => set({ oldAntibodiesOverride: overridden }),
```

**`reset()` action — append to the existing reset implementation:** ensure both new flags reset to `false` (the `initialState` spread already covers this if the existing reset uses `set({ ...initialState })`).

---

### `src/renderer/src/features/calculator/components/CalculatorForm.tsx` (MODIFIED — wire local state → store)

**Analog:** Same file, lines 75-76:
```ts
  const [beadsOverrideAccepted, setBeadsOverrideAccepted] = useState(false)
  const [antibodiesOverrideAccepted, setAntibodiesOverrideAccepted] = useState(false)
```

**Phase 15 — in `handleOverride` (lines 174-176) and the two `if (decision.resetOverride) setBeadsOverrideAccepted(false)` lines (146, 165), additionally call the new store setters:**
```ts
// In handleOverride (line 174):
  const handleOverride = () => {
    if (activeModal === 'beads') {
      setBeadsOverrideAccepted(true)
      useCalculatorStore.getState().setOldBeadsOverride(true)
    } else if (activeModal === 'antibodies') {
      setAntibodiesOverrideAccepted(true)
      useCalculatorStore.getState().setOldAntibodiesOverride(true)
    }
    // … existing close-modal logic …
  }

// In each "decision.resetOverride" branch (lines 146, 165):
    if (decision.resetOverride) {
      setBeadsOverrideAccepted(false)
      useCalculatorStore.getState().setOldBeadsOverride(false)  // mirror for antibodies
    }
```

(Discretion: alternatively delete the local `useState` entirely and read directly from the store via `useCalculator()` selector. Planner picks based on diff size — the dual-write approach minimises blast radius on Phase 14's tests.)

---

### `src/renderer/src/features/run/components/FinalizedRunHeader.tsx` (MODIFIED — single new `<dl>` row)

**Analog:** Same file, lines 70-138 — the 2-column `<dl>` metadata grid. Specifically the Panel row at lines 94-97:
```tsx
        <div className="flex justify-between gap-4 border-b border-gray-100 py-1">
          <dt className="font-medium text-[var(--color-muted)]">Panel</dt>
          <dd className="text-[var(--color-foreground)]">{panelName}</dd>
        </div>
```

**Phase 15 — insert new SAPE Name row immediately after the Panel row (line 97, before line 98 Sample Type):**
```tsx
        <div className="flex justify-between gap-4 border-b border-gray-100 py-1">
          <dt className="font-medium text-[var(--color-muted)]">SAPE Name</dt>
          <dd className="text-[var(--color-foreground)]">{record.sapeName ?? '—'}</dd>
        </div>
```

No new imports, no new store reads — `record` already in scope from `currentRun` at line 36.

---

### `src/renderer/src/features/run/components/FinalizedRunView.tsx` (MODIFIED — composition insertion)

**Analog:** Same file, lines 170-185 (composition between header + actions row):
```tsx
  return (
    <div className="space-y-6">
      {/* Header — metadata summary */}
      <FinalizedRunHeader />

      {/* Actions row — Print + Start New Run. Hidden on print. */}
      <div className="flex items-center gap-3 print:hidden">
```

**Phase 15 — insert two new components between `<FinalizedRunHeader />` (line 173) and the `<div ... print:hidden>` (line 176):**
```tsx
      {/* Header — metadata summary */}
      <FinalizedRunHeader />

      {/* Phase 15 SMK3-16: pre-Phase-15 advisory banner (rendered conditionally) */}
      <HistoricalRunBanner />

      {/* Phase 15 SMK3-15: Calculation Audit Trail — Inputs / Intermediates /
          Outputs / Diluent decision blocks. Reads exclusively from RunRecord
          (D-15-01); pure render-from-record. */}
      <AuditTrailSection />

      {/* Actions row — Print + Start New Run. Hidden on print. */}
      <div className="flex items-center gap-3 print:hidden">
```

**Imports to add at top:**
```ts
import { HistoricalRunBanner } from './HistoricalRunBanner'
import { AuditTrailSection } from './AuditTrailSection'
```

---

### `src/renderer/src/features/run/components/AuditTrailSection.tsx` (NEW)

**Analog:** `FinalizedRunHeader.tsx` lines 64-148 — same `<dl className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-2 text-sm">` shell, repeated 4 times (one per block).

**Imports pattern (mirror FinalizedRunHeader lines 1-4):**
```ts
import { useRunStore } from '../../../stores/runStore'
import { useSelectionStore } from '../../../stores/selectionStore'
import { computePeVolumeML, deriveDiluentBranchLabel } from '../lib/auditTrail'
import { resolveDiluent } from '../../../lib/diluentResolver'
```

**Component skeleton (4 blocks; reuse the row pattern from FinalizedRunHeader):**
```tsx
export function AuditTrailSection(): JSX.Element | null {
  const currentRun = useRunStore((s) => s.runs.find((r) => r.id === s.currentRunId) ?? null)
  const panels = useSelectionStore((s) => s.panels)
  if (!currentRun) return null
  const r = currentRun
  const panelName = r.panelId ? (panels.find((p) => p.id === r.panelId)?.name ?? r.panelId) : null

  // PE volume: finalVolume(mL) ÷ (sapeConcentration ?? 1), ceiling-rounded to 0.1 mL.
  // finalVolume(mL) = (sampleCount × volumePerWell + deadVolume) / 1000 — but Phase 15 D-15-13
  // says use the ceiling-rounded total. Easiest source: recompute via createCalculatorInputs +
  // calculateVolumes from the snapshot, OR persist an additional finalVolumeML if Plan author
  // prefers (NOT in scope per CONTEXT Discretion). Recommended: compute inline from
  // RunRecord fields using the same shared/constants/calculator helpers PrepSheet uses.
  const peVolumeML = computePeVolumeML(/* finalVolumeML */, r.sapeConcentration ?? null)

  const diluent = resolveDiluent({
    selectedPremixes:
      r.premixConcentration !== null && r.premixConcentration !== undefined && panelName
        ? [{ name: panelName, concentration: r.premixConcentration }]
        : [],
    valuesTable:
      r.beadsDiluent !== null && r.beadsDiluent !== undefined &&
      r.antibodiesDiluent !== null && r.antibodiesDiluent !== undefined
        ? { beads: r.beadsDiluent, antibodies: r.antibodiesDiluent }
        : undefined
  })
  const branchLabel = deriveDiluentBranchLabel(diluent, r.premixConcentration ?? null)

  // Em-dash helper (D-15-12)
  const dash = (v: unknown): string =>
    v === null || v === undefined ? '—' : String(v)

  return (
    <section className="space-y-6">
      <h2 className="text-xl font-semibold text-[var(--color-foreground)]">Calculation Audit Trail</h2>

      {/* 1. Inputs */}
      <div>
        <h3 className="text-lg font-semibold mb-2 text-[var(--color-foreground)]">1. Inputs</h3>
        <dl className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-2 text-sm">
          {/* Use the same flex-justify-between row pattern as FinalizedRunHeader lines 71-74:
              <div className="flex justify-between gap-4 border-b border-gray-100 py-1">
                <dt className="font-medium text-[var(--color-muted)]">{label}</dt>
                <dd className="text-[var(--color-foreground)]">{value}</dd>
              </div>
              Rows per CONTEXT.md <specifics> worked example. */}
          <div className="flex justify-between gap-4 border-b border-gray-100 py-1">
            <dt className="font-medium text-[var(--color-muted)]">Old beads</dt>
            <dd className="text-[var(--color-foreground)]">
              {dash(r.oldBeads?.toFixed(1))} mL
              {r.oldBeadsOverride && (
                <span
                  className="ml-2 inline-block bg-amber-100 text-amber-900 ring-1 ring-amber-300 px-1.5 py-0.5 rounded text-xs uppercase"
                  title="This value exceeded the 20% recommended cap at save time; operator confirmed override."
                >
                  OVERRIDE
                </span>
              )}
            </dd>
          </div>
          {/* …rest of Inputs rows… */}
        </dl>
      </div>

      {/* 2. Intermediates, 3. Outputs (PE volume), 4. Diluent decision —
          same shell, content per CONTEXT.md <specifics> worked example. */}
    </section>
  )
}
```

**Block contents per CONTEXT.md `<specifics>` worked example (D-15-07):**
- **Inputs (8 rows):** Plates / Sample count / Replicate mode / Premix selection / Singles selection / Old beads (+ override badge) / Old antibodies (+ override badge) / Number of setups
- **Intermediates (6 rows):** Total wells / Beads vol/well / Antibodies vol/well / Dead volume / Raw bead volume / Raw antibody volume
- **Outputs (5 rows):** New beads / New antibodies / Total bead volume / Total antibody volume / **PE volume** (compute at render via `computePeVolumeML`)
- **Diluent decision:** top branch label (`Rule applied: {branchLabel}`) + 2-row mini table for verbatim `beadsDiluent` / `antibodiesDiluent`

---

### `src/renderer/src/features/run/components/HistoricalRunBanner.tsx` (NEW)

**Analog:** Existing red validation banner at `CalculatorForm.tsx:385-389`:
```tsx
      {validationError && (
        <div className="p-3 bg-red-50 border border-red-200 rounded-md">
          <p className="text-sm text-red-700">{validationError}</p>
        </div>
      )}
```

**Phase 15 — full new component (mirror banner shape; D-15-11 amber treatment + copy):**
```tsx
import { useRunStore } from '../../../stores/runStore'

/**
 * Phase 15 SMK3-16 D-15-11: advisory banner above the audit trail for runs
 * saved before Phase 15 (calculationRulesVersion !== 'smoke3'). Renders null
 * for Phase-15-or-later runs and when no current run is loaded. Print-safe
 * (lives inside FinalizedRunView's print stylesheet).
 */
export function HistoricalRunBanner(): JSX.Element | null {
  const currentRun = useRunStore((s) => s.runs.find((r) => r.id === s.currentRunId) ?? null)
  if (!currentRun) return null
  if (currentRun.calculationRulesVersion === 'smoke3') return null
  return (
    <div className="p-3 bg-amber-50 border border-amber-300 rounded-md">
      <p className="text-sm text-amber-900">
        This run was saved under previous calculation rules. Values displayed as recorded — no recompute on reopen.
      </p>
    </div>
  )
}
```

---

### `src/renderer/src/features/run/lib/auditTrail.ts` (NEW)

**Analog:** `src/renderer/src/lib/decimal.ts:44-48` (`ceilToTenthML`) + `src/renderer/src/lib/diluentResolver.ts:41-65` (pure function shape, structural input).

**Existing decimal pattern (verbatim, decimal.ts:44-48):**
```ts
export function ceilToTenthML(volumeUL: Decimal): Decimal {
  const mL = volumeUL.dividedBy(1000)
  const roundedML = mL.toDecimalPlaces(1, Decimal.ROUND_CEIL)
  return roundedML.times(1000)
}
```

**Phase 15 NEW module — full file:**
```ts
import { Decimal } from 'decimal.js'
import { ceilToTenthML } from '../../../lib/decimal'
import type { DiluentResult } from '../../../lib/diluentResolver'

/**
 * Phase 15 SMK3-17 (D-15-13/14/16): PE volume = finalVolume ÷ SAPE concentration,
 * ceiling-rounded UP to 0.1 mL. Silent fallback to 1× when sapeConcentration
 * is null, undefined, or 0 (PRD: "typically 1×"). Ceiling applies AFTER division
 * so non-integer divisors still round to the operator-friendly 0.1-mL step.
 *
 * Input: finalVolumeML (already 0.1-mL ceiling-rounded total assay volume).
 * Output: peVolumeML (0.1-mL ceiling-rounded number, suitable for direct render).
 *
 * Edge cases (Group M): see CONTEXT.md <specifics> table.
 */
export function computePeVolumeML(
  finalVolumeML: number,
  sapeConcentration: number | null | undefined
): number {
  const concentration =
    sapeConcentration === null || sapeConcentration === undefined || sapeConcentration === 0
      ? 1
      : sapeConcentration
  const finalUL = new Decimal(finalVolumeML).times(1000)
  const peUL = finalUL.dividedBy(concentration)
  const ceilUL = ceilToTenthML(peUL)
  return ceilUL.dividedBy(1000).toNumber()
}

/**
 * Phase 15 D-15-09: derive the branch label rendered above the per-reagent
 * diluent rows. Reads the snapshotted premixConcentration to disambiguate
 * the two "fallback" sub-cases.
 */
export function deriveDiluentBranchLabel(
  diluent: DiluentResult,
  premixConcentration: number | null
): string {
  if (diluent.kind === 'premix') {
    return `Concentration-keyed (${diluent.name} @ 1× wins)`
  }
  if (premixConcentration === null) {
    return 'Per-reagent fallback (no premix selected)'
  }
  return 'Per-reagent fallback (no 1× premix in selection)'
}
```

---

### `src/renderer/src/features/run/lib/__tests__/auditTrail.test.ts` (NEW)

**Analog:** `src/renderer/src/lib/__tests__/calculator.integration.test.ts` Group A-L pattern (lines 41-225). Specifically the per-group `describe → it('T-X1: …')` shape.

**Phase 15 — full new file shape:**
```ts
import { describe, it, expect } from 'vitest'
import { computePeVolumeML, deriveDiluentBranchLabel } from '../auditTrail'

// Group M — PE volume math (SMK3-17). Edge cases per CONTEXT.md <specifics>.
describe('Phase 15 audit-trail derivations', () => {
  describe('Group M: PE volume = finalVolume ÷ SAPE concentration (SMK3-17)', () => {
    it('T-M1: 9.8 mL ÷ 1.0× → 9.8 mL', () => {
      expect(computePeVolumeML(9.8, 1.0)).toBeCloseTo(9.8, 1)
    })
    it('T-M2: 9.8 mL ÷ 0.5× → 19.6 mL', () => {
      expect(computePeVolumeML(9.8, 0.5)).toBeCloseTo(19.6, 1)
    })
    it('T-M3: 9.8 mL ÷ 2.0× → 4.9 mL', () => {
      expect(computePeVolumeML(9.8, 2.0)).toBeCloseTo(4.9, 1)
    })
    it('T-M4: 9.8 mL ÷ null (pre-Phase-15) → 9.8 mL (silent 1× fallback)', () => {
      expect(computePeVolumeML(9.8, null)).toBeCloseTo(9.8, 1)
    })
    it('T-M5: 9.8 mL ÷ 0 (malformed panel) → 9.8 mL', () => {
      expect(computePeVolumeML(9.8, 0)).toBeCloseTo(9.8, 1)
    })
    it('T-M6: 9.8 mL ÷ undefined → 9.8 mL', () => {
      expect(computePeVolumeML(9.8, undefined)).toBeCloseTo(9.8, 1)
    })
    it('T-M7: 9.83 pre-ceiling ÷ 1.0× → 9.9 mL (ceiling applied AFTER division)', () => {
      expect(computePeVolumeML(9.83, 1.0)).toBeCloseTo(9.9, 1)
    })
  })

  describe('Group N: deriveDiluentBranchLabel (D-15-09)', () => {
    it('T-N1: premix kind → Concentration-keyed (<name> @ 1× wins)', () => {
      expect(
        deriveDiluentBranchLabel({ kind: 'premix', name: 'Panel I' }, 1)
      ).toBe('Concentration-keyed (Panel I @ 1× wins)')
    })
    it('T-N2: values_table kind + premixConcentration > 1 → no 1× premix in selection', () => {
      expect(
        deriveDiluentBranchLabel(
          { kind: 'values_table', beads: 'L-AB', antibodies: 'L-AB' },
          5
        )
      ).toBe('Per-reagent fallback (no 1× premix in selection)')
    })
    it('T-N3: values_table kind + premixConcentration null → no premix selected', () => {
      expect(
        deriveDiluentBranchLabel(
          { kind: 'values_table', beads: 'L-AB', antibodies: 'L-AB' },
          null
        )
      ).toBe('Per-reagent fallback (no premix selected)')
    })
  })
})
```

---

### `src/renderer/src/features/run/hooks/__tests__/useRunSnapshot.test.ts` (NEW)

**Analog:** `src/renderer/src/lib/__tests__/calculator.integration.test.ts` Group G/J (`runStore.loadRun` cascade + `window.electronAPI` stubbing — lines 681-846). Same pattern of mocking the IPC surface and exercising the renderer-side logic.

**Stub IPC pattern (verbatim from Group J at lines 727-735):**
```ts
// Stub window.electronAPI for the loadRun cascade. Same shape as Group G.
beforeEach(() => {
  vi.stubGlobal('window', {
    electronAPI: {
      run: { getById: vi.fn().mockResolvedValue(/* fixture */) },
      panel: { getWithAnalytes: vi.fn().mockResolvedValue(/* fixture */) }
    }
  })
})
```

**Phase 15 — extend with `masterPanel.getWithReagents` mock; assert the 10 fields populate.** Test cases (per RESEARCH §Wave 0 Gaps):
- Smoke-3 happy path: master panel + 3 reagents → all 10 fields populated, `calculationRulesVersion === 'smoke3'`
- Custom assay (no premix): `selectedPanel === null` → no IPC call → 6 master-panel fields all `null`, `premixConcentration === null`
- IPC failure: `getWithReagents` throws → returns `{ error: 'Failed to snapshot master panel: …' }`
- Override flags: `oldBeadsOverride: true` in calculatorStore → packed onto `RunCreate` as `oldBeadsOverride: true`

---

### `src/main/db/__tests__/migration.test.ts` (MODIFIED — append column-presence describe block)

**Analog:** Same file, Phase 14-08 describe block at lines 369-417. Verbatim pattern for one column:
```ts
  it('runs table has number_of_setups column (NOT NULL with default 1) after latest migration', () => {
    const { sqlite } = createTestDb()
    const cols = sqlite.prepare("PRAGMA table_info('runs')").all() as Array<{
      name: string
      notnull: number
      dflt_value: string | null
    }>
    const col = cols.find((c) => c.name === 'number_of_setups')
    expect(col).toBeDefined()
    expect(col?.notnull).toBe(1) // NOT NULL
    expect(['1', 1]).toContain(col?.dflt_value as unknown as string | number)
  })
```

**Phase 15 — append a new describe block after line 417 with 10 `it()` blocks (one per column):**
```ts
describe('migration 15-XX — runs audit-trail snapshot columns (SMK3-12/15/16/17)', () => {
  // 7 nullable columns: assert .notnull === 0
  it.each([
    ['sape_name', 'TEXT'],
    ['sape_concentration', 'REAL'],
    ['beads_diluent', 'TEXT'],
    ['antibodies_diluent', 'TEXT'],
    ['beads_volume_per_well', 'REAL'],
    ['antibodies_volume_per_well', 'REAL'],
    ['premix_concentration', 'REAL'],
    ['calculation_rules_version', 'TEXT']
  ])('runs.%s exists and is nullable', (colName) => {
    const { sqlite } = createTestDb()
    const cols = sqlite.prepare("PRAGMA table_info('runs')").all() as Array<{
      name: string; notnull: number; dflt_value: string | null
    }>
    const col = cols.find((c) => c.name === colName)
    expect(col).toBeDefined()
    expect(col?.notnull).toBe(0)
  })

  // 2 boolean columns NOT NULL DEFAULT false: copy the is_offline_save assertion
  // from the migration 0005 block at lines 153-167.
  it.each(['old_beads_override', 'old_antibodies_override'])(
    'runs.%s is NOT NULL boolean default false',
    (colName) => {
      const { sqlite } = createTestDb()
      const cols = sqlite.prepare("PRAGMA table_info('runs')").all() as Array<{
        name: string; notnull: number; dflt_value: string | null
      }>
      const col = cols.find((c) => c.name === colName)
      expect(col).toBeDefined()
      expect(col?.notnull).toBe(1)
      expect(['false', '0']).toContain(col?.dflt_value)
    }
  )
})
```

---

### `src/main/db/repositories/__tests__/run.test.ts` (MODIFIED — extend with T-7..T-18)

**Analog:** Same file, T-1..T-6 round-trip pattern at lines 82-174. The `basePayload(overrides)` helper at lines 52-80 is the extension point.

**Existing T-1 pattern (verbatim, lines 82-90):**
```ts
  it('T-1: create() persists numberOfSetups when provided', () => {
    const created = runRepository.create(basePayload({ numberOfSetups: 3 }))
    expect(created.numberOfSetups).toBe(3)
    const fetched = runRepository.getById(created.id)
    expect(fetched).not.toBeNull()
    expect(fetched!.numberOfSetups).toBe(3)
  })
```

**Phase 15 — add T-7..T-16 (one per new field) + T-17 ("all 10 supplied") + T-18 ("all 10 omitted → defaults"):**
```ts
  it('T-7: create() persists sapeName when provided', () => {
    const created = runRepository.create(basePayload({ sapeName: 'SAPE-A' }))
    expect(created.sapeName).toBe('SAPE-A')
    expect(runRepository.getById(created.id)!.sapeName).toBe('SAPE-A')
  })
  // …T-8..T-16 mirror this shape, one per Phase 15 field…

  it('T-17: create() with all 10 audit-trail fields supplied round-trips', () => {
    const payload = basePayload({
      sapeName: 'SAPE-A',
      sapeConcentration: 1.0,
      beadsDiluent: 'L-AB',
      antibodiesDiluent: 'L-AB',
      beadsVolumePerWell: 0.05,
      antibodiesVolumePerWell: 0.025,
      premixConcentration: 1.0,
      oldBeadsOverride: true,
      oldAntibodiesOverride: false,
      calculationRulesVersion: 'smoke3'
    })
    const created = runRepository.create(payload)
    const fetched = runRepository.getById(created.id)!
    expect(fetched.sapeName).toBe('SAPE-A')
    // …assert all 10…
  })

  it('T-18: create() with audit-trail fields omitted defaults to NULL/false on read', () => {
    const created = runRepository.create(basePayload())
    const fetched = runRepository.getById(created.id)!
    expect(fetched.sapeName).toBeNull()
    expect(fetched.sapeConcentration).toBeNull()
    // …7 nullable fields → null
    expect(fetched.oldBeadsOverride).toBe(false)
    expect(fetched.oldAntibodiesOverride).toBe(false)
    expect(fetched.calculationRulesVersion).toBeNull()
  })
```

---

### `src/renderer/src/lib/__tests__/calculator.integration.test.ts` (MODIFIED — append Group M)

**Analog:** Same file, existing Group A at lines 41-64. Group M (next free letter — A through L exist per `grep`).

**Decision:** Group M tests in this file would target `calculateVolumes` — but the PE math is a single-line derivation that lives in `auditTrail.ts`. **Recommendation:** leave the dedicated PE math tests in the new `auditTrail.test.ts` (above) and add ONE thin integration test in this file that proves PE volume composes correctly with the existing Group A canonical fixture (148 wells / 9.4 mL final → 9.4 mL PE @ 1× SAPE).

```ts
describe('Group M: PE volume composes with canonical Group A fixture (SMK3-17)', () => {
  it('T-M1: Group A finalVolume (9.4 mL) ÷ 1× SAPE → 9.4 mL PE volume', () => {
    const inputs = createCalculatorInputs(100, 'singles', 2, 50, 1)
    const outputs = calculateVolumes(inputs)
    expect(outputs.finalVolumeML).toBeCloseTo(9.4, 1)
    expect(computePeVolumeML(outputs.finalVolumeML, 1.0)).toBeCloseTo(9.4, 1)
  })
})
```

(The 7 PE math edge cases live in `auditTrail.test.ts` per the new-file pattern above.)

---

## Shared Patterns

### Conditional repository writes (Phase 14-08 idiom)
**Source:** `src/main/db/repositories/run.ts:85-87` (create) + `:162-164` (update)
**Apply to:** All 10 new fields in both `create()` and `update()` of `runRepository`. NEVER write the new fields unconditionally — Phase 15's payload may legitimately omit them when the renderer is mid-migration or the test caller is a pre-Phase-15 fixture.
```ts
if (data.X !== undefined) insertValues.X = data.X
```

### Snapshot-at-save snapshot capture (Phase 12-04 + 14-04 idiom)
**Source:** `src/renderer/src/features/run/hooks/useRunSnapshot.ts:46-129`
**Apply to:** Phase 15's 10 new fields. Read renderer-store state at save time, denormalize onto the returned `RunCreate`, never reapply into a store on `loadRun` (audit trail is render-only — RESEARCH §Anti-Patterns Confirmed Absent).

### `<dl class="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-2 text-sm">` 2-column metadata grid
**Source:** `src/renderer/src/features/run/components/FinalizedRunHeader.tsx:70-138`
**Apply to:** All 4 audit-trail blocks in `AuditTrailSection.tsx` AND the new SAPE Name row in `FinalizedRunHeader.tsx`. Same row shell:
```tsx
<div className="flex justify-between gap-4 border-b border-gray-100 py-1">
  <dt className="font-medium text-[var(--color-muted)]">{label}</dt>
  <dd className="text-[var(--color-foreground)]">{value}</dd>
</div>
```

### Em-dash placeholder for missing snapshot fields (D-15-12)
**Source:** `FinalizedRunHeader.tsx:144` (`{record.comments ?? '—'}`)
**Apply to:** Every value cell in `AuditTrailSection.tsx` that reads a Phase-15-snapshotted field. Use a small helper:
```ts
const dash = (v: unknown): string => v === null || v === undefined ? '—' : String(v)
```

### Banner shape (validation-banner pattern)
**Source:** `src/renderer/src/features/calculator/components/CalculatorForm.tsx:385-389` (red error banner)
**Apply to:** `HistoricalRunBanner.tsx` — same shape, swap `bg-red-50 border-red-200 text-red-700` → `bg-amber-50 border-amber-300 text-amber-900` (D-15-11).

### Pure derivation modules (decimal.js + structural input)
**Source:** `src/renderer/src/lib/decimal.ts:44-48` (`ceilToTenthML`) + `src/renderer/src/lib/diluentResolver.ts:41-65` (`resolveDiluent`)
**Apply to:** New `auditTrail.ts` module — pure functions, structural inputs, decimal.js for any rounding, no I/O.

### `vi.stubGlobal('window', { electronAPI: { … } })` for renderer IPC mocks
**Source:** `src/renderer/src/lib/__tests__/calculator.integration.test.ts` Group J at lines 727-735
**Apply to:** New `useRunSnapshot.test.ts` to mock `window.electronAPI.masterPanel.getWithReagents` for the snapshot fetch tests.

### `createTestDb()` + `PRAGMA table_info('runs')` for column-presence
**Source:** `src/main/db/__tests__/migration.test.ts:141-167` (Phase 6 pattern) + `:369-417` (Phase 14-08 pattern)
**Apply to:** All 10 column-presence assertions in the new Phase 15 describe block in `migration.test.ts`.

### `setDatabaseForTests` + `setSqliteForTests` + `seedPlatformAndSpecies` for round-trip persistence
**Source:** `src/main/db/repositories/__tests__/run.test.ts:25-44` (Phase 14-08 setup)
**Apply to:** T-7..T-18 in `run.test.ts`. Reuse the existing `basePayload(overrides)` helper at lines 52-80 — Phase 15 fields slot into the `overrides` parameter without modifying `basePayload`.

## No Analog Found

**None.** Every file Phase 15 creates or modifies has a strong, recent in-repo analog. RESEARCH §"Don't Hand-Roll" §Key insight: "Phase 15 is unusually well-resourced — every primitive it needs is already in the codebase from Phases 12 + 13 + 14. There is essentially no greenfield code in the math/persistence layer; the only net-new is the new IPC channel and the audit-trail UI block." Both the new IPC channel and the new UI block have analogs (Panel handler shape + FinalizedRunHeader `<dl>` shell respectively).

## Metadata

**Analog search scope:**
- `src/main/db/` (schema, migrations, repositories, tests)
- `src/main/ipc/` (handlers + index registration)
- `src/preload/` (contextBridge)
- `src/shared/` (types, constants, validation)
- `src/renderer/src/features/run/` (components, hooks, lib)
- `src/renderer/src/features/calculator/` (form + store integration for override flags)
- `src/renderer/src/lib/` (decimal, diluentResolver)
- `src/renderer/src/stores/` (calculatorStore, selectionStore, runStore)
- `drizzle/migrations/` (Phase 14-08 SQL pattern)

**Files scanned:** ~25 (every primary source from RESEARCH §Sources read at the relevant line ranges; no re-reads).

**Pattern extraction date:** 2026-05-12

**Key cross-cutting concerns the planner MUST honour:**

1. **`buildRunSnapshot` becomes async — `useMemo` cannot return a Promise.** Plan 15-03 must split the surface: extract sync gates into `validateSnapshotPreconditions` (called by `useMemo` for `canSave`/`reason`), keep the full async path for the actual Save click. RESEARCH §Open Risks #2/#3.

2. **Override flags live in `CalculatorForm.tsx` local React state, NOT in `calculatorStore`.** Plan 15-03 (or a dedicated mini-plan) must lift `beadsOverrideAccepted` / `antibodiesOverrideAccepted` into the store as `oldBeadsOverride` / `oldAntibodiesOverride` so `buildRunSnapshot` can read them at save time. Mirror the `capPaused` pattern (calculatorStore.ts:74,84,109,231). RESEARCH §Open Risks #1.

3. **Audit trail reads from `RunRecord` ONLY — never from `useCalculatorStore.getState().getOutputs()`.** RESEARCH §Anti-Patterns "Reusing calculator running totals for audit trail" — calling `getOutputs()` for a pre-Phase-15 historical run silently returns recomputed values (defaults of 1/0/0 for missing fields) that differ from what was originally saved. SMK3-16 fidelity demands render-from-record.

4. **Migration generation, NOT hand-writing.** Plan 15-01 edits `schema.ts` first; runs `npm run db:generate`; commits the emitted `0009_*.sql` verbatim. RESEARCH §Question 3 workflow.

5. **PE volume display location is the audit-trail Outputs block ONLY.** Plan 15-04 does NOT touch `PrepSheet`/`VolumesSummary`. D-15-15.

6. **Phase 16 UAT script depends on Phase 15's exact field labels.** RESEARCH §Open Risks #4 — the worked-example labels in CONTEXT.md `<specifics>` are locked. Planner must not creatively rename rows.
