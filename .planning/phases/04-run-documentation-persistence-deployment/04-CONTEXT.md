# Phase 4: Run Documentation, Persistence & Deployment — Context

**Gathered:** 2026-04-22
**Status:** Ready for replanning (existing 04-01/02/03 plans predate this discussion and must be regenerated)

<domain>
## Phase Boundary

Save and reload run records in local SQLite, render a finalized "bench sheet" view that operators read from while running the assay, and package the app as a Windows `.exe` installer. One record = one lab request (can span multiple plates on a single platform). The finalized view reuses Phase 3's prep components in read-only mode. Packaging polish (appId, icon, signing) is explicitly deferred to post-v1.

**In scope:**
- Run record persistence (metadata + plate layout + analyte selection snapshot)
- Document & Save form (new wizard step 4)
- Finalized Run View (new wizard step 5) with print + edit warning + "Start New Run"
- Operators master list (CRUD via Manage page)
- Windows NSIS installer via electron-builder (functional only; no branding/signing)

**Out of scope (explicitly):**
- Cross-request Hamilton batching (real workflow exists; app ignores it)
- Per-well sample identity mapping (implicit from continuous-fill rule established in Phase 3.3)
- Run search / filter / export (v2: HIST-01, HIST-02, HIST-03)
- Lot numbers, photos, audit trail (v2: DOCM-02, DOCM-03, DOCM-04)
- Installer branding/signing (appId, custom icon, code signing, auto-updater)

</domain>

<decisions>
## Implementation Decisions

### Run Data Model

