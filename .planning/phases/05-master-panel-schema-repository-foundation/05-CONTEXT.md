# Phase 5: Master-Panel Schema & Repository Foundation - Context

**Gathered:** 2026-04-23
**Status:** Ready for planning

<domain>
## Phase Boundary

Pure database-layer substrate for the v2.0 milestone. This phase ships:

- A new `master_panels` table keyed by composite unique `(platform_id, species_id)` that anchors **three** reagent volumes (beads / Ab / SAPE) and the vendor singles term per (platform, species) pair.
- New nullable `master_panel_id` FK columns on `analytes` and `premix_panels`.
- A new `sub_panel_conc REAL NOT NULL` column on `premix_panels` (1 for regular premix, 20 for JAMMate-style sub-panel concentrates).
- `PRAGMA foreign_keys = ON` in every opened DB connection.
- Two repository methods — `masterPanelRepository.upsertByPlatformAndSpecies(...)` and `analyteRepository.upsertByNameInMaster(...)` — with a `{ id, action: 'created' | 'adopted' | 'updated' }` return shape for Phase 7's import banner.

No UI, no IPC handler, no xlsx parser, no calculator wiring. Phases 6-9 consume this.

</domain>

<decisions>
## Implementation Decisions

### Open Decisions Locked (release-gating OD-1/2/3 + all riding ODs)

- **D-01 (OD-1):** Hard-cut replace of v1 CSV importer. v1 UI trigger is removed in the same phase that ships the v2 xlsx import button (Phase 7). v1 IPC handler stays registered so existing tests still import, but is unreachable from the UI. Rationale: Pitfalls 21 / 22 (mixed v1/v2 imports, bead_region drift via v1 re-import) are eliminated by design.
- **D-02 (OD-2):** Strict calculator resolution. `getEffectiveVolumePerWell()` throws a visible error when no `master_panel_id` is set on the run's panel. Rationale: current DB contents are dummy data; when v2 ships, every panel will be re-imported via xlsx → every run will have a master. No transition window, no graceful fallback, no `DEFAULT_VOLUME_PER_WELL = 25` fallback path. Pitfall 4 provenance display still required for the pass-case ("From master panel: Cytokines (50 µL)") so operators always see which source supplied the number.
- **D-03 (OD-3):** Vendor singles term renders in two places only — the `AnalyteGrid` section header and the "No Premix (Custom Assay)" chip (becomes "No Premix (Custom Singleplex)" when a vendor term is present). Wizard step labels, Manage page, and cross-panel views stay generic. Fall back to "Analytes" / "Custom Assay" when master is `NULL` or term is blank.
- **D-04 (OD-7):** xlsx col C ("Single Concentration" per Row 13 header in the real fixture) → `analytes.single_conc`. `analytes.premix_conc` becomes dead code in the xlsx import path — with D-01 hard-cut, no v1-imported data references it post-v2.0 either. `premix_conc` is flagged for removal in v2.1 but stays in the schema for Phase 5 (avoids dropping a NOT NULL column in the same migration as the additive schema delta — Pitfall 12).
- **D-05 (OD-4):** Orphan dropped premixes. Re-import drops a premix from the xlsx → the premix row stays in `premix_panels` with `master_panel_id` still set. Historical runs that referenced it continue to load. A future "cleanup orphaned premixes" admin action lives in v2.1+.
- **D-06 (OD-5):** Strict file-level reject. Validator collects every error across every tab before any DB write. If any error anywhere in the file, zero DB writes happen. Happy path: single `better-sqlite3` transaction wraps all per-tab writes (Pitfall 27).
- **D-07 (OD-6):** No A5 format-version marker in v2.0. Defer to v2.1 alongside a canonical template update.
- **D-08 (OD-8):** xlsx is authoritative on every re-import. `master_panels.name` gets overwritten from B1 on every upload. Operator edits via the Manage UI do not survive re-import. Document in UI help text that re-upload overrides manual name edits.

### Schema Delta (this phase)

