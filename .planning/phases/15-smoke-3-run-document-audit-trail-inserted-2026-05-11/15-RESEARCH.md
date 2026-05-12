# Phase 15: Smoke 3 — Run Document Audit Trail — Research

**Researched:** 2026-05-12
**Domain:** Electron + React renderer audit-trail UI; SQLite schema delta; snapshot-at-save persistence
**Confidence:** HIGH (every claim is `[VERIFIED]` from a file-read against the actual codebase; no `[ASSUMED]` claims remain)

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**Snapshot at save (D-15-01..D-15-04):**
- D-15-01: Master-panel data reaches the audit trail by **snapshot-at-save**, not live fetch. Renderer reads `master_panels` + `master_panel_reagents` rows at save time, denormalizes the operator-visible fields onto the `runs` row, and the audit trail reads exclusively from `RunRecord`.
- D-15-02: Snapshot capture point = `buildRunSnapshot` in [src/renderer/src/features/run/hooks/useRunSnapshot.ts](src/renderer/src/features/run/hooks/useRunSnapshot.ts). Extends Phase 12-04 + Phase 14-04 pattern.
- D-15-03: 10 new nullable columns on `runs` (all default NULL except `calculationRulesVersion`):
  - `sapeName: text` (from `master_panels.sape_name`)
  - `sapeConcentration: real` (from `master_panel_reagents` where `reagent_kind = 'sape'`)
  - `beadsDiluent: text` (from `master_panel_reagents` where `reagent_kind = 'beads'`)
  - `antibodiesDiluent: text` (from `master_panel_reagents` where `reagent_kind = 'antibodies'`)
  - `beadsVolumePerWell: real` (from `master_panel_reagents` where `reagent_kind = 'beads'`)
  - `antibodiesVolumePerWell: real` (from `master_panel_reagents` where `reagent_kind = 'antibodies'`)
  - `premixConcentration: real` (selected premix's concentration at save time, null when no premix selected)
  - `oldBeadsOverride: integer (boolean)` (deferred from Phase 14)
  - `oldAntibodiesOverride: integer (boolean)` (deferred from Phase 14)
  - `calculationRulesVersion: text` (default `'smoke3'` for new saves; pre-Phase-15 rows = NULL)
- D-15-04: No backfill of pre-Phase-15 rows. Audit trail tolerates null/undefined; renders `—`.

**Audit trail rendering (D-15-05..D-15-09):**
- D-15-05: Location = new `<section>` between `FinalizedRunHeader` and `PrepSheet` inside `FinalizedRunView`. Doesn't touch existing recipe components.
- D-15-06: Style = four sequential labeled blocks with `<h3>` headings (Inputs / Intermediates / Outputs / Diluent decision), each using the same 2-column `<dl>` layout as `FinalizedRunHeader`.
- D-15-07: Field mapping = PRD-literal per CONTEXT.md `<specifics>` worked example.
- D-15-08: 20%-cap override badge (deferred from Phase 14): inline amber `OVERRIDE` chip beside Old Beads / Old Antibodies value rows when the corresponding `*Override` flag is true. Tooltip: `This value exceeded the 20% recommended cap at save time; operator confirmed override.`
- D-15-09: Diluent decision row format = top line (branch label derived at render from `premixConcentration === 1`) + 2-row mini table (verbatim `beadsDiluent` / `antibodiesDiluent` strings).

**Historical-run detection + advisory (D-15-10..D-15-12):**
- D-15-10: Marker column `runs.calculationRulesVersion`; default `'smoke3'` for new saves; pre-existing rows migrate with NULL.
- D-15-11: Advisory banner above audit trail, between `FinalizedRunHeader` and audit trail. Tailwind `bg-amber-50 border-amber-300 text-amber-900`. Copy: `This run was saved under previous calculation rules. Values displayed as recorded — no recompute on reopen.`
- D-15-12: Missing snapshotted-field handling = `—` (em-dash) in every value cell.

**PE volume formula (D-15-13..D-15-16):**
- D-15-13: PE volume input = `finalVolume` (the 0.1-mL ceiling-rounded total).
- D-15-14: `PE volume (mL) = finalVolume (mL) / (sapeConcentration ?? 1)`. Null/0/undefined → silent fallback to `1×`.
- D-15-15: PE volume display in Outputs block of audit trail ONLY. PrepSheet/VolumesSummary untouched.
- D-15-16: PE volume rounded UP to 0.1 mL via existing `ceilToTenthML` from [src/renderer/src/lib/decimal.ts](src/renderer/src/lib/decimal.ts).

### Claude's Discretion

- Audit trail component split (single file vs four block files) — recommendation: single component, split if any block > 80 lines.
- Override badge styling — recommendation: inline Tailwind for v1.0, no badge primitive needed.
- `Ctrl-P` printability of audit trail — default yes (lives inside `FinalizedRunView`'s print stylesheet).
- Marker value for pre-existing rows — `null` vs `'pre-smoke3'` (renderer treats them the same).
- Test discipline — extend existing test files (column-presence in `migration.test.ts`, round-trip in `run.test.ts`, Group M for PE math in `calculator.integration.test.ts`); new component tests gated by vitest config (see Validation Architecture below).

### Deferred Ideas (OUT OF SCOPE)

- Wiring `resolveDiluent` into the live calculator output path (Phase 15 calls it for audit-trail render only).
- Updating PrepSheet's VolumesSummary to use the new PE volume formula (keeps Phase 4-04 contract intact).
- Master-panel renderer store / live IPC fetch path (snapshot-at-save makes this unnecessary).
- Backfilling pre-Phase-15 historical runs' snapshotted fields.
- Multi-premix snapshotting (selectionStore is single-premix per Phase 14).
- Audit trail printability toggle.
- Snapshot freshness check on save (single-machine app for v1.0).
- Windows installer build / UAT (Phase 16).

</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| SMK3-12 | SAPE Name displayed in run document for traceability | New `sapeName` column (D-15-03) populated from `master_panels.sape_name`; rendered as new row in `FinalizedRunHeader` metadata `<dl>` (Code Surface 5) |
| SMK3-15 | Run document calculation breakdown shows full audit trail (inputs → intermediates → outputs → diluent decision) | New audit-trail section in `FinalizedRunView` with four `<dl>` blocks (D-15-05/06/07); reads exclusively from `RunRecord`; existing `resolveDiluent` provides branch label (Code Surface 6) |
| SMK3-16 | Historical run records snapshot-frozen | 10 new nullable columns capture panel data at save time (D-15-01/03); pre-Phase-15 rows tolerate NULL + render `—` (D-15-04/12); marker column `calculationRulesVersion` drives advisory banner (D-15-10/11) |
| SMK3-17 | PE volume = `Total Volume of the Assay ÷ SAPE concentration` | Computed at render time in audit trail Outputs block (D-15-13/14/15); uses existing `ceilToTenthML` for rounding (D-15-16, Code Surface 7); Group M tests lock in the 7 edge cases from CONTEXT.md `<specifics>` |
</phase_requirements>

## Summary

1. **No new IPC channel is needed for the premix concentration.** [src/renderer/src/stores/selectionStore.ts:17,207](src/renderer/src/stores/selectionStore.ts) already stores `selectedPanel: PanelWithAnalytes | null` after the user picks a premix; `PanelWithAnalytes extends PremixPanel` and `PremixPanel.subPanelConc: number` IS the premix concentration ([src/shared/types/panel.ts:11](src/shared/types/panel.ts), confirmed via `importer.ts:194` writing `subPanelConc: pm.premixConc`). The snapshot reads `useSelectionStore.getState().selectedPanel?.subPanelConc ?? null`.

2. **A new IPC channel IS required for `master_panel_reagents` data.** No existing channel returns the per-reagent rows (verified by grep across `src/main/ipc/`, `src/preload/`, `src/shared/constants/channels.ts`). Phase 15 must add `MASTER_PANEL_GET_BY_PLATFORM_SPECIES_NAME` (or shorter) returning `{ masterPanel: MasterPanel; reagents: MasterPanelReagent[] }` keyed by the panel's normalized name (Phase 13 D-14 uniqueness is `(platform_id, species_id, name)`).

3. **The next migration is `0009`** — `0008_runs_setups_and_old_reagents.sql` is the latest in `drizzle/migrations/`. Drizzle config is at the repo root; the npm scripts `db:generate` (run `drizzle-kit generate`) and `db:push` (run `drizzle-kit push`) drive the workflow. Migrations are applied via `drizzle-orm/better-sqlite3/migrator.migrate()` at app startup AND in the test harness ([src/main/db/__tests__/testDb.ts:21](src/main/db/__tests__/testDb.ts)).

4. **`buildRunSnapshot` will go from sync to async.** It is currently sync ([src/renderer/src/features/run/hooks/useRunSnapshot.ts:46](src/renderer/src/features/run/hooks/useRunSnapshot.ts)) and called from `runStore.saveCurrentRun` ([src/renderer/src/stores/runStore.ts:56](src/renderer/src/stores/runStore.ts)). Phase 15's IPC fetch for master-panel reagents requires `await`; the cleanest path is to make `buildRunSnapshot` return `Promise<RunCreate | { error: string }>` and to await it in `saveCurrentRun`. The `useRunSnapshot` hook's `canSave` / `reason` logic must continue to work synchronously — it gates the UI Save button without doing the IPC fetch (only the actual save click triggers the fetch).

5. **Vitest is Node-only — no jsdom + no `@testing-library/react`.** [vitest.config.ts](vitest.config.ts) uses `environment: 'node'` and `include: ['src/**/*.test.ts']` (NOT `.tsx`). Phase 14's lessons (14-PATTERNS.md, 14-VERIFICATION.md) confirm: true component-render tests for `FinalizedRunView` audit trail are not wired in this project. The pragmatic path for Phase 15 is the same as Phase 14: cover behavior at the **store / hook / pure-helper layer** (column-presence, round-trip persistence, Group M PE math, `resolveDiluent` branch selection, em-dash handling tested via the snapshot builder + a pure-helper rendering function), and route true visual confirmation to Phase 16 Windows UAT.

**Primary recommendation:** Decompose Phase 15 into **5 plans** (schema delta + migration → IPC + repository for master-panel-with-reagents → snapshot capture rewrite to async → audit-trail UI + SAPE row + advisory banner + override badge → Group M PE math + integration tests). See §6 below.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Persist 10 new snapshotted fields | Database / Storage | API / Backend | Schema column delta on `runs` + repository writes; pure data layer extension following Phase 14-08 pattern |
| Read master-panel + reagents at save time | API / Backend | Browser / Client | New IPC channel + handler reads from main-process SQLite; renderer (Browser) initiates the call but does NOT cache |
| Snapshot capture (denormalize panel data onto `runs` row) | Browser / Client | API / Backend | Capture happens in renderer's `buildRunSnapshot` (existing pattern); IPC writes the result via existing `runs.create / runs.update` chain |
| Render audit trail from `RunRecord` | Browser / Client | — | Pure render-from-record; no IPC at render time per D-15-01 |
| Compute PE volume from snapshot | Browser / Client | — | Pure derivation in renderer using existing `ceilToTenthML`; no schema column for PE volume itself per D-15 Discretion |
| Resolve diluent branch label | Browser / Client | — | Existing `resolveDiluent` pure function called at render time with snapshotted `premixConcentration` + diluent strings |
| Render advisory banner for pre-Phase-15 runs | Browser / Client | Database / Storage | Renderer reads `calculationRulesVersion` marker column (Database tier supplies the marker) |

## Standard Stack

### Core (already in repo — no new packages)

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `drizzle-orm` | `0.45.1` (`0.45.2` available) `[VERIFIED: package.json + npm view]` | SQLite schema definition + query builder | Already used for all repositories; Phase 13 + 14-08 migrations are the precedent |
| `drizzle-kit` | `0.31.8` (`0.31.10` available) `[VERIFIED: package.json + npm view]` | Migration generator | `npm run db:generate` is the project's standard migration workflow |
| `better-sqlite3` | `12.6.2` `[VERIFIED: package.json]` | Synchronous SQLite driver | Main-process database layer; per Decision 01-02 in STATE.md |
| `decimal.js` | `10.4.3` `[VERIFIED: package.json]` | Precision arithmetic for PE volume | Already used by `ceilToTenthML`; division for PE math must round-trip through Decimal to avoid IEEE-754 drift on edge cases |
| `vitest` | `2.1.9` (`4.1.6` available) `[VERIFIED: package.json + npm view]` | Test runner | Node-only environment, no jsdom — see Validation Architecture |
| `zustand` | `5.0.3` `[VERIFIED: package.json]` | Renderer stores | `useRunStore.saveCurrentRun` is the integration point that becomes async |
| `tailwindcss` | `4.1.18` `[VERIFIED: package.json]` | Styling | Banner uses `bg-amber-50 border-amber-300 text-amber-900` per D-15-11; metadata-grid pattern reused from `FinalizedRunHeader` |

**No new package installs required.** Phase 15 is pure schema + UI + IPC plumbing on the existing stack.

### Version verification log

```bash
npm view drizzle-kit version  # → 0.31.10 (project on 0.31.8 — minor patch behind, no migration impact)
npm view drizzle-orm version  # → 0.45.2  (project on 0.45.1 — patch behind)
npm view vitest version       # → 4.1.6   (project on 2.1.9 — major version behind, but stable on 2.x; no upgrade required for Phase 15)
```
`[VERIFIED: npm view]` — All versions retrieved 2026-05-12. Project versions are slightly behind latest but require no action for Phase 15 scope.

## Architecture Patterns

### System Architecture Diagram

```
                       SAVE PATH (Phase 15 NEW behavior)
                       ─────────────────────────────────

    [User clicks Save in DocumentAndSavePage]
                  │
                  ▼
    ┌─────────────────────────────┐
    │  runStore.saveCurrentRun    │   becomes async-aware: awaits buildRunSnapshot
    │  (renderer/stores)          │
    └────────────┬────────────────┘
                 │  await
                 ▼
    ┌─────────────────────────────┐                     ┌────────────────────────────┐
    │  buildRunSnapshot(metadata) │ ─── IPC: fetch ───► │  MASTER_PANEL_GET_BY_…     │
    │  (renderer/features/run)    │                     │  (NEW main-process handler)│
    │  ─ reads selection store    │                     └────────┬───────────────────┘
    │  ─ derives premixConc       │                              │
    │  ─ calls IPC for master     │                              ▼
    │     panel + reagents        │                     ┌────────────────────────────┐
    │  ─ packs 10 new fields      │ ◄── reagents[] ──── │  masterPanelRepository +   │
    └────────────┬────────────────┘                     │  masterPanelReagent repo   │
                 │  RunCreate                           └────────────────────────────┘
                 ▼
    ┌─────────────────────────────┐
    │  IPC: RUN_CREATE / UPDATE   │ ───► main-process runRepository (extended) writes
    └─────────────────────────────┘      10 new columns + calculationRulesVersion='smoke3'


                       RENDER PATH (read-from-record only)
                       ───────────────────────────────────

    [User opens FinalizedRunView (wizard step 5)]
                  │
                  ▼
    ┌─────────────────────────────┐
    │  FinalizedRunHeader         │   reads RunRecord from runStore
    │  + NEW: SAPE Name row       │   renders 17 metadata rows + SAPE Name (em-dash if null)
    └────────────┬────────────────┘
                 │
                 ▼
    ┌─────────────────────────────┐
    │  NEW: HistoricalRunBanner   │   renders if calculationRulesVersion !== 'smoke3'
    └────────────┬────────────────┘
                 │
                 ▼
    ┌─────────────────────────────┐
    │  NEW: AuditTrailSection     │   four <dl> blocks read from RunRecord:
    │   ─ Inputs                  │     ─ resolveDiluent(premixConc, beadsDiluent,
    │   ─ Intermediates           │       antibodiesDiluent) → branch label
    │   ─ Outputs (PE volume)     │     ─ PE = ceilToTenthML(finalVolume / (sapeConc ?? 1))
    │   ─ Diluent decision        │     ─ Override badges from oldBeads/AntibodiesOverride
    └────────────┬────────────────┘
                 │
                 ▼
    [PrepSheet, ReagentChecklist, BeadRegionList — UNCHANGED, reused from Phase 3]
```

### Component Responsibilities

| File | Responsibility | Phase 15 Change |
|------|---------------|-----------------|
| [src/main/db/schema.ts](src/main/db/schema.ts) | Drizzle table definitions | ADD 10 nullable columns to `runs` table |
| [drizzle/migrations/0009_*.sql](drizzle/migrations/) | Generated SQL migration | NEW (output of `npm run db:generate`) |
| [src/main/db/repositories/run.ts](src/main/db/repositories/run.ts) | runs CRUD | EXTEND `create()` + `update()` to write the 10 new columns conditionally (mirror Phase 14-08 pattern at lines 85-87, 162-164) |
| [src/main/db/repositories/masterPanel.ts](src/main/db/repositories/masterPanel.ts) | Master-panel reads/writes | ADD `getByPlatformSpeciesNameWithReagents(platformId, speciesId, normalizedName): { panel, reagents } \| null` (composes existing `findByPlatformSpeciesName` + `masterPanelReagentRepository.findByMasterPanelId`) |
| [src/main/ipc/panel.ts](src/main/ipc/panel.ts) (or NEW masterPanel.ts) | IPC handlers | ADD handler for new channel |
| [src/preload/index.ts](src/preload/index.ts) | contextBridge surface | ADD `masterPanel.getWithReagents(platformId, speciesId, name)` |
| [src/shared/constants/channels.ts](src/shared/constants/channels.ts) | IPC channel constants | ADD new channel constant |
| [src/shared/types/run.ts](src/shared/types/run.ts) | `RunRecord` + `RunCreate` | ADD 10 optional nullable fields with comments mirroring Phase 14 style (lines 25-47) |
| [src/renderer/src/features/run/hooks/useRunSnapshot.ts](src/renderer/src/features/run/hooks/useRunSnapshot.ts) | `buildRunSnapshot` builder | REWRITE to `async`; ADD master-panel + reagents fetch; pack 10 new fields |
| [src/renderer/src/stores/runStore.ts](src/renderer/src/stores/runStore.ts) | `saveCurrentRun` | UPDATE call site (line 56) to `await buildRunSnapshot(metadata)` |
| [src/renderer/src/features/run/components/FinalizedRunHeader.tsx](src/renderer/src/features/run/components/FinalizedRunHeader.tsx) | Metadata grid | ADD SAPE Name `<div>` row inside `<dl>` (after current line 96 Panel row); render `record.sapeName ?? '—'` |
| [src/renderer/src/features/run/components/FinalizedRunView.tsx](src/renderer/src/features/run/components/FinalizedRunView.tsx) | View composition | INSERT `<HistoricalRunBanner />` + `<AuditTrailSection />` between `<FinalizedRunHeader />` (line 173) and the actions row |
| [src/renderer/src/features/run/components/AuditTrailSection.tsx](src/renderer/src/features/run/components/AuditTrailSection.tsx) | NEW: audit trail UI | Single component with four labeled `<dl>` blocks; calls `resolveDiluent` + `ceilToTenthML` at render time |
| [src/renderer/src/features/run/components/HistoricalRunBanner.tsx](src/renderer/src/features/run/components/HistoricalRunBanner.tsx) | NEW: amber banner | Pure presentation; conditional on `calculationRulesVersion !== 'smoke3'` |

### Pattern 1: Nullable schema additions on `runs`

**What:** Add nullable columns with no `NOT NULL DEFAULT` so pre-existing rows survive migration with `NULL` and the audit trail can render `—`.

**When to use:** Snapshotted fields where pre-Phase-15 data has no sensible default (vs. SMK3-02/03 which default to 0).

**Example (drizzle-orm DSL — verified pattern from existing schema lines 38-39):**
```ts
// Source: src/main/db/schema.ts (verified file pattern)
export const runs = sqliteTable('runs', {
  // ... existing columns ...
  sapeName: text('sape_name'),                        // nullable; D-15-03
  sapeConcentration: real('sape_concentration'),      // nullable
  beadsDiluent: text('beads_diluent'),                // nullable, verbatim per SMK3-DIL-01
  antibodiesDiluent: text('antibodies_diluent'),      // nullable
  beadsVolumePerWell: real('beads_volume_per_well'),  // nullable
  antibodiesVolumePerWell: real('antibodies_volume_per_well'),
  premixConcentration: real('premix_concentration'),  // nullable when no premix selected
  oldBeadsOverride: integer('old_beads_override', { mode: 'boolean' }).notNull().default(false),
  oldAntibodiesOverride: integer('old_antibodies_override', { mode: 'boolean' }).notNull().default(false),
  calculationRulesVersion: text('calculation_rules_version')  // nullable; renderer treats !== 'smoke3' as legacy
})
```
Note: `oldBeadsOverride` / `oldAntibodiesOverride` are booleans with default `false` — same shape as Phase 6's `is_offline_save` ([schema.ts:197](src/main/db/schema.ts)).

### Pattern 2: Conditional repository writes (Phase 14-08 idiom)

**What:** Write a new column only when the caller supplies it; otherwise let the DB DEFAULT fire.

**When to use:** Backwards-compat for callers that don't yet know about the new fields.

**Example (verified from `runRepository.create` lines 85-87):**
```ts
// Source: src/main/db/repositories/run.ts:85-87 (verified existing pattern)
if (data.numberOfSetups !== undefined) insertValues.numberOfSetups = data.numberOfSetups
if (data.oldBeads !== undefined) insertValues.oldBeads = data.oldBeads
if (data.oldAntibodies !== undefined) insertValues.oldAntibodies = data.oldAntibodies
```
Phase 15 extends this block with 10 more `if (data.X !== undefined)` lines. The `update()` method at lines 162-164 follows the same shape.

### Pattern 3: Async snapshot path

**What:** Convert `buildRunSnapshot` from sync to async so it can `await` an IPC call. Keep `useRunSnapshot` hook's `canSave` / `reason` synchronous (gates the button without paying for the IPC).

**When to use:** Save-time data fetching for snapshot fields not held in any renderer store.

**Example (Phase 15 sketch — derived from existing line 46 + 56):**
```ts
// In useRunSnapshot.ts — CHANGED return type:
export async function buildRunSnapshot(
  metadata: MetadataFields
): Promise<RunCreate | { error: string }> {
  // ... existing sync gates (platform/selection/calculator/plate validation) ...
  const selection = useSelectionStore.getState()
  const premixConcentration = selection.selectedPanel?.subPanelConc ?? null
  // NEW: fetch master-panel + reagents at save time (D-15-01)
  let masterPanelData: { sapeName: string | null; sapeConc: number | null;
                        beadsDiluent: string | null; antibodiesDiluent: string | null;
                        beadsVolumePerWell: number | null; antibodiesVolumePerWell: number | null }
                      | null = null
  if (selection.selectedPanel?.masterPanelId) {
    // call new IPC; surface error via { error } per existing convention
    try {
      const result = await window.electronAPI.masterPanel.getByIdWithReagents(
        selection.selectedPanel.masterPanelId
      )
      if (result) {
        const beads = result.reagents.find(r => r.reagentKind === 'beads')
        const ab    = result.reagents.find(r => r.reagentKind === 'antibodies')
        const sape  = result.reagents.find(r => r.reagentKind === 'sape')
        masterPanelData = {
          sapeName: result.masterPanel.sapeName,
          sapeConc: sape?.concentration ?? null,
          beadsDiluent: beads?.diluent ?? null,
          antibodiesDiluent: ab?.diluent ?? null,
          beadsVolumePerWell: beads?.volumePerWell ?? null,
          antibodiesVolumePerWell: ab?.volumePerWell ?? null
        }
      }
    } catch (e) {
      return { error: `Failed to snapshot master panel: ${(e as Error).message}` }
    }
  }
  // ... return existing fields + new fields + calculationRulesVersion: 'smoke3' ...
}
```

`runStore.saveCurrentRun` ([runStore.ts:56](src/renderer/src/stores/runStore.ts)) becomes:
```ts
const payload = await buildRunSnapshot(metadata)  // ← was sync before
```

The hook surface (`useRunSnapshot`'s `canSave` / `reason`) keeps a **fast sync path** that runs only the existing gates (no IPC) — because IPC at every keystroke would be wasteful and slow. The async fetch fires **only on Save click**.

### Anti-Patterns to Avoid

- **Adding a renderer-side master-panel store to feed the audit trail.** D-15-01 explicitly forbids. CONFIRMED ABSENT (see §5).
- **Reading audit-trail data from the live calculator store.** D-15-04 requires nullable tolerance for pre-Phase-15 rows that have no live calculator state. Audit trail is RENDER-FROM-RECORD.
- **Backfilling pre-Phase-15 rows on migration.** D-15-04 forbids — risks silent drift after panel re-import. Banner + em-dash is the v1.0 strategy.
- **Reusing `master_panels.findByPlatformAndSpecies`** (the legacy back-compat method, [masterPanel.ts:22](src/main/db/repositories/masterPanel.ts)) — comment at line 17 explicitly says new Smoke-3 paths should use `findByPlatformSpeciesName` because Phase 13 D-14 changed the unique constraint to `(platform_id, species_id, name)`. Phase 15's new IPC must go through `findByPlatformSpeciesName` (or equivalent compose with `getById`).
- **Hand-rolling diluent branch logic in the audit trail.** Reuse `resolveDiluent` from [src/renderer/src/lib/diluentResolver.ts](src/renderer/src/lib/diluentResolver.ts) — already a pure function, accepts structural input, locked in by 14 vitest cases.
- **Hand-rolling 0.1-mL ceiling.** Reuse `ceilToTenthML` from [src/renderer/src/lib/decimal.ts:44](src/renderer/src/lib/decimal.ts) — Decimal.js-based, edge cases tested.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Diluent branch label ("Concentration-keyed (Panel I @ 1× wins)" vs "Per-reagent fallback") | Custom branching in `AuditTrailSection.tsx` | `resolveDiluent({ selectedPremixes, valuesTable })` from [src/renderer/src/lib/diluentResolver.ts](src/renderer/src/lib/diluentResolver.ts) | Pure resolver locked in Phase 12-02 with strict equality `concentration === 1`, multi-1×-premix tiebreaker, verbatim diluent strings (SMK3-DIL-01) |
| 0.1-mL ceiling on PE volume | New rounding helper | `ceilToTenthML(volumeUL)` from [src/renderer/src/lib/decimal.ts:44](src/renderer/src/lib/decimal.ts) | Decimal.js-backed, ROUND_CEIL semantics verified by Phase 12-01 tests; converts mL ↔ µL correctly |
| Master-panel + reagents fetch | New per-call SQL | Compose `masterPanelRepository.getById(masterPanelId)` ([masterPanel.ts:160](src/main/db/repositories/masterPanel.ts)) + `masterPanelReagentRepository.findByMasterPanelId(id)` ([masterPanelReagent.ts:32](src/main/db/repositories/masterPanelReagent.ts)) | Both repositories already exist; lookup by `masterPanelId` is the most direct path because `selectionStore.selectedPanel.masterPanelId` is already loaded in the renderer |
| Premix concentration source | New IPC | `useSelectionStore.getState().selectedPanel?.subPanelConc` (already loaded post-`selectPanel`) | `PanelWithAnalytes extends PremixPanel`; `subPanelConc` is the premix concentration, written by [importer.ts:194](src/main/import/importer.ts) as `subPanelConc: pm.premixConc` |
| Boolean column with default | Custom `INTEGER` + manual default | `integer('col_name', { mode: 'boolean' }).notNull().default(false)` (Phase 6 pattern at [schema.ts:197](src/main/db/schema.ts)) | Drizzle's boolean mode handles SQLite's 0/1 representation transparently |
| Migration column-presence test | Hand-written SQL inspection | `PRAGMA table_info('runs')` pattern at [migration.test.ts:130-167](src/main/db/__tests__/migration.test.ts) | Existing pattern verifies column exists, NOT NULL, default value, and is repeated for every Phase-14-08 column |

**Key insight:** Phase 15 is unusually well-resourced — every primitive it needs is already in the codebase from Phases 12 + 13 + 14. There is essentially no greenfield code in the math/persistence layer; the only net-new is the new IPC channel and the audit-trail UI block.

## Resolved Open Questions (from CONTEXT.md `<deferred>`)

### Question 1 — IPC channel for save-time master-panel fetch

**Verified:** No existing IPC channel returns `master_panels` + `master_panel_reagents` together (or even `master_panel_reagents` alone). `[VERIFIED: grep -rn "MASTER_PANEL\|masterPanel" src/main/ipc/ src/preload/ src/shared/constants/]`

**Existing IPC inventory** (from [src/shared/constants/channels.ts](src/shared/constants/channels.ts)):
- `PANEL_GET_BY_PLATFORM_SPECIES`, `PANEL_GET_WITH_ANALYTES`, `PANEL_UPDATE`, `PANEL_DELETE`, `PANEL_ADD_ANALYTE`, `PANEL_REMOVE_ANALYTE` — all about `premix_panels`, NOT `master_panels`
- `ANALYTE_*`, `RUN_*`, `OPERATOR_*`, `IMPORT_PANEL_DATA`, etc.
- The `import` flow (Phase 13) writes `master_panels` + `master_panel_reagents` but does not expose a read channel.

**Recommended new channel:**
- Constant: `MASTER_PANEL_GET_WITH_REAGENTS` = `'master-panel:get-with-reagents'`
- Handler signature: `(masterPanelId: string) => Promise<{ masterPanel: MasterPanel; reagents: MasterPanelReagent[] } | null>`
- Preload key: `electronAPI.masterPanel.getWithReagents(masterPanelId: string)`

**Why keyed on `masterPanelId`** (not `(platformId, speciesId, name)`):
The renderer already has `selectionStore.selectedPanel.masterPanelId` available post-`selectPanel` (verified at [selectionStore.ts:207](src/renderer/src/stores/selectionStore.ts) — `selectedPanel: panelWithAnalytes` and `PanelWithAnalytes extends PremixPanel`, where `PremixPanel.masterPanelId: string | null` per [src/shared/types/panel.ts:9](src/shared/types/panel.ts)). Keying by ID is one fewer indirection than `(platform, species, name)` lookup, and the FK guarantees uniqueness.

**Edge case:** Custom assays (no premix selected) → `selection.selectedPanelId === null` → no `masterPanelId` → snapshot writes all 6 master-panel-derived fields as NULL. The audit trail renders `—` for each. No IPC call needed in this path.

**Where to add the handler:**
- New file [src/main/ipc/masterPanel.ts](src/main/ipc/masterPanel.ts) following the pattern of [src/main/ipc/panel.ts](src/main/ipc/panel.ts), OR
- Extend [src/main/ipc/panel.ts](src/main/ipc/panel.ts) — recommended for v1.0 (single new handler, related domain). Plan author's call.
- Register in [src/main/ipc/index.ts](src/main/ipc/index.ts)

### Question 2 — Source of `premixConcentration` snapshot

**Verified:** `premix_panels.subPanelConc REAL NOT NULL DEFAULT 1` (column at [schema.ts:108](src/main/db/schema.ts)) IS the source of truth for premix concentration. `master_panel_reagents` does NOT carry the premix-level concentration — its `concentration` column is per-reagent (beads/antibodies/sape concentration), not per-premix.

**Trace of how `subPanelConc` is populated:**
1. Parser ([src/main/import/parser.ts](src/main/import/parser.ts)) reads "Premix Concentration" row from xlsx Category block
2. Importer ([src/main/import/importer.ts:194](src/main/import/importer.ts)) writes `subPanelConc: pm.premixConc` when creating each premix
3. Renderer's `selectionStore.selectPanel(panelId)` loads the panel via `panel.getWithAnalytes` ([selectionStore.ts:198](src/renderer/src/stores/selectionStore.ts)) and stores it as `selectedPanel: PanelWithAnalytes`
4. `PanelWithAnalytes extends PremixPanel` ([src/shared/types/panel.ts:32](src/shared/types/panel.ts)) so `selectedPanel.subPanelConc` is the premix concentration

**Phase 15 snapshot read:**
```ts
const premixConcentration = useSelectionStore.getState().selectedPanel?.subPanelConc ?? null
```
- Returns `null` when no panel selected (custom assay)
- Returns the numeric concentration otherwise (1 for "1×" Panel I, 0.5 for "0.5×", etc.)
- The `?? null` collapses both "no panel" cases (`selectedPanel === null` and `selectedPanelId === null`)

**This means:** the new IPC channel from Question 1 does NOT need to return premix concentration. It only needs to return the master-panel SAPE Name + the per-reagent rows.

### Question 3 — Migration numbering + drizzle workflow

**Verified:** Latest migration is `0008_runs_setups_and_old_reagents.sql` (Phase 14-08 — `[VERIFIED: ls drizzle/migrations/]`). Phase 15 generates `0009`.

**Drizzle config:** [drizzle.config.ts](drizzle.config.ts) (repo root):
```ts
{
  schema: './src/main/db/schema.ts',
  out: './drizzle/migrations',
  dialect: 'sqlite'
}
```

**Project commands** (from [package.json](package.json)):
- `npm run db:generate` → runs `drizzle-kit generate` → emits new SQL migration in `drizzle/migrations/`
- `npm run db:push` → runs `drizzle-kit push` → applies pending migrations to `dev.db` directly (used for sanity check during development; NOT how production migrations apply)
- `npm run db:studio` → opens drizzle studio (UI inspector)

**How migrations actually apply at runtime:**
- App startup (main process): drizzle-orm's `migrate()` function reads `drizzle/migrations/` and applies any unapplied migrations in order. Tracking is via `__drizzle_migrations` table (drizzle's own bookkeeping).
- Test harness: [src/main/db/__tests__/testDb.ts:21](src/main/db/__tests__/testDb.ts) calls `migrate(db, { migrationsFolder: ... })` — every test gets all migrations applied to a fresh in-memory DB.
- Bundled in installer: [drizzle/migrations/](drizzle/migrations/) is shipped as a resource (visible in `dist/win-unpacked/resources/drizzle/migrations/`), so Windows installs auto-apply on first launch and on every upgrade.

**No remote DB push exists.** The "schema push" equivalent is `db:generate` (emit SQL) + commit + ship in installer; runtime `migrate()` does the rest.

**Phase 15 migration workflow:**
1. Edit [src/main/db/schema.ts](src/main/db/schema.ts) — add 10 columns to `runs`
2. Run `npm run db:generate` → emits `drizzle/migrations/0009_<random_name>.sql`
3. Inspect emitted SQL — verify it matches Pattern 1 above (10 `ALTER TABLE runs ADD ...` statements with the right NULL/NOT NULL semantics)
4. Add column-presence assertions to [src/main/db/__tests__/migration.test.ts](src/main/db/__tests__/migration.test.ts)
5. Add round-trip persistence assertions to [src/main/db/repositories/__tests__/run.test.ts](src/main/db/repositories/__tests__/run.test.ts)
6. Run `npm test` — all green
7. Commit migration + schema + tests in one plan

## Code Surface Audit

### 4. `buildRunSnapshot` current shape (CONTEXT.md `<deferred>` Q4)

**File:** [src/renderer/src/features/run/hooks/useRunSnapshot.ts](src/renderer/src/features/run/hooks/useRunSnapshot.ts)

**Current signature (line 46):**
```ts
export function buildRunSnapshot(metadata: MetadataFields): RunCreate | { error: string }
```
SYNCHRONOUS. Reads `.getState()` from 4 renderer stores (platform / selection / calculator / plate). Returns `{ error }` instead of throwing — caller surfaces to user.

**Phase 14-04 extension pattern (lines 109-117):**
- `numberOfSetups` packed inline at line 110: `numberOfSetups: calculator.numberOfSetups`
- `oldBeads` / `oldAntibodies` packed at lines 116-117: `oldBeads: calculator.oldBeads`
- All read from `useCalculatorStore.getState()` (already in scope via line 49)
- No conditional logic — values are always written; the DB layer's `if (data.X !== undefined)` check handles backwards compat

**Phase 15 extension shape:**
- 10 new fields packed at the bottom of the return object
- 6 fields (`sapeName`, `sapeConcentration`, `beadsDiluent`, `antibodiesDiluent`, `beadsVolumePerWell`, `antibodiesVolumePerWell`) come from the new IPC fetch — only when `selectedPanel?.masterPanelId` exists; otherwise null
- 1 field (`premixConcentration`) comes from `useSelectionStore.getState().selectedPanel?.subPanelConc ?? null`
- 2 fields (`oldBeadsOverride`, `oldAntibodiesOverride`) come from a new state surface that the calculator store doesn't expose yet — see §7 Open Risks
- 1 field (`calculationRulesVersion`) is a literal constant `'smoke3'`

**Critical:** `buildRunSnapshot` becomes async (Pattern 3 above). The `useRunSnapshot` hook's `useMemo` at lines 149-155 is a problem — `useMemo` cannot return a Promise that the caller awaits. Two options:

- **Option A (recommended):** Split the surface. `useRunSnapshot` keeps the sync gates for `canSave` / `reason` (no IPC). The exposed `build` function becomes `async`. `runStore.saveCurrentRun` calls `await build(metadata)`.
- **Option B:** Use a `useState` + `useEffect` to drive the async fetch eagerly on every store change. Wasteful (IPC at every keystroke) — REJECT.

Option A keeps the gating fast and pays the IPC cost only on Save click — which is also what the user experiences as "the moment Save commits."

### 5. `FinalizedRunHeader` metadata grid layout (Q5)

**File:** [src/renderer/src/features/run/components/FinalizedRunHeader.tsx](src/renderer/src/features/run/components/FinalizedRunHeader.tsx)

**Pattern (lines 70-138):** Single `<dl>` with `grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-2 text-sm`. Each row is a `<div className="flex justify-between gap-4 border-b border-gray-100 py-1">` containing:
```jsx
<dt className="font-medium text-[var(--color-muted)]">Label</dt>
<dd className="text-[var(--color-foreground)]">{value}</dd>
```

**Currently 17 metadata rows** (User, Operator, Date, Platform, Species, Panel, Sample Type, Dilution Factor, Sample Count, Replicate Mode, Plate Count, Plex, Hamilton, Run Plate Position, Standard Position, Trough Position, then Comments as a separate block).

**Phase 15 SAPE Name addition:**
Insert one new `<div>` row inside the `<dl>` (D-15-12: render `record.sapeName ?? '—'`). Logical placement: after Panel (line 96-97) since SAPE is panel-derived metadata. Exact JSX:
```jsx
<div className="flex justify-between gap-4 border-b border-gray-100 py-1">
  <dt className="font-medium text-[var(--color-muted)]">SAPE Name</dt>
  <dd className="text-[var(--color-foreground)]">{record.sapeName ?? '—'}</dd>
</div>
```

**Reuse for audit trail:** D-15-06 says use the same `<dl>` pattern. The four audit-trail blocks each get their own `<dl>` with `grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-2 text-sm` — wrapped in a `<section>` with `<h3>` heading per block.

### 6. `resolveDiluent` signature + import surface (Q6)

**File:** [src/renderer/src/lib/diluentResolver.ts](src/renderer/src/lib/diluentResolver.ts)

**Signature (line 41):**
```ts
export function resolveDiluent(args: {
  selectedPremixes: ReadonlyArray<SelectedPremixForDiluent>
  valuesTable: PanelValuesDiluent | undefined
}): DiluentResult
```

**Input types** ([src/shared/types/diluent.ts](src/shared/types/diluent.ts)):
```ts
export interface SelectedPremixForDiluent {
  name: string
  concentration: number
}
export interface PanelValuesDiluent {
  beads: string
  antibodies: string
}
```

**Output (discriminated union):**
```ts
export type DiluentResult =
  | { kind: 'premix'; name: string }
  | { kind: 'values_table'; beads: string; antibodies: string }
  | { kind: 'legacy'; beads: null; antibodies: null }
```

**Phase 15 audit trail call shape:**
```ts
// From snapshotted RunRecord fields
const diluent = resolveDiluent({
  selectedPremixes:
    record.premixConcentration !== null && record.panelName  // selectedPanel.name was used at save time; we have panel via runStore
      ? [{ name: panelName, concentration: record.premixConcentration }]
      : [],
  valuesTable:
    record.beadsDiluent !== null && record.antibodiesDiluent !== null
      ? { beads: record.beadsDiluent, antibodies: record.antibodiesDiluent }
      : undefined
})
```

**Branch label derivation:**
- `diluent.kind === 'premix'` → `Rule applied: Concentration-keyed (${diluent.name} @ 1× wins)`
- `diluent.kind === 'values_table'` → `Rule applied: Per-reagent fallback (no 1× premix in selection)` (CONTEXT.md `<specifics>` row 2)
- `diluent.kind === 'legacy'` OR no premix selected → `Rule applied: Per-reagent fallback (no premix selected)` (CONTEXT.md `<specifics>` row 3)

**Edge case (D-15-09):** When `record.premixConcentration === null` (no premix selected, custom assay) the audit trail per-reagent rows still need to render the verbatim `beadsDiluent` / `antibodiesDiluent` strings if they were captured. CONTEXT.md `<specifics>` says this case displays `Per-reagent fallback (no premix selected)`.

### 7. `ceilToTenthML` location + signature (Q7)

**File:** [src/renderer/src/lib/decimal.ts:44](src/renderer/src/lib/decimal.ts)

**Signature:**
```ts
export function ceilToTenthML(volumeUL: Decimal): Decimal
```

**Unit contract:** Input µL (Decimal) → output µL (Decimal), rounded UP at 0.1-mL precision.

**Examples (verified by Phase 12-01 tests):**
- 7400 µL → 7400 µL (already at 0.1-mL boundary)
- 7401 µL → 7500 µL
- 9831 µL (= 9.831 mL) → 9900 µL (= 9.9 mL)
- 0 → 0

**Phase 15 PE volume usage:**
```ts
import { Decimal } from 'decimal.js'
import { ceilToTenthML } from '../../../lib/decimal'

function computePEVolumeML(finalVolumeML: number, sapeConcentration: number | null): number {
  const concentration = sapeConcentration === null || sapeConcentration === 0
                        || sapeConcentration === undefined ? 1 : sapeConcentration
  const finalUL = new Decimal(finalVolumeML).times(1000)
  const peUL = finalUL.dividedBy(concentration)
  const ceilUL = ceilToTenthML(peUL)
  return ceilUL.dividedBy(1000).toNumber()
}
```

The Group M tests (CONTEXT.md `<specifics>` table) lock in 7 cases:
- 9.8 mL ÷ 1.0 = 9.8 mL
- 9.8 mL ÷ 0.5 = 19.6 mL
- 9.8 mL ÷ 2.0 = 4.9 mL
- 9.8 mL ÷ null → 9.8 mL (silent 1× fallback)
- 9.8 mL ÷ 0 → 9.8 mL
- 9.8 mL ÷ undefined → 9.8 mL
- 9.83 mL pre-ceiling ÷ 1.0 → 9.9 mL (ceiling applied AFTER division; the input here is post-ceiling 9.83 in µL = 9830, the Decimal division stays at 9830 then ceilToTenthML → 9900 = 9.9 mL)

**Note for Group M:** the existing PRD canonical fixture in Group A is 9400 µL (= 9.4 mL). Group M's "9.8 mL" cases mean the test fixture differs from Group A — test authors should pick a fixture that exercises non-trivial division. Suggestion: use `finalVolumeML = 9.8` directly via Decimal construction; no need to derive through `calculateVolumes`.

### 8. `runRepository.create` / `update` extension pattern (Q8)

**File:** [src/main/db/repositories/run.ts](src/main/db/repositories/run.ts)

**Current shape (lines 41-104 for `create`, 112-181 for `update`):**

`create()` builds an `insertValues` object literal with all known fields, then conditionally adds the optional fields (lines 85-87):
```ts
if (data.numberOfSetups !== undefined) insertValues.numberOfSetups = data.numberOfSetups
if (data.oldBeads !== undefined) insertValues.oldBeads = data.oldBeads
if (data.oldAntibodies !== undefined) insertValues.oldAntibodies = data.oldAntibodies
```

`update()` uses the same idiom (lines 162-164):
```ts
if (data.numberOfSetups !== undefined) setWithProvenance.numberOfSetups = data.numberOfSetups
if (data.oldBeads !== undefined) setWithProvenance.oldBeads = data.oldBeads
if (data.oldAntibodies !== undefined) setWithProvenance.oldAntibodies = data.oldAntibodies
```

The `setWithProvenance` type at lines 151-157 is the extension point — Phase 15 adds the 10 new optional fields:
```ts
const setWithProvenance: typeof baseSet & {
  machineName?: string | null
  isOfflineSave?: boolean
  numberOfSetups?: number
  oldBeads?: number
  oldAntibodies?: number
  // PHASE 15 — 10 new optional fields
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
} = { ...baseSet }
```

Plus 10 corresponding `if (data.X !== undefined) ...` lines added to both `create()` (after line 87) and `update()` (after line 164).

### 9. `RunRecord` / `RunCreate` types (Q9)

**File:** [src/shared/types/run.ts](src/shared/types/run.ts)

**Extension point in `RunRecord`:** After `oldAntibodies?: number` (line 47, before `hamilton: number` line 48). Add the 10 new fields with comment headers mirroring Phase 14's style at lines 25-47.

**Extension point in `RunCreate`:** After `oldAntibodies?: number` (line 94, before `hamilton: number` line 95). Same 10 fields, all optional.

**Comment style template (mirroring Phase 14 lines 35-42):**
```ts
/**
 * Smoke 3 SMK3-12 + SMK3-16 snapshot: SAPE Name from the panel's Values
 * block at save time. Optional — pre-Phase-15 saved runs lack this field
 * and the audit trail renders `—` per D-15-12. Captured at save by
 * buildRunSnapshot via a master_panels lookup keyed off
 * selectionStore.selectedPanel.masterPanelId.
 */
sapeName?: string | null
```

### 10. Existing test scaffolding (Q10)

**Migration test pattern** ([src/main/db/__tests__/migration.test.ts:130-167](src/main/db/__tests__/migration.test.ts)):
- Uses `createTestDb()` from `testDb.ts` (applies all migrations to in-memory SQLite)
- Reads column metadata via `PRAGMA table_info('runs')`
- Asserts `name`, `notnull`, `dflt_value` per column
- Phase 14-08 test block at lines 369-417 is the closest precedent — describe block titled `migration 14-08 — runs.numberOfSetups + oldBeads + oldAntibodies columns (SMK3-02/03/16)` with one `it()` per column

**Phase 15 new describe block:**
```
migration 15-XX — runs audit-trail snapshot columns (SMK3-12/15/16/17)
  ├── runs.sape_name (nullable text)
  ├── runs.sape_concentration (nullable real)
  ├── runs.beads_diluent (nullable text)
  ├── runs.antibodies_diluent (nullable text)
  ├── runs.beads_volume_per_well (nullable real)
  ├── runs.antibodies_volume_per_well (nullable real)
  ├── runs.premix_concentration (nullable real)
  ├── runs.old_beads_override (NOT NULL boolean default false)
  ├── runs.old_antibodies_override (NOT NULL boolean default false)
  └── runs.calculation_rules_version (nullable text)
```

**Round-trip pattern** ([src/main/db/repositories/__tests__/run.test.ts](src/main/db/repositories/__tests__/run.test.ts)):
- Uses `createTestDb()` + `seedPlatformAndSpecies()` + `setDatabaseForTests()` + `setSqliteForTests()`
- `basePayload(overrides)` helper at lines 52-80 returns a minimal valid `RunCreate` — Phase 15 EXTENDS this helper to include the 10 new optional fields (or accepts them only via overrides)
- Each `it('T-N: ...')` creates a run, fetches by id, asserts the field round-trips
- Phase 14-08 has T-1..T-6 covering the three new fields — Phase 15 adds T-7..T-16 (one per new field) plus a T-17 for "all 10 fields supplied" and T-18 for "all 10 omitted → defaults applied"

**Calculator integration test groups** ([src/renderer/src/lib/__tests__/calculator.integration.test.ts](src/renderer/src/lib/__tests__/calculator.integration.test.ts)):
- Existing groups span A through L (verified by grep)
- Phase 15 adds **Group M: PE volume math (SMK3-17)** with 7 cases per CONTEXT.md `<specifics>` table

**Renderer component test scaffolding** ([src/renderer/src/features/run/](src/renderer/src/features/run/)):
- **No `__tests__/` directory exists for `features/run/`** `[VERIFIED: ls src/renderer/src/features/run/]`
- **No existing `FinalizedRunView.test.tsx` exists** `[VERIFIED]`
- Vitest config explicitly excludes `.tsx` from the include glob ([vitest.config.ts](vitest.config.ts) line 6: `include: ['src/**/*.test.ts']`)
- See Validation Architecture below for the consequence

### 11. `master_panel_reagents` schema (Q11)

**File:** [src/main/db/schema.ts:59-88](src/main/db/schema.ts)

**Columns (Drizzle DSL → SQLite):**
- `id text PRIMARY KEY`
- `master_panel_id text NOT NULL REFERENCES master_panels(id) ON DELETE CASCADE`
- `reagent_kind text NOT NULL` — CHECK constraint: `IN ('beads', 'antibodies', 'sape')`
- `concentration real` — NULLABLE (D-07: NULL = `'variable'` sentinel for beads/antibodies; SAPE rows must be non-null per `sape_conc_not_null` CHECK)
- `diluent text` — NULLABLE; SMK3-DIL-01 verbatim
- `volume_per_well real NOT NULL`
- `created_at text NOT NULL`, `updated_at text NOT NULL`
- Composite UNIQUE INDEX on `(master_panel_id, reagent_kind)` named `master_panel_reagents_master_kind_uniq`

**TypeScript shape** ([src/shared/types/masterPanelReagent.ts](src/shared/types/masterPanelReagent.ts)):
```ts
export type ReagentKind = 'beads' | 'antibodies' | 'sape'
export interface MasterPanelReagent {
  id: string
  masterPanelId: string
  reagentKind: ReagentKind
  concentration: number | null
  diluent: string | null
  volumePerWell: number
  createdAt: string
  updatedAt: string
}
```

**Phase 15 snapshot extraction** (after IPC returns `reagents: MasterPanelReagent[]`):
```ts
const beads = reagents.find(r => r.reagentKind === 'beads')
const ab    = reagents.find(r => r.reagentKind === 'antibodies')
const sape  = reagents.find(r => r.reagentKind === 'sape')

// Snapshot fields (D-15-03):
beadsDiluent: beads?.diluent ?? null,
antibodiesDiluent: ab?.diluent ?? null,
beadsVolumePerWell: beads?.volumePerWell ?? null,
antibodiesVolumePerWell: ab?.volumePerWell ?? null,
sapeConcentration: sape?.concentration ?? null,
```

The CHECK constraint guarantees SAPE concentration is never null when a SAPE row exists — but `find()` can still return `undefined` if the panel data is malformed (no SAPE row at all). The `?.X ?? null` chain handles that without throwing.

## Validation Architecture

> Treat `workflow.nyquist_validation` as enabled (no `.planning/config.json` flip detected — defaulting to enabled per the standard rule).

### Test Framework

| Property | Value |
|----------|-------|
| Framework | `vitest@2.1.9` |
| Config file | [vitest.config.ts](vitest.config.ts) — `environment: 'node'`, `include: ['src/**/*.test.ts']`, `pool: 'forks'` |
| Quick run command | `npm test` (runs all tests, takes ~10s) |
| Full suite command | `npm test` |
| Renderer component testing | **NOT WIRED** — no jsdom, no `@testing-library/react`. Same constraint Phase 14 documented; same workaround applies |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| SMK3-12 | SAPE Name persists round-trip | unit (DB) | `npm test -- src/main/db/repositories/__tests__/run.test.ts` | EXTEND existing |
| SMK3-12 | SAPE Name renders in `FinalizedRunHeader` (visual) | manual UAT | Phase 16 Section A Step 8 | Phase 16 |
| SMK3-15 | All 10 audit-trail snapshot columns persist round-trip | unit (DB) | `npm test -- src/main/db/repositories/__tests__/run.test.ts` | EXTEND existing |
| SMK3-15 | All 10 columns exist with correct nullability + defaults after migration 0009 | unit (DB) | `npm test -- src/main/db/__tests__/migration.test.ts` | EXTEND existing |
| SMK3-15 | `buildRunSnapshot` packs all 10 fields when master panel + reagents are present | unit (renderer logic) | `npm test -- src/renderer/src/features/run/hooks/__tests__/useRunSnapshot.test.ts` | NEW (Wave 0 gap) |
| SMK3-15 | `buildRunSnapshot` writes nulls when no premix selected (custom assay) | unit | same file | NEW |
| SMK3-15 | Audit trail walks the full worked example end-to-end (rendering) | manual UAT | Phase 16 Section A | Phase 16 |
| SMK3-16 | Pre-Phase-15 row reloads with all 10 columns NULL (no error) | unit (DB) | `npm test -- src/main/db/__tests__/migration.test.ts` | EXTEND existing |
| SMK3-16 | `calculationRulesVersion === 'smoke3'` on every Phase-15-saved run | unit (DB) | `npm test -- src/main/db/repositories/__tests__/run.test.ts` | EXTEND existing |
| SMK3-16 | Pre-Phase-15 run renders banner; Phase-15 run does not (visual) | manual UAT | Phase 16 Section A Step 8 | Phase 16 |
| SMK3-17 | PE volume math (Group M, 7 edge cases from CONTEXT.md `<specifics>`) | unit (pure helper) | `npm test -- src/renderer/src/lib/__tests__/calculator.integration.test.ts` | EXTEND existing (or new file) |

### Sampling Rate

- **Per task commit:** `npm test` (~10s — runs whole suite; project doesn't gate on per-file selective testing)
- **Per wave merge:** `npm test` (same)
- **Phase gate:** Full suite green before `/gsd-verify-work`. Plus all manual UAT items routed to Phase 16.

### Wave 0 Gaps

- [ ] `src/renderer/src/features/run/hooks/__tests__/useRunSnapshot.test.ts` — NEW; tests sync gates AND async master-panel fetch (mocking `window.electronAPI.masterPanel.getWithReagents`). Covers SMK3-15 packing logic + null-handling for custom assays.
- [ ] (Optional) `src/renderer/src/features/run/lib/auditTrailDerive.test.ts` — NEW; if the audit trail's render-time helpers (PE volume computation, branch-label derivation) are extracted into a pure module, this file unit-tests them. Recommended because it lets the test cover the SMK3-17 + diluent branch logic without needing component render. Lifts coverage from manual-UAT-only into automated.
- [ ] `src/renderer/src/features/run/__tests__/` directory — does not exist; create when adding the file above.
- [ ] No framework install needed — vitest already in place.

**No new component-render tests** are required — they wouldn't run without adding `jsdom` + `@testing-library/react`, and Phase 14 explicitly accepted this constraint and routed visual confirmation to Phase 16. Phase 15 follows the same path.

### Recommended test file organization

```
src/main/db/__tests__/migration.test.ts                            (EXTEND: 10 new column-presence tests)
src/main/db/repositories/__tests__/run.test.ts                     (EXTEND: T-7..T-16 round-trip + T-17 all-supplied + T-18 all-omitted)
src/renderer/src/features/run/hooks/__tests__/useRunSnapshot.test.ts  (NEW: 6+ tests)
src/renderer/src/features/run/lib/auditTrailDerive.test.ts          (NEW, OPTIONAL: PE math + branch label derivation)
src/renderer/src/lib/__tests__/calculator.integration.test.ts      (EXTEND: Group M with 7 PE volume cases)
```

## Anti-Patterns Confirmed Absent (or Present)

| Anti-pattern | Status in current codebase | Evidence |
|--------------|---------------------------|----------|
| Renderer-side master-panel store | **ABSENT** ✓ | `[VERIFIED]` `grep -rn "masterPanel" src/renderer/src/stores/` returns nothing. The renderer only knows about `master_panels` indirectly through `selectedPanel.masterPanelId` (the FK on the premix panel). Phase 15 must NOT introduce one. |
| Reusing calculator running totals for audit trail | **WOULD BE EASY MISTAKE** ⚠ | The calculator store exposes `getOutputs()` returning live values that match the run's `finalVolume` *only when* the run was just saved. For a loaded historical run, `runStore.loadRun` cascades all values back into the calculator store ([runStore.ts:128-149](src/renderer/src/stores/runStore.ts)) — so `getOutputs()` *would* return the correct values for SMK3-runs, BUT not for pre-Phase-15 runs (which lack `numberOfSetups`/`oldBeads`/`oldAntibodies` and default to 1/0/0 — producing recomputed values that differ from what was originally saved). **Phase 15 audit trail MUST read from `RunRecord` directly, NOT call `useCalculatorStore.getState().getOutputs()`.** This is the strongest design constraint of the phase. |
| Backfilling pre-Phase-15 rows on migration | **NOT ATTEMPTED YET** ✓ | No backfill script exists; Phase 14-08 migration is plain `ALTER TABLE` with `DEFAULT 1/0/0`. Phase 15 follows the same shape with `DEFAULT NULL` for the 8 master-panel-derived columns + `DEFAULT false` for the 2 override booleans + nullable `calculationRulesVersion`. The temptation to backfill from current `master_panel_reagents` data is real (especially for SMK3-runs that *could* be reconstituted from the still-living master panel) — but D-15-04 explicitly forbids this. |

## Recommended Plan Decomposition

Phase 15 decomposes naturally into **5 plans** along the layer boundaries. Each plan is small enough for a single executor.

### Plan 15-01 — Schema delta + migration 0009 + repository extension (Wave 1)

**Scope:**
- Add 10 new columns to `runs` table in [src/main/db/schema.ts](src/main/db/schema.ts) per Pattern 1 above
- Run `npm run db:generate` → emit `drizzle/migrations/0009_<name>.sql`
- Inspect emitted SQL for correctness
- Extend `runRepository.create()` + `update()` with 10 new conditional writes ([src/main/db/repositories/run.ts:85-87, 162-164](src/main/db/repositories/run.ts) pattern)
- Extend `RunRecord` + `RunCreate` types ([src/shared/types/run.ts](src/shared/types/run.ts)) with 10 new optional fields, mirroring Phase 14's comment style
- Add 10 column-presence assertions to [migration.test.ts](src/main/db/__tests__/migration.test.ts)
- Add T-7..T-18 round-trip assertions to [run.test.ts](src/main/db/repositories/__tests__/run.test.ts)

**Why first:** Subsequent plans depend on the schema + types being in place. No code can write the new fields until the columns exist.

**Estimated tasks:** 4-5 (schema edit, migration generate, repository extension, type extension, test extension).

### Plan 15-02 — IPC channel + master-panel-with-reagents read path (Wave 1, parallelizable with 15-01)

**Scope:**
- Add `MASTER_PANEL_GET_WITH_REAGENTS` constant to [src/shared/constants/channels.ts](src/shared/constants/channels.ts)
- Add helper method to `masterPanelRepository` (or compose call inline in handler): `getByIdWithReagents(masterPanelId): { masterPanel, reagents } | null`
- Add IPC handler in [src/main/ipc/panel.ts](src/main/ipc/panel.ts) (or new `masterPanel.ts`); register in [src/main/ipc/index.ts](src/main/ipc/index.ts)
- Add preload bridge entry: `electronAPI.masterPanel.getWithReagents(id)` in [src/preload/index.ts](src/preload/index.ts)
- Update preload `index.d.ts` type declaration
- Repository unit test for `getByIdWithReagents` returning null when ID unknown, returning `{ masterPanel, reagents: [] }` when no reagents exist (defensive), returning all 3 reagents when present

**Why parallelizable with 15-01:** Different files; no overlap. Both must complete before 15-03.

**Estimated tasks:** 3-4.

### Plan 15-03 — Async snapshot rewrite (Wave 2, depends on 15-01 + 15-02)

**Scope:**
- Rewrite `buildRunSnapshot` in [src/renderer/src/features/run/hooks/useRunSnapshot.ts](src/renderer/src/features/run/hooks/useRunSnapshot.ts) to async (Pattern 3 above)
- Add master-panel IPC fetch (when `selectedPanel?.masterPanelId !== null`)
- Pack 10 new fields onto the returned `RunCreate`
- Set `calculationRulesVersion: 'smoke3'` literal
- Source `premixConcentration` from `selectionStore.selectedPanel?.subPanelConc ?? null`
- Source `oldBeadsOverride` / `oldAntibodiesOverride` from a new state surface — **this is the open risk** (see §7); plan author may need to add `oldBeadsOverrideAccepted: boolean` / `oldAntibodiesOverrideAccepted: boolean` to `calculatorStore` mirroring `capPaused`. If Phase 14 already wired this through `OldReagentCapModal`, reuse — otherwise plan 15-03 owns this addition.
- Update `runStore.saveCurrentRun` ([runStore.ts:56](src/renderer/src/stores/runStore.ts)) to `await buildRunSnapshot(metadata)`
- Split `useRunSnapshot` hook surface so `canSave` / `reason` stays sync (no IPC at every keystroke)
- NEW test file [useRunSnapshot.test.ts](src/renderer/src/features/run/hooks/__tests__/useRunSnapshot.test.ts) covering: all 10 fields packed when master panel + reagents present; nulls when no premix; `calculationRulesVersion = 'smoke3'` on every save; error surface when IPC throws

**Why second wave:** Depends on schema (15-01) and IPC (15-02). Without both, the snapshot can't be tested end-to-end.

**Estimated tasks:** 3-4.

### Plan 15-04 — Audit trail UI + SAPE row + advisory banner + override badge (Wave 2, parallelizable with 15-03 if banner/UI uses placeholder fields)

**Scope:**
- Add SAPE Name `<div>` row to `FinalizedRunHeader` `<dl>` ([FinalizedRunHeader.tsx:96-97](src/renderer/src/features/run/components/FinalizedRunHeader.tsx))
- NEW `HistoricalRunBanner.tsx` — pure presentation, conditional on `record.calculationRulesVersion !== 'smoke3'`
- NEW `AuditTrailSection.tsx` — single component per Discretion (split if blocks > 80 lines):
  - Inputs `<dl>` block (8 rows; override badges on Old Beads / Old Antibodies)
  - Intermediates `<dl>` block (6 rows; render `—` for missing fields)
  - Outputs `<dl>` block (5 rows; PE volume computed at render time via `computePEVolumeML`)
  - Diluent decision `<dl>` block (top branch label derived via `resolveDiluent` + 2-row mini table for verbatim diluent strings)
- Update `FinalizedRunView` ([FinalizedRunView.tsx:172-173](src/renderer/src/features/run/components/FinalizedRunView.tsx)) to insert `<HistoricalRunBanner />` + `<AuditTrailSection />` between `<FinalizedRunHeader />` and the actions row
- Optional pure-helper module `src/renderer/src/features/run/lib/auditTrailDerive.ts` for PE math + branch label derivation, with unit tests (avoids needing component render)

**Why second wave + parallelizable with 15-03:** UI work can proceed against the type definitions from 15-01 even before 15-03 wires up the actual save path. Visual integration is exercised in Phase 16 UAT.

**Estimated tasks:** 4-5.

### Plan 15-05 — Group M PE volume tests + advisory banner test + integration verification (Wave 3, depends on 15-01..15-04)

**Scope:**
- Add Group M to [calculator.integration.test.ts](src/renderer/src/lib/__tests__/calculator.integration.test.ts) covering 7 PE volume cases from CONTEXT.md `<specifics>`
- (If pure helper extracted in 15-04) extend `auditTrailDerive.test.ts` with branch-label cases from CONTEXT.md `<specifics>` (3 cases)
- Phase-15 cross-phase regression check: load a Phase-12 / Phase-14 fixture run through `runStore.loadRun`, assert `record.calculationRulesVersion` is null/undefined and the pre-existing snapshot fidelity (numberOfSetups, oldBeads, oldAntibodies) still works
- `npm test` full-suite green
- Update PROJECT.md / STATE.md / REQUIREMENTS.md "Validated" marker for SMK3-12, SMK3-15, SMK3-16, SMK3-17 (programmatic portion only — visual confirmation via Phase 16)
- Phase audit + ready-for-`/gsd-verify-work`

**Why last:** Locks in the math + integration verification once all upstream layers are in place.

**Estimated tasks:** 3-4.

### Plan dependency graph

```
Wave 1 (parallel):  [15-01 schema + repo + types]   [15-02 IPC + preload]
                                  │                          │
                                  └──────────┬───────────────┘
Wave 2 (parallel):  [15-03 async snapshot]   [15-04 UI + banner + SAPE row]
                                  │                          │
                                  └──────────┬───────────────┘
Wave 3:                          [15-05 PE math tests + integration]
```

**Total estimated plans:** 5. The planner has discretion to split or merge — e.g. 15-04 could split into "audit trail UI" and "SAPE row + banner" if the audit trail blocks turn out larger than expected, or 15-05 could merge into 15-04 if Group M tests fit the natural rhythm of UI work.

## Open Risks / Things to Watch

1. **`oldBeadsOverride` / `oldAntibodiesOverride` source state.** D-15-08 says these go on the run record from "save time" — but the calculator store (`capPaused: boolean` at [calculatorStore.ts:74](src/renderer/src/stores/calculatorStore.ts)) doesn't currently expose a per-reagent override-accepted flag. Phase 14's `OldReagentCapModal` may have wired this somewhere; plan author MUST verify before 15-03. **Risk:** if no such state exists yet, Plan 15-03 grows by 1-2 tasks (add per-reagent override-accepted state to `calculatorStore`, wire from `OldReagentCapModal`).
   - Mitigation: read [src/renderer/src/features/calculator/](src/renderer/src/features/calculator/) for existing override modal wiring before starting Plan 15-03. If `OldReagentCapModal` resolves directly to `setCapPaused(false)` without persisting which reagent was overridden, that state needs to be added.

2. **Async snapshot makes `useMemo` in `useRunSnapshot` hook problematic.** The current hook returns a synchronous `RunCreate | { error }` from `useMemo` (lines 149-155). Pattern 3 above splits the surface — but the planner must decide whether `useRunSnapshot` keeps the sync `canSave` / `reason` AND exposes a separate async `build` function, or whether the entire hook becomes a thin async wrapper. Recommended: keep gating sync, expose `build` as async (matches existing code with minimal renderer rewiring).

3. **`buildRunSnapshot` is called from `runStore.saveCurrentRun` AND from `useRunSnapshot.useMemo`.** If both call sites need to exercise the IPC fetch, the renderer pays for IPC at every keystroke (because `useMemo` re-runs whenever any subscribed slice changes). Solution: the `useRunSnapshot` hook does NOT call the async path — it ONLY runs the sync gates for `canSave` / `reason`. The async `build` (with IPC) fires only on Save click. Plan 15-03 must enforce this split clearly.

4. **Phase 16 UAT script depends on Phase 15's exact field labels.** CONTEXT.md `<code_context>` Integration Points note: any change to field labels, banner copy, or block ordering between Phase 15 ship and Phase 16 plan time invalidates Section A Step 8 + Section B SMK3-12/15/16/17 rows. The planner should treat the worked example in CONTEXT.md `<specifics>` as the locked label set.

5. **PE volume display in `Outputs` block is the ONLY display.** D-15-15 explicitly: PrepSheet's `VolumesSummary` keeps its current SA-PE volume rendering untouched. Operators may notice two different "PE" numbers (one in the recipe, one in the audit trail) until v1.x reconciliation — flag in UAT script.

6. **Migration order test** ([migration.test.ts:33-118](src/main/db/__tests__/migration.test.ts)) currently uses `applyMigrations(['0000_', '0001_', ...])` to test the 0004 migration in isolation. Phase 15's column-presence test should use the simpler `createTestDb()` pattern (which applies ALL migrations) — same as the Phase 14-08 test block at lines 369-417. No need to test 0009 in isolation against an "as-of-0008" DB unless a regression is suspected.

7. **Dev DB is NOT migrated by tests.** `npm run db:push` writes to the live `dev.db`. Plan author should run `db:push` after generating 0009 to confirm the migration applies cleanly to a populated dev DB. This is the same `[BLOCKING]` checkpoint pattern Phase 13-03 used.

8. **No fixture for "Phase 15 saved run" exists yet.** Plan 15-05's integration test will need a fixture — the simplest path is to create a run via `runRepository.create` with all 10 new fields populated, then read it back via `runRepository.getById`, assert each field. The renderer's `loadRun` cascade does NOT need to be tested (no new fields cascade into renderer stores — audit trail reads `RunRecord` directly).

## Sources

### Primary (HIGH confidence)

- [src/main/db/schema.ts](src/main/db/schema.ts) — table definitions verified line-by-line
- [src/main/db/repositories/run.ts](src/main/db/repositories/run.ts) — Phase 14-08 extension pattern verified at lines 85-87, 162-164
- [src/main/db/repositories/masterPanel.ts](src/main/db/repositories/masterPanel.ts) — `findByPlatformSpeciesName` + `getById` confirmed
- [src/main/db/repositories/masterPanelReagent.ts](src/main/db/repositories/masterPanelReagent.ts) — `findByMasterPanelId` confirmed
- [src/shared/types/run.ts](src/shared/types/run.ts) — `RunRecord` + `RunCreate` shapes verified
- [src/shared/types/diluent.ts](src/shared/types/diluent.ts) — `DiluentResult` discriminated union + `SelectedPremixForDiluent` + `PanelValuesDiluent` verified
- [src/renderer/src/features/run/hooks/useRunSnapshot.ts](src/renderer/src/features/run/hooks/useRunSnapshot.ts) — Phase 14-04 pattern verified at lines 109-117
- [src/renderer/src/features/run/components/FinalizedRunHeader.tsx](src/renderer/src/features/run/components/FinalizedRunHeader.tsx) — `<dl>` pattern verified at lines 70-138
- [src/renderer/src/features/run/components/FinalizedRunView.tsx](src/renderer/src/features/run/components/FinalizedRunView.tsx) — composition + insertion point verified at lines 170-240
- [src/renderer/src/lib/diluentResolver.ts](src/renderer/src/lib/diluentResolver.ts) — signature confirmed
- [src/renderer/src/lib/decimal.ts](src/renderer/src/lib/decimal.ts) — `ceilToTenthML` signature + behavior verified at lines 44-48
- [src/renderer/src/stores/selectionStore.ts](src/renderer/src/stores/selectionStore.ts) — `selectedPanel.masterPanelId` flow confirmed at lines 17, 198-208
- [src/renderer/src/stores/runStore.ts](src/renderer/src/stores/runStore.ts) — `saveCurrentRun` + `loadRun` cascade verified at lines 54-171
- [src/main/import/importer.ts](src/main/import/importer.ts) — `subPanelConc: pm.premixConc` confirmed at line 194
- [src/shared/constants/channels.ts](src/shared/constants/channels.ts) — full IPC inventory verified; no master-panel channel exists
- [src/preload/index.ts](src/preload/index.ts) — full preload surface verified
- [drizzle.config.ts](drizzle.config.ts) — schema path + output dir confirmed
- [drizzle/migrations/0008_runs_setups_and_old_reagents.sql](drizzle/migrations/0008_runs_setups_and_old_reagents.sql) — Phase 14-08 migration shape confirmed; Phase 15 follows the same `ALTER TABLE` per-statement pattern
- [vitest.config.ts](vitest.config.ts) — Node-only environment, `.test.ts`-only include confirmed
- [package.json](package.json) — drizzle scripts + test commands confirmed
- [src/main/db/__tests__/migration.test.ts](src/main/db/__tests__/migration.test.ts) — column-presence test pattern verified
- [src/main/db/repositories/__tests__/run.test.ts](src/main/db/repositories/__tests__/run.test.ts) — round-trip test pattern verified
- [src/renderer/src/lib/__tests__/calculator.integration.test.ts](src/renderer/src/lib/__tests__/calculator.integration.test.ts) — Group A-L verified, Group M is next free letter

### Secondary (MEDIUM confidence)

- `npm view drizzle-kit/drizzle-orm/vitest version` — registry calls returned 0.31.10 / 0.45.2 / 4.1.6; project versions are slightly behind but no upgrade impact for Phase 15
- Phase 14 documentation files (PATTERNS, VERIFICATION, REVIEW-FIX) confirming the vitest Node-only constraint and the manual-UAT routing pattern

### Tertiary (LOW confidence)

- None — every claim in this RESEARCH.md is grounded in a file-read or a registry call from the current session.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|

**This table is intentionally empty.** Every factual claim in this research was verified by reading the actual file in `/Users/pawj/Lab_Dev/immunoplex-assay-calculator/`. No `[ASSUMED]` claims remain. The only design decisions left to the planner (audit-trail component split, migration column for `calculationRulesVersion`, override badge styling) are all explicitly delegated to Claude's Discretion in CONTEXT.md.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — every package/version verified against `package.json` + `npm view`
- Architecture: HIGH — every file referenced was read; pattern claims have line-number provenance
- Pitfalls: HIGH — every "anti-pattern" claim is verified absent or present in the codebase via grep + file-read
- Async-snapshot risk: HIGH — the synchronous-to-async migration is the only architectural change; the `useMemo` complication is real but solvable via Pattern 3 split

**Research date:** 2026-05-12
**Valid until:** 2026-06-11 (30 days for stable codebase). Re-verify if Phase 15 work is delayed past then or if any of Phases 12-14 receive a follow-up patch.

## RESEARCH COMPLETE