- **D-01:** One saved run = one lab request on one platform/species/panel. Multiple plates within the request share platform/species/panel/replicate mode/dilution factor. Cross-request batching (same Hamilton, different requests) is a real lab workflow but the app intentionally does not track it.
- **D-02:** Plate layout is serialized on every save and restored on load so the sample→well mapping survives save/load/print. Shape: per-plate sample counts (wells are always continuous starting from A4 per Phase 3.3, so a plate's state is fully describable by how many samples it holds). Exact schema shape — `platesJson: Record<plateNumber, string[]>` (Plan 04-01 Option C) vs per-plate sample counts — is a planning-stage call; round-trip fidelity is the hard requirement.
- **D-03:** Samples are numbered 1..N sequentially across plates (independent of plate number). A request with 80 samples on 2 plates has samples 1-80; whether they split 72/8, 40/40, or some other way is operator-driven.

### Required Metadata Fields (per run record)

| Field | Type | Source | Notes |
|---|---|---|---|
| `requestNumber` | integer, 1–99999 | new required form field | 5-digit headroom; currently 4-digit high-9000s. Display preserves leading zero for <10000 (format decision deferred to planning). |
| `requestOverrideAdHoc` | boolean | checkbox on form | When checked, `requestNumber` may be null (ad-hoc/training run). |
| `userName` | string | free text | The person submitting/requesting the run. |
| `operatorName` | string (FK to operators table) | managed dropdown | Seeded with: Joven, Terence, Jon, George, Cole, James, Alice, Kevin, CK. Editable via new Manage page. |
| `runDate` | ISO date string | date picker, defaults today | |
| `sampleType` | enum | dropdown | Supernatant, Lysate, Lavage, Plasma, Serum. |
| `dilutionFactor` | numeric | form field | The "1:X" ratio from the paper sheet. |
| `hamilton` | integer 1–5 | picker | Which Hamilton instrument was used. |
| `runPlatePosition` | integer 1–4 | picker | Plate reader slot. |
| `standardPosition` | integer 1–2 | picker | |
| `troughPosition` | integer 1–2 | picker | |
| `comments` | text | textarea | Unified free-text block replacing the paper sheet's separate "Standards Documentation" and "Documentation" sections. |
| `plex` | integer | auto-derived | `analyteIds.length` at save time, stored for archival/querying. |
| `plateCount` | integer | auto-derived | `plateStore.getPlateCount()` at save time. Not a form field. |
| `sampleCount`, `replicateMode`, `platformId`, `speciesId`, `panelId`, `requestType`, `volumePerWell`, `deadVolume` | (existing from Plan 04-01) | snapshot from stores | Unchanged from Plan 04-01. |

### UI Placement (wizard grows from 3 steps to 5)

- **D-04:** Existing wizard stays: (1) Platform & Species, (2) Analytes, (3) Calculations (with inline plate grid per Phase 3.3). Add two new steps.
- **D-05:** **Step 4 — "Document & Save":** New page after Calculations. Contents (top-to-bottom):
  - Bordered "Run Source" card with labeled rows: Platform / Species / Panel (or "Custom") / Sample count / Replicate mode / Plate count / Request type. Operator sanity-checks before saving.
  - Metadata form: Request Number (with override checkbox), User, Operator dropdown, Date (today by default), Sample Type dropdown, Dilution Factor, Hamilton picker, Run Plate Position, Standard Position, Trough Position, Comments textarea.
  - Save button (disabled + helper text when `canSave` is false from `useRunSnapshot`).
  - Collapsible "Past Runs" section (RunList) at the bottom.
- **D-06:** **Step 5 — "Finalized Run View":** Post-save destination. Read-only one-pager the operator reads at the bench. Contents: metadata header → reagent prep recipe (reuses `PrepSheet` from Phase 3) → reagent checklist (`ReagentChecklist`) → bead region list (`BeadRegionList`) → plate layout(s) rendered read-only (reuses `PlateGrid` in non-interactive mode). Plate labels: **"Request XXXXX — Plate N of M"**.
- **D-07:** Form defaults: `runDate` = today's ISO date; everything else blank. No auto-fill from last saved run in v1.

### Post-Save Behavior

- **D-08:** Successful save → navigate from step 4 to step 5 (finalized view). Stay there; no toast.
- **D-09:** Step 5 has a Print button that reuses the existing Phase 3 print IPC handler (`src/main/ipc/print.ts`). Print stylesheet renders just the run content without nav chrome.
- **D-10:** Step 5 has a "Start New Run" button that resets all stores (platform, selection, calculator, plate, run) and returns wizard to step 1. Operator controls when to move on — no auto-navigation.

### Edit + Load Safety

- **D-11:** Saved runs are **editable** — edit → save = UPDATE existing record by `runId`. `createdAt` preserved, `updatedAt` bumped.
- **D-12:** Going back from step 5 to any earlier step triggers a warning modal: *"This run is saved. Going back to edit will modify the saved record. Continue?"* — Yes unlocks editing; No stays on step 5. Warning fires on wizard Back button (not on top-nav changes; that's a full reset scenario).
- **D-13:** Once a run is loaded, **any** subsequent change (metadata or calculator or selection) counts as editing that run. Save = UPDATE. To create a new run based on a loaded one, operator clicks "Start New Run" on step 5 explicitly.
- **D-14:** **Dirty-state tracking**: stores expose a "has unsaved changes since last save/load" flag. Load from RunList:
  - If dirty: confirm modal *"You have unsaved changes. Discard and load Run #18?"*
  - If clean: load silently.
- **D-15:** Delete from RunList: confirm modal *"Delete saved run for Request 09421? This cannot be undone."* (one-click confirm, no typed confirmation).

### Backend Schema (deltas from Plan 04-01)

- **D-16:** Positions (`hamilton`, `runPlatePosition`, `standardPosition`, `troughPosition`) are **integers with fixed ranges**, not nullable text. Plan 04-01's current treatment as free text is wrong and must be replaced.
- **D-17:** Add `requestNumber` (integer, nullable only when `requestOverrideAdHoc` is true), `requestOverrideAdHoc` (boolean), `dilutionFactor` (real), `plex` (integer, auto-computed), `comments` (text, nullable).
- **D-18:** `platesJson` column stays on `runs` table (Plan 04-01's Option C survives). Shape confirmed: per-plate well assignment snapshot for faithful restore.
- **D-19:** `runSingleAnalytes` join table stays (Plan 04-01 shape). Panel analytes remain implicit via `panelId`.
- **D-20:** **New `operators` table**: `id`, `name` (unique), `active` (boolean, for soft hide), `createdAt`, `updatedAt`. Seed with the 9-name roster via migration. `runs.operatorId` becomes an FK to `operators.id`. Manage page gets an Operators section (CRUD, follows Phase 3.2 panel-management pattern).

### Frontend Stores (deltas from Plan 04-02)

- **D-21:** `runStore` orchestration model (snapshot across 4 stores, no state duplication) stays per Plan 04-02. Must also capture: plate layout (via `plateStore.plates`), all new position integers, dilution factor, comments, request number + ad-hoc flag, operator FK.
- **D-22:** Add dirty-state tracking: each store exposes a cheap "is dirty since last snapshot" signal (or `runStore` computes it by comparing current `.getState()` to a "last clean" reference captured on save/load/reset). Used for D-14 load safety.
- **D-23:** New `operatorsStore` (mirrors `platformStore` pattern): loads operators list, supports CRUD for the Manage page.
- **D-24:** On load, `plateStore` rehydration happens after `calculator.setSampleCount` so the auto-fill cascade doesn't clobber the restored layout. Order inside `loadRun`: platform → species → panel/analytes load → panel select → single analytes → replicateMode → sampleCount → plateStore.loadPlates(snapshot).

### Deployment (Plan 04-03)

- **D-25:** Windows NSIS installer via existing `npm run build:win`. Functional-only for v1.
- **D-26:** Explicitly deferred (document-and-move-on): custom `appId`, custom app icon, code signing, auto-updater placeholder URL. Windows SmartScreen "unrecognized app" click-through is acceptable for internal workstation deployment.
- **D-27:** Distribution mechanism (USB / network share / intranet) is not an app concern — out of scope.

### Claude's Discretion

- Exact request-number display format (store as integer, render as `padStart(4/5, '0')`?) — planner picks based on readability.
- Whether `operators` uses soft-delete (`active` flag) or hard-delete. `active` feels right for a lab roster but not a hill to die on.
- Exact dirty-state diff algorithm (shallow compare vs JSON-stringify snapshot reference). Cheap is fine.
- Whether the Comments textarea has a character limit or is unbounded.
- Modal styling (reuse existing Phase 3.2 confirm modal if one exists; otherwise inline Tailwind).

### Folded Todos

None — no pending todos matched Phase 4 scope at discussion time.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Project-level
- [.planning/PROJECT.md](.planning/PROJECT.md) — Active requirements (DOCM-01, PERS-01, PERS-02), domain rules, out-of-scope list.
- [.planning/REQUIREMENTS.md](.planning/REQUIREMENTS.md) §v1 §Traceability — DOCM-01 / PERS-01 / PERS-02 definitions and phase mapping.
- [.planning/ROADMAP.md](.planning/ROADMAP.md) §"Phase 4: Run Documentation, Persistence & Deployment" — locked success criteria.
- [CLAUDE.md](CLAUDE.md) — Windows-only test cycle (build .exe → install on Windows PC → manual verification); dev-branch-only commit rule; three-strike debug rule.

### Phase 4 artifacts (partially superseded by this CONTEXT)
- [.planning/phases/04-run-documentation-persistence-deployment/04-RESEARCH.md](.planning/phases/04-run-documentation-persistence-deployment/04-RESEARCH.md) — Drizzle ORM + Electron IPC + electron-builder NSIS patterns. Still valid for technical patterns; metadata field list is outdated (this CONTEXT supersedes).
- [.planning/phases/04-run-documentation-persistence-deployment/04-01-PLAN.md](.planning/phases/04-run-documentation-persistence-deployment/04-01-PLAN.md) — backend plan. **Needs rewrite:** position fields become integers, add requestNumber/dilutionFactor/plex/comments/operators table, keep platesJson.
- [.planning/phases/04-run-documentation-persistence-deployment/04-02-PLAN.md](.planning/phases/04-run-documentation-persistence-deployment/04-02-PLAN.md) — UI plan. **Needs rewrite:** integration is "wizard step 4 + new step 5", restore plate layout on load (not auto-fill), add finalized view, add dirty tracking, add edit warning.
- [.planning/phases/04-run-documentation-persistence-deployment/04-03-PLAN.md](.planning/phases/04-run-documentation-persistence-deployment/04-03-PLAN.md) — packaging plan. **Mostly still valid:** confirm deferral of appId/icon/signing/auto-updater.

### Upstream phase context
- [.planning/phases/03.3-analyte-selection-redesign/03.3-CONTEXT.md](.planning/phases/03.3-analyte-selection-redesign/03.3-CONTEXT.md) — plate grid continuous-fill rule (wells always start A4, can't skip within a plate), per-plate Excel-style selection, `plateStore.plates: Record<number, Set<string>>` shape.
- [.planning/phases/03.3-analyte-selection-redesign/03.3-04-SUMMARY.md](.planning/phases/03.3-analyte-selection-redesign/03.3-04-SUMMARY.md) — sampleCount propagation to plateStore.
- [.planning/phases/03.3-analyte-selection-redesign/03.3-06-SUMMARY.md](.planning/phases/03.3-analyte-selection-redesign/03.3-06-SUMMARY.md) — wizard integration pattern (`App.tsx` `currentPage` state).

### Code references (reuse in finalized view — step 5)
- `src/renderer/src/features/recipe/components/PrepSheet.tsx` — reagent prep recipe component.
- `src/renderer/src/features/recipe/components/ReagentChecklist.tsx`
- `src/renderer/src/features/recipe/components/BeadRegionList.tsx`
- `src/renderer/src/features/recipe/components/PrintButton.tsx` + `src/main/ipc/print.ts` — print IPC handler.
- `src/renderer/src/features/plate/components/PlateGrid.tsx` — must support a read-only mode for the finalized view.

### Code references (backend precedent for Plan 04-01 rewrite)
- `src/main/db/repositories/platform.ts` — repository pattern reference.
- `src/main/db/repositories/panel.ts` — transactional multi-table create reference.
- `src/main/db/schema.ts` — Drizzle schema file to extend.
- `src/main/db/migrate.ts` — migration runner; confirm it picks up new tables at startup.
- `src/shared/validation/platform.ts` — Zod pattern (note: uses `z.string().min(1)` for IDs, not `.uuid()`).

### Paper sheet reference
- Image shared during discussion (not committed) — source of truth for: 9-operator roster, 5-value sample type list, 4 position-integer fields with ranges (Hamilton 1-5, Run Plate Position 1-4, Standard Position 1-2, Trough Position 1-2), Dilution Factor field, Plex field, Comments area, "Thermo" platform label (= ProCartaPlex in DB — no rename needed; platform display name is a Phase 1 concern).

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets

- **Phase 3 recipe components** (`PrepSheet`, `ReagentChecklist`, `BeadRegionList`): render read-only in finalized view (step 5). Must accept data from a loaded run, not just the live calculator state.
- **Phase 3 print infrastructure** (`PrintButton` + `src/main/ipc/print.ts`): reuse for finalized view's Print button. No new print IPC needed.
- **`PlateGrid` / `WellCell`** (`src/renderer/src/features/plate/components/`): needs a read-only prop (`interactive={false}` or similar) so step 5 can render without hover/click affordances.
- **4 existing Zustand stores** (`calculatorStore`, `plateStore`, `platformStore`, `selectionStore`): snapshot sources for `runStore.saveCurrentRun`; rehydration targets for `runStore.loadRun`.
- **`plateStore.getPlateCount()`**: already computes plate count from sampleCount + replicateMode. `runStore` calls this for the auto-derived `plateCount` field.
- **Phase 3.2 CRUD pattern** (`panelRepository` + `panel` IPC + Manage page): template for the new `operators` CRUD.

### Established Patterns (from Phases 1 / 3.1 / 3.2)

- **Repository → IPC → preload → Zustand store** for every entity. `operators` and `runs` both follow this.
- **Zod validation at IPC boundary** with `z.string().min(1)` for IDs (not `.uuid()` — codebase convention).
- **Drizzle schema + `migrate.ts` auto-run at startup**. Research flagged migration as an open question; Plan 04-01's research task 1 confirms behavior.
- **`$inferSelect` / `$inferInsert` types at the bottom of `schema.ts`**: mirror this for `runs`, `runPlates` (if used), `runSingleAnalytes`, `operators`.
- **`crypto.randomUUID()`** for all primary keys.
- **IPC channel naming**: `"<entity>:<verb>"` (e.g., `"run:get-all"`, `"operator:create"`). Grouped by entity in `src/shared/constants/channels.ts`.

### Integration Points

- `src/renderer/src/App.tsx` — wizard page switching via `currentPage` state. Extend from 3 steps to 5 (or decouple step 5 as post-save "Finalized" view state, separate from `currentPage`). Planner's call.
- `src/renderer/src/features/manage/` — existing Manage page. Add Operators CRUD as a new section alongside Analytes / Panels.
- `src/preload/index.ts` + `src/preload/index.d.ts` — add `electronAPI.run` and `electronAPI.operator` namespaces.
- `src/main/ipc/index.ts` — register `registerRunHandlers` and `registerOperatorHandlers` alongside existing calls.

### Creative Options (constraints from existing architecture)

- Finalized view can be **a fifth wizard page** or **a separate top-level mode**. Given the edit-warning-on-back decision, a wizard page feels natural (Back button is the trigger). Planner confirms.
- Dirty-state flag can be **per-store** (each store self-reports) or **centralized in `runStore`** (snapshots a reference on load/save/reset, compares on demand). Centralized is simpler; start there.

</code_context>

<specifics>
## Specific Ideas

- **Paper sheet as UX anchor**: the Document & Save form should visually resemble the paper sheet layout (field order: User → Date → Operator → per-plate section). Reduces training friction for operators who have been filling the paper sheet for years.
- **Plate label text exactly**: "Request 09421 — Plate 1 of 2" (5-digit padded request with the em-dash). Use on plate toolbar, finalized view headings, and printed output.
- **Platform label on finalized view**: show the app's stored platform name ("ProCartaPlex"), not the paper sheet's shorthand ("Thermo"). If operators push back that they want "Thermo" wording, that's a Phase 1 concern (rename in platforms table), not a Phase 4 scope creep.
- **Request # override checkbox wording**: "Ad-hoc run (no request number)" — explicit about what the checkbox means.
- **Comments field placeholder**: "Notes about this run — anything useful for next time you see it in the log."
- **Edit warning modal copy**: "This run is saved. Going back to edit will modify the saved record. Continue?" with "Keep viewing" (primary) and "Edit anyway" (secondary, destructive style).
- **Dirty-load modal copy**: "You have unsaved changes. Discard and load Run for Request 09421?"
- **Delete modal copy**: "Delete saved run for Request 09421? This cannot be undone."

</specifics>

<deferred>
## Deferred Ideas

### Out of Phase 4 (v2 or later)
- **Search / filter on RunList** — HIST-01, HIST-02. RunList in v1 is chronological, no filter.
- **Export runs to CSV/PDF** — HIST-03.
- **Lot numbers on reagents** — DOCM-02.
- **Camera photo attachment** — DOCM-03.
- **Audit trail of run modifications** — DOCM-04. Current model: edit silently overwrites `updatedAt`; no history table.
- **Interactive 96-well visualization with drag-drop** — PLAT-02/03/04.
- **Cross-request Hamilton batching** — real lab workflow but intentionally not tracked in app.
- **Cloud sync / multi-user** — out of scope per PROJECT.md.

### Deferred within Phase 4 (noted but acceptable gaps)
- **Installer branding** — custom appId (still `com.electron.immunoplex-assay-calculator`), custom icon (Electron default), code signing (Windows SmartScreen click-through), auto-updater URL placeholder. All acceptable for internal v1.
- **Auto-fill "remember last operator"** on Document & Save form defaults. Deferred per D-07 — can add in a later tweak if operators ask.
- **Character limit on Comments** — unbounded in v1; if SQLite perf becomes an issue later, add a limit.
- **Soft-delete for operators** — `active` flag pattern assumed but hard-delete is also fine; Claude's discretion during planning.

### Reviewed Todos (not folded)
None — no pending todos matched Phase 4 at discussion time.

</deferred>

---

*Phase: 04-run-documentation-persistence-deployment*
*Context gathered: 2026-04-22*
*Supersedes: metadata field assumptions in 04-RESEARCH.md and Plans 04-01 / 04-02. Plans must be regenerated via `/gsd-plan-phase 4` after this context is committed.*