- **D-09:** New table `master_panels` with columns:
  - `id` TEXT PRIMARY KEY
  - `platform_id` TEXT NOT NULL FK → `platforms.id`, `onDelete: 'restrict'` (declared explicitly — Pitfall 13)
  - `species_id` TEXT NOT NULL FK → `species.id`, `onDelete: 'restrict'`
  - `name` TEXT NOT NULL (from B1 / B2 on the vendor fixture)
  - `beads_volume_per_well` REAL NOT NULL (from B6 — capture-antibody bead volume)
  - `ab_volume_per_well` REAL NOT NULL (from B7 — biotinylated-antibody volume)
  - `sape_volume_per_well` REAL NOT NULL (from B8 — streptavidin-PE volume)
  - `vendor_singles_term` TEXT NULL (from A10 — e.g. "Mapmates" / "Singleplex" / "Simplex")
  - `created_at`, `updated_at` TEXT NOT NULL
  - Composite `uniqueIndex('master_panels_platform_species_uniq').on(platformId, speciesId)` — Drizzle composite-index form, NOT column-level `.unique()` (Pitfall 14).
- **D-10:** Alter `premix_panels` — add `master_panel_id` TEXT NULL FK → `master_panels.id`, `onDelete: 'set null'`; add `sub_panel_conc` REAL NOT NULL (1 for regular premix, 20 for JAMMate-style sub-panels — from Row 11 of the vendor fixture).
- **D-11:** Alter `analytes` — add `master_panel_id` TEXT NULL FK → `master_panels.id`, `onDelete: 'set null'`. Leave `premix_conc` untouched (flagged for v2.1 removal).
- **D-12:** Add `sqlite.pragma('foreign_keys = ON')` in `initializeDatabase()` at [src/main/db/client.ts:19](src/main/db/client.ts#L19), immediately after `journal_mode = WAL`. This is SC #4 and closes a pre-existing gap (FK constraints have never actually been enforced on this DB).
- **D-13:** Single Drizzle migration file generated via one `drizzle-kit generate` pass. No data-backfill step (dummy data per D-02; no v1 rows to adopt). Inspect the generated SQL to grep-confirm the composite `CREATE UNIQUE INDEX` emits correctly (SC #2, drizzle-kit issue #3411).
- **D-14:** Do NOT rename `premix_panels` → `panels` (Pitfall 15). Add a schema.ts block comment documenting the master-vs-premix distinction so future readers don't introduce a second `panels` table.
- **D-15:** Existing pre-v2 FKs stay as-is. Declaring explicit `onDelete` rules on every pre-v2 FK is scope creep for Phase 5 — flag as future cleanup phase.

### Repository API (this phase)

- **D-16:** `masterPanelRepository.upsertByPlatformAndSpecies({platformId, speciesId, name, beadsVolumePerWell, abVolumePerWell, sapeVolumePerWell, vendorSinglesTerm}) → { id, action }`:
  - Lookup: exact `(platform_id, species_id)` composite match (IDs are normalized; names are not).
  - On match → UPDATE all fields except `id` and `created_at`; `action: 'updated'`.
  - On miss → INSERT with new `crypto.randomUUID()` id; `action: 'created'`.
- **D-17:** `analyteRepository.upsertByNameInMaster({name, platformId, speciesId, masterPanelId, beadRegion, concentration}) → { id, action }`:
  - Lookup: case-insensitive `(name, platform_id, species_id)` via the existing `lower(name) = lower(?)` pattern at [src/main/db/repositories/analyte.ts:60-74](src/main/db/repositories/analyte.ts#L60-L74).
  - On match with `master_panel_id IS NULL` → UPDATE `(bead_region, single_conc, master_panel_id, updated_at)`; `action: 'adopted'` (Pitfall-1 critical gate).
  - On match with `master_panel_id IS NOT NULL` → UPDATE `(bead_region, single_conc, master_panel_id, updated_at)`; `action: 'updated'`.
  - On miss → INSERT with new `crypto.randomUUID()` id, `master_panel_id` set; `action: 'created'`.
  - `premix_conc` is NEVER touched by this method.
- **D-18:** Neither upsert method opens its own transaction. The Phase 7 importer wraps all per-tab writes in one `better-sqlite3` transaction (Pitfall 27).
- **D-19:** Premix-panel upsert method (`upsertByMasterAndName` or similar, writing `master_panel_id` + `sub_panel_conc`) is NOT in Phase 5 scope — belongs to Phase 7 importer. Phase 5 only ships the two methods listed above.

### Claude's Discretion

- Drizzle `relations()` declarations for the new table and FKs.
- TypeScript type exports (`MasterPanel`, `NewMasterPanel`, update to `PremixPanel`, `Analyte` inferred types).
- `shared/types/` updates (new `masterPanel.ts`, additions to `panel.ts` / `analyte.ts`).
- Exact migration filename suffix (drizzle-kit auto-generates).
- Index ordering within the migration file.
- Test fixture structure (programmatic generation via `better-sqlite3` in-memory DB — follows existing repo test conventions).

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Authoritative vendor xlsx format
- `.planning/phases/05-master-panel-schema-repository-foundation/05-CONTEXT.md` (this file) §Schema Delta — the real fixture (Millipore Mouse Panel 1) supersedes the grid in PANEL-UPLOAD-V2-SPEC.md. Row-14+ analyte rows, Row 10 premix discovery, Row 11 sub_panel_conc, B6/B7/B8 three reagent volumes, A10 vendor singles term.
- `.planning/PANEL-UPLOAD-V2-SPEC.md` — **OUTDATED as of 2026-04-23** relative to the real vendor fixture. Decisions on idempotency, open-decisions lineage, and data-model philosophy still apply; the per-tab layout grid (rows 1-8, premix discovery on Row 6, single B4 reagent volume) does NOT match the real fixture and must be rewritten before Phase 6 discuss-phase.

### v2.0 data model + requirements
- `.planning/REQUIREMENTS.md` §MPAN-01 through MPAN-06 — master-panel data model requirements. **MPAN-01 wording needs update** (says "`reagent_volume_per_well`" singular; actual schema ships three volume columns).
- `.planning/REQUIREMENTS.md` §CALV-01 through CALV-03 — calculator wiring requirements; JAMMate dilution math is new vs v1's hardcoded 1× premix assumption, affects Phase 8.
- `.planning/REQUIREMENTS.md` §PIMP-01 through PIMP-10 — parser/importer requirements. **PIMP-02 wording needs update** (says "B1/B2/B3/B4 and optional A6"; actual fixture uses B1/B2/B3 + B6/B7/B8 + A10).
- `.planning/ROADMAP.md` §Phase 5 — goal, success criteria, open-decision annotations. **Phase 8 SC #3 wording needs retroactive edit** (currently says "graceful priority order"; D-02 locked it as strict, no fallback).

### Pitfalls research
- `.planning/research/PITFALLS.md` Pitfall 1 — Nullable FK backfill (adoption-upsert critical gate; SC #5 hinges on this).
- `.planning/research/PITFALLS.md` Pitfall 2 — Unique constraint ordering (add index with table, not after backfill).
- `.planning/research/PITFALLS.md` Pitfall 12 — Schema → backfill → constraint-tightening sequence.
- `.planning/research/PITFALLS.md` Pitfall 13 — FK cascade rules (declare explicitly; `onDelete: 'set null'` downward from master_panels, `'restrict'` upward to platforms/species).
- `.planning/research/PITFALLS.md` Pitfall 14 — Composite unique index via `uniqueIndex().on(...)`, not column-level `.unique()`; grep generated SQL.
- `.planning/research/PITFALLS.md` Pitfall 15 — Keep `premix_panels` table name; do not rename.
- `.planning/research/PITFALLS.md` Pitfall 27 — Validate-across-all-tabs, then single transaction (Phase 7 concern, not Phase 5, but upsert methods are designed around it).

### Existing code to extend or reuse
- [src/main/db/schema.ts](src/main/db/schema.ts) — current Drizzle schema. `premixPanels` at line 22 (keep name), `analytes` at line 36. Add new `masterPanels` export + new columns + new type exports.
- [src/main/db/client.ts:19](src/main/db/client.ts#L19) — currently lacks `PRAGMA foreign_keys = ON`. D-12 closes this gap.
- [src/main/db/repositories/analyte.ts:60-74](src/main/db/repositories/analyte.ts#L60-L74) — existing case-insensitive `findByNamePlatformSpecies` pattern that `upsertByNameInMaster` reuses verbatim.
- [src/main/db/repositories/panel.ts:52-66](src/main/db/repositories/panel.ts#L52-L66) — analogous `findByNamePlatformSpecies` on `premix_panels` (reused by the Phase 7 premix upsert, not this phase).
- [src/shared/constants/calculator.ts:21](src/shared/constants/calculator.ts#L21) — `DEFAULT_VOLUME_PER_WELL = 25`. With D-02 strict, this becomes unreferenced constant post-Phase 8 but stays for now (removing would be scope creep on Phase 5).
- [src/main/db/schema.ts:99](src/main/db/schema.ts#L99) — `runs.volume_per_well` is already `NOT NULL` and captured at save time. Pitfall 5 historical preservation is already schema-correct; no change needed in Phase 5.
- [drizzle/migrations/0003_damp_prima.sql:46-49](drizzle/migrations/0003_damp_prima.sql#L46-L49) — example of current FK declaration style (`ON UPDATE no action ON DELETE no action`). New FKs added in this phase declare cascade rules explicitly.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets

- **`findByNamePlatformSpecies` pattern (analyte.ts:60, panel.ts:52)** — case-insensitive `sql\`lower(${col}) = lower(${val})\`` match that `upsertByNameInMaster` mirrors exactly. Do not invent a new matcher.
- **`crypto.randomUUID()` PK generation** — convention across every existing `create()` method (analyte.ts:43, panel.ts:71). `masterPanelRepository.upsertByPlatformAndSpecies` follows the same style on the INSERT path.
- **`{ createdAt, updatedAt } = new Date().toISOString()`** — convention across all repositories. Master panel repository mirrors it.
- **Drizzle `and(eq(...), eq(...))`** — composition used throughout `panel.ts` / `analyte.ts`. Same style applies for the `(platform_id, species_id)` composite lookup in `upsertByPlatformAndSpecies`.

### Established Patterns

- **Repository = pure data-access layer.** No IPC knowledge, no Zod validation, no business logic. Phase 7 importer is the orchestrator that validates + transacts + calls upserts in order.
- **Migrations are drizzle-kit generated, not hand-edited.** Migration 0003 kept its auto-generated name to avoid touching `_journal.json` (decision log entry from 04-01).
- **`better-sqlite3` is synchronous.** All upsert methods are synchronous. Caller handles transactions via `db.transaction(() => { ... })`.
- **Schema changes land with TypeScript type exports.** Every new table gets a `$inferSelect` + `$inferInsert` pair at the bottom of `schema.ts`.

### Integration Points

- **Phase 7** — Importer calls `upsertByPlatformAndSpecies` per tab, then `upsertByNameInMaster` per master-list row inside a single `db.transaction()` wrapping all tabs.
- **Phase 8** — Calculator resolver reads from `master_panels` (three reagent-volume columns — caller picks which one based on reagent kind) and `premix_panels.sub_panel_conc` (for JAMMate dilution math). Phase 5 schema defines both; Phase 8 wires them.
- **`initializeDatabase()`** — D-12 adds `PRAGMA foreign_keys = ON` here. Once ON, every subsequent query in the app enforces FK constraints, including the pre-v2 FKs that were previously never enforced. If any pre-v2 data violates FK constraints (unlikely on dummy data but possible), migrations will surface it at next boot. Flag in Phase 9 UAT.

</code_context>

<specifics>
## Specific Ideas

### The real vendor fixture (Millipore Mouse Panel 1 screenshot, 2026-04-23)

Authoritative per-tab layout — supersedes PANEL-UPLOAD-V2-SPEC.md §Per-tab layout:

```
        A                         B                C                      D                   E                        F              G              ...
Row 1  │ Panel Name              │ Millipore Mouse Panel 1  │             │                   │                         │              │              │
Row 2  │ Platform                │ Millipore               │             │                   │                         │              │              │
Row 3  │ Species                 │ Mouse                   │             │                   │                         │              │              │
Row 4  │ (blank)                 │                         │             │                   │                         │              │              │
Row 5  │ Reagent Volume          │                         │             │                   │                         │              │              │
Row 6  │ Beads                   │ 25                      │             │                   │                         │              │              │
Row 7  │ Ab                      │ 25                      │             │                   │                         │              │              │
Row 8  │ SAPE                    │ 25                      │             │                   │                         │              │              │
Row 9  │ (blank)                 │                         │             │                   │                         │              │              │
Row 10 │ Mapmates                │                         │             │                   │ Premix PANEL I 33-plex  │ JAMMate A    │ JAMMate B    │
Row 11 │                         │                         │             │ sub-panel conc    │ 1                       │ 20           │ 20           │
Row 12 │ (blank)                 │                         │             │                   │                         │              │              │
Row 13 │ Target                  │ Bead Region             │ Single Concentration │          │ Target                  │ Target       │ Target       │
Row 14+│ <analyte>               │ <bead region int>       │ <single conc, e.g. 20> │        │ <analyte name>          │ <analyte>    │ <analyte>    │
```

Key insights vs the old spec:

- **Three reagent volumes (B6/B7/B8)** — Beads / Ab / SAPE, not a single B4.
- **Vendor singles term at A10** — "Mapmates" is Millipore's Singleplex-equivalent label. Old spec had it at A6.
- **Premix discovery at Row 10** — names in E10, F10, G10, … Old spec said Row 6.
- **Sub-panel concentration at Row 11** — per-premix concentration value (1 = normal premix, 20 = JAMMate concentrate). Old spec had no sub-panel conc concept.
- **"Single Concentration" header at C13** — explicit label confirms OD-7 mapping (col C → `single_conc`).
- **Analyte rows start at Row 14** — row numbering shifted due to three reagent volume rows + Mapmates row.

### JAMMate domain context

- JAMMate = Millipore's sub-panel concentrate product line. Ships as a mini-premix at ≥ 1× (typically 20×) so the operator can dilute into the main premix master mix.
- Regular premix = 1× ready-to-use (typical case; no dilution math beyond mixing sample).
- Calculator math for a run using JAMMate: volume_to_add = master_mix_volume / sub_panel_conc (analogous to single-addition math at the premix scope). This is new vs v1's hardcoded 1× premix assumption. Phase 8 work.

### Domain confirmation pending

The user's colleague will verify the exact `single_conc` and `sub_panel_conc` numbers on their own computer later. Dummy values in the current DB are acceptable for Phase 5 planning / execution. Schema is correct; values are input-data-only.

</specifics>

<deferred>
## Deferred Ideas

### Doc debt to address before Phase 6 discuss-phase (NOT Phase 5 scope)

- **Rewrite `.planning/PANEL-UPLOAD-V2-SPEC.md` §Per-tab layout** to match the real vendor fixture (Row 14+ analytes, B6/B7/B8 three reagent volumes, Row 10 premix discovery, Row 11 sub-panel conc, A10 vendor singles term). Old grid is outdated.
- **Update `.planning/REQUIREMENTS.md` MPAN-01 wording** — currently says "`reagent_volume_per_well`" singular; reality ships three volume columns.
- **Update `.planning/REQUIREMENTS.md` PIMP-02 wording** — currently says "B1/B2/B3/B4 and optional A6"; reality is "B1/B2/B3 + B6/B7/B8 + A10".
- **Update `.planning/ROADMAP.md` Phase 8 SC #3** — currently says "graceful priority order"; D-02 locked it as strict (no graceful fallback).

### Out of Phase 5 scope (future phase work)

- **Phase 8 calculator JAMMate math** — dilution from sub_panel_conc ≠ 1 is new math. CALV-01 needs a resolver signature that accepts the premix's sub_panel_conc, not just reagent volume. Not Phase 5 concern; schema supports it.
- **v2.1 `analytes.premix_conc` removal** — becomes dead column post-v2.0. Drop via separate migration in v2.1 after verification that no code path reads it.
- **v2.1 orphan cleanup admin action** — surfaces premixes with `master_panel_id` set but no longer in any xlsx (per D-05).
- **v2.1 A5 format-version marker** (D-07) — add alongside canonical template update.
- **Existing FKs cleanup pass** — declare explicit `onDelete` rules on every pre-v2 FK for hygiene. Scope creep for Phase 5; flag as future cleanup phase.

### Not in scope

- Preview-before-commit UI (PIMP-11 deferred).
- Round-trip xlsx export (spec §Non-goals).
- Template download from the app (spec §Non-goals).
- Master-panel delete UI (deliberately out of v2.0; cascade rules are declared anyway per D-09 so a future delete is safe).

</deferred>

---

*Phase: 05-master-panel-schema-repository-foundation*
*Context gathered: 2026-04-23*
