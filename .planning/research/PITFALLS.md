# Pitfalls Research — v2.0 Panel XLSX Upload + Master-Panel Data Model

**Domain:** Subsequent-milestone feature add (multi-tab xlsx ingest + data-model delta) on a shipped Electron + Drizzle/SQLite lab calculator
**Researched:** 2026-04-23
**Confidence:** HIGH (drawn from the v2 spec, v1 importer source, current schema state, and direct domain experience — not from web search)

**Scope boundary:** This file covers pitfalls *specific to v2.0*. General domain pitfalls (floating-point math, bead region collisions, lot tracking, recipe ambiguity) are already catalogued in `.planning/research/v1.0-archive/PITFALLS.md` and are not repeated here. General Electron/Drizzle/SQLite pitfalls (IPC injection, WAL mode, better-sqlite3 rebuild) are likewise out of scope.

**Phase-ownership vocabulary** used below — these are suggestions for the roadmapper, not prescriptions:

- **schema** — Drizzle schema + migration phase
- **parser** — xlsx parsing + cell-level extraction phase
- **validator** — cross-tab validation + error collection phase
- **ipc** — main-process IPC handler + error surfacing phase
- **ui** — renderer UI (import button, result banner, vendor-term rollout)
- **calculator** — reagent-volume lookup wiring
- **verification** — fixtures, smoke tests, UAT matrix

---

## Critical Pitfalls

### Pitfall 1: Nullable FK backfill corrupts v1-imported data on first v2 re-import

**What goes wrong:**
The migration adds `master_panel_id` FK columns to `analytes` and `panels` as nullable. All existing v1-imported rows carry `master_panel_id = NULL` — this is intentional and correct. But the first v2 upload for a `(platform, species)` pair that *already has v1-imported analytes* must decide: adopt the existing analytes (update their `master_panel_id` to the new master) or leave them orphaned and create duplicates. If the importer just blindly `insert`s, you end up with two rows for "IL-6 / Milliplex / Human" — one with `master_panel_id = NULL` (the v1 row) and one with the new FK set. Run records pointing at the v1 `analyte.id` continue to work, but the Manage UI now shows a duplicate, and subsequent v2 uploads upsert the *wrong* row (whichever happened to come first in the query).

**Why it happens:**
`analyteRepository.findByNamePlatformSpecies` already does case-insensitive match on `(name, platform_id, species_id)`. It does not consider `master_panel_id` at all. The importer (v1) uses a find-or-create pattern, which is fine for v1. But v2 must decide whether the "find" side *adopts* the existing row into its new master (update `master_panel_id` on the existing row) or treats the existing row as foreign (insert a new one). The v2 spec §Idempotency says "upsert semantics" and "matched by `(name, platform_id, species_id)`" — that is the correct rule, but only if implemented as an explicit UPDATE that sets `master_panel_id` on the existing row, not a fresh INSERT.

**How to avoid:**
- Upsert rule, stated once: on v2 import, for each master-list row, look up `(name, platform_id, species_id)` case-insensitive; if found, UPDATE `bead_region`, `concentration`, `master_panel_id` on the existing row; if not found, INSERT. Never insert when a match exists.
- Write a failing test fixture that mirrors real state: seed DB with a v1-imported IL-6 row (master_panel_id = NULL), run v2 import for the same platform/species, assert: exactly one IL-6 row exists, `master_panel_id` is now populated.
- Manage-UI check: the analyte list for a given (platform, species) must deduplicate by `lower(name)` at query time as a belt-and-braces guard. If duplicates ever appear, surface a warning banner.

**Warning signs:**
- Two "IL-6" rows in the analyte picker after a v2 re-import of a panel that was previously v1-imported.
- `SELECT name, COUNT(*) FROM analytes GROUP BY lower(name), platform_id, species_id HAVING COUNT(*) > 1` returns rows.
- Run records silently breaking on reload because `analyteId` resolves to a row that's been orphaned by a subsequent upsert.

**Phase ownership:** schema + parser (migration defines nullability; importer implements adoption rule).

---

### Pitfall 2: Unique constraint on `master_panels(platform_id, species_id)` gets added before backfill

**What goes wrong:**
The migration sequence matters. If the migration does `CREATE UNIQUE INDEX master_panels_platform_species_uniq ON master_panels(platform_id, species_id)` in the same migration as any backfill SQL that inserts more than one row per pair, the migration fails halfway and leaves the DB in a mixed state. SQLite does not have a safe "try index, rollback on duplicate" — the transaction either succeeds or leaves partial work depending on journal mode.

More subtly: if the migration creates the index *before* inserting any rows, fine — the uniqueness is enforced from t=0. But if there is any branch where `master_panels` gets seeded (e.g., a post-install "seed from existing panels" migration someone adds later), ordering matters.

**Why it happens:**
Drizzle's `drizzle-kit generate` produces a single migration file per schema delta. If you `generate` twice (once for the table, once for the index), you get a consistent order. But if you edit schema.ts and re-generate, drizzle-kit may bundle the table creation and index into one migration, and the default order is CREATE TABLE → CREATE INDEX — which is correct for an empty table. The pitfall surfaces when someone later writes a data-migration script that seeds rows in a *separate* migration file, forgets which ran first, or rolls back and replays in a non-clean order.

**How to avoid:**
- Migration 1: create `master_panels` table + unique index `(platform_id, species_id)`. No data migration. Deploy this alone.
- Migration 2 (separate file): add nullable `master_panel_id` column to `analytes` and `panels`. No data migration. Deploy.
- Migration 3 (if ever needed): any backfill SQL. Run after the FK columns exist. No schema changes.
- Never combine a schema change and a data backfill in the same migration file. If a backfill is needed, it goes in its own migration *after* the schema migration.
- Inspect the generated SQL in `drizzle/migrations/000N_*.sql` before committing — drizzle-kit occasionally reorders statements in ways that are correct but surprising.

**Warning signs:**
- `migrate()` throws `UNIQUE constraint failed: master_panels.platform_id, master_panels.species_id` at app startup.
- Dev DB has two master_panels rows for the same pair because an earlier run created one and a retry created another.
- CI test fixture loads fail because migrations were applied in an order the test harness didn't expect.

**Phase ownership:** schema.

---

### Pitfall 3: Re-import upsert is non-deterministic when master panel `name` differs from stored name

**What goes wrong:**
The spec matches master panels by `(platform_id, species_id)` only — `name` is updatable. Correct. But when the importer finds the match, it overwrites `name` with whatever's in B1 of the tab. If an operator renames a panel in the Manage UI (e.g., from "Cytokines" to "Cytokines Panel A") and then re-uploads the *original* file, the name silently reverts to "Cytokines." Worse: if two tabs in the same file happen to have the same `(platform, species)` (operator error), the second tab silently overwrites the first, and no validation error is raised.

**Why it happens:**
Upsert-by-composite-key is the right rule for identity, but "last write wins" for *content* is often wrong when users edit downstream. Also: the spec says one tab = one master panel, but doesn't say two tabs can't claim the same `(platform, species)`. The parser must detect and reject that collision *within* a file as a validation error before any DB write.

**How to avoid:**
- Within a single file, detect duplicate `(platform, species)` across tabs and reject the whole file (or reject the second-and-later tabs, depending on open decision 5 strict-vs-partial). Do this in the validator before any DB write.
- Confirm with stakeholders whether operator-edited master panel names should survive re-import. If yes, add a `name_locked` boolean to `master_panels` and skip the name update when set. If no, document in UI help text that re-upload overwrites name.
- Re-upload idempotency test: upload file → edit name in UI → re-upload same file → assert expected behavior (whichever was decided).

**Warning signs:**
- Operator reports: "I renamed this panel and it went back to the vendor name after re-upload."
- Same-file collision: file has two tabs both claiming "Milliplex / Human" → one wins silently, operator loses data.
- The result banner reports "Imported 3 master panels" when the file has 4 tabs.

**Phase ownership:** validator + ui.

---

### Pitfall 4: Calculator silently falls back to platform default when master-panel FK is missing

**What goes wrong:**
Spec open decision 2 (calculator strictness) is unresolved, but whatever the decision, the *silent fallback* case is the one that hurts. Scenario: operator creates a run referencing a v1-imported panel (master_panel_id = NULL on the `panels` row). Calculator hits path 3 (platform default) and computes reagent volume. Operator does not notice — the volume looks plausible. Later, the vendor's actual reagent volume for that panel is 50 µL but the platform default is 25 µL, and the run is preplanned with half the reagent needed. The error surfaces at the bench, not in the app.

The v1 archive's "recipe ambiguity" pitfall covers a different shape of this (step-level ambiguity). This one is about *data provenance* — the calculator reads from a source the operator doesn't know exists, and there's no UI indication of which source was used.

**Why it happens:**
The calculator was written (v1) assuming one source of truth (platform config). v2 introduces a second source (master panel) with a fallback. "Fallback" is convenient but dangerous when the fallback value is wrong for the current selection. The v2 spec acknowledges this as "a behavior change worth flagging but low-risk" — the framing undersells it.

**How to avoid:**
- UI surfaces provenance: next to the computed reagent volume, show "Source: Cytokines master panel (50 µL)" or "Source: Milliplex platform default (25 µL) — no master panel available for this selection."
- Treat the "platform default used because master panel missing" case as a *warning banner* on the run setup page, not a silent fallback. The operator should have to see it to proceed.
- If open decision 2 resolves to strict: calculator throws a visible error when no master panel exists for the selected `(platform, species)`. Force the operator to re-import under v2 before the run can be saved.
- Regardless of strictness: write one test per path (master present / custom / v1 fallback) and assert the exact volume used.

**Warning signs:**
- Operators running a panel at the wrong reagent volume and discovering it at the bench.
- Support requests: "the calculator showed 25 but the kit insert says 50 — why?"
- Historical runs' `volume_per_well` stored value drifts from the master panel's current `reagent_volume_per_well` (because the run was saved under platform default but the master was imported later).

**Phase ownership:** calculator + ui.

---

### Pitfall 5: Run records lose reagent-volume history when master panel is updated

**What goes wrong:**
A run is saved on 2026-05-01 with `volume_per_well = 50` (from the master panel of the day). On 2026-06-15, the vendor ships a revised file with `reagent_volume_per_well = 55`. Operator re-imports; master is upserted; the old run is reloaded — what does it show?

The run table already has `volumePerWell REAL NOT NULL` (see `schema.ts:99`) — good, the value *was* captured at save time. But if the calculator re-derives volume from the master panel on reload (instead of reading the frozen `runs.volume_per_well`), the displayed value silently changes. Audit trail broken.

**Why it happens:**
Developers refactor the calculator to be a single function that takes `(platform, species, panel)` and returns volume. Clean code. But when that function is used both at save time (to compute) and at load time (to display), the load path now returns the *current* master value, not the historical one.

**How to avoid:**
- Load path: read `runs.volume_per_well` directly. Do not re-derive.
- Calculator function is only invoked during run setup / prior to save. Post-save, the value is frozen.
- Explicit test: save run with master v1 (50 µL), update master to v2 (55 µL), reload run, assert displayed volume is 50.
- Same rule applies to bead region and concentration for historical run's analyte list — though in this project's current schema they're not snapshotted on the run record, so this is a *separate* decision to surface. (Not in v2 scope per spec, but flag it.)

**Warning signs:**
- A run's displayed reagent volume changes after a panel re-import.
- Troubleshooting a failed run, the operator sees volume X in the UI but the prep sheet (printed at run time) shows volume Y.
- Compliance audit: "explain why this run record changed between audit 1 and audit 2."

**Phase ownership:** calculator + verification.

---

## XLSX Parsing Pitfalls

### Pitfall 6: SheetJS cell-address off-by-one between "A6" and `{r:5, c:0}`

**What goes wrong:**
SheetJS supports two addressing modes: A1 strings (`ws['A6']`) and `{r, c}` objects (`ws[XLSX.utils.encode_cell({r: 5, c: 0})]`). The A1 form is 1-indexed; the `{r, c}` form is 0-indexed. Developers mix them freely and get off-by-one bugs. The spec says metadata is in B1-B4, A6, Row 6, Row 7, Row 8+ — those are A1 references. In code, Row 8 (A1) is `r: 7` (zero-indexed), and Column E (A1) is `c: 4`.

Subtler: `sheet_to_json` with `header: 1` returns an array of arrays *starting at the first non-empty row by default*, which shifts row indexes in ways that depend on whether Row 5 is truly empty. Using `range: 'A1:Z100'` forces the full range but requires you to know the end — which you don't, until you parse.

**Why it happens:**
Documentation fragments across sources, v1 importer only used `sheet_to_json` with header-row mode (see `parser.ts:16`) which auto-handles this. v2 has to read specific cells, so it must use a different API. The patterns don't transfer.

**How to avoid:**
- Pick one addressing mode for v2 and stick to it. Recommended: A1 strings (`ws['B1']`, `ws['A6']`) for metadata — direct, matches the spec — and `XLSX.utils.sheet_to_json(ws, { header: 1, range: 'A8:Z500', defval: null, blankrows: false })` for the master/premix table body.
- Unit-test each address extraction: assert `ws['B1'].v === 'Cytokines'` for the fixture, etc.
- Never do arithmetic on A1 strings in code. If you need to address column F relative to column E, use `XLSX.utils.encode_col(n)` / `decode_col()`.
- Document the addressing convention in the parser file header comment.

**Warning signs:**
- Error messages refer to "Row 9" but the actual problem is on Row 8 (or vice versa).
- Parser works on manually-created fixture but fails on real vendor file because the vendor left Row 1 empty as a title spacer.
- Bead regions parsed into the wrong analyte because columns and rows are transposed in the access code.

**Phase ownership:** parser + verification (programmatic fixture generation guards this).

---

### Pitfall 7: Numeric cells arriving as strings ("50" vs 50)

**What goes wrong:**
The Reagent Volume (B4), BeadRegion (col B), and Concentration (col C) are numeric by spec. But when a vendor authors a file, they can (and do) format the cell as "Text" in Excel, paste from a web page that introduces a leading apostrophe, or include a trailing space. `ws['B4'].v` returns the string "50" instead of the number 50. Zod's `z.number()` rejects strings — so the importer rejects a file the operator thinks is valid.

Conversely: `ws['B4'].v` can return the number 50 but `ws['B4'].t === 's'` (type string) because the cell was formatted as text and SheetJS preserves that. Relying on `.t` is not reliable either.

**Why it happens:**
Excel's cell-type promotion is lossy. SheetJS exposes both the raw value (`.v`) and type (`.t`) but developers rarely check both. Vendors don't QC their spreadsheets for type consistency.

**How to avoid:**
- Parser layer coerces explicitly before validation: `const num = typeof raw === 'number' ? raw : Number(String(raw).trim()); if (!Number.isFinite(num)) throw validation error`.
- Apply to B4 (reagent volume), col B (bead region — also must be integer: `Number.isInteger(num)`), col C (concentration).
- Wrap in a small helper `coerceNumber(raw, cellLabel)` and use it everywhere, so error messages consistently point at the offending cell.
- Verify with a fixture containing mixed types: B4 as text "50", B4 as number 50, B4 as formula `=25*2`, B4 with trailing space.
- Do not rely on Zod to coerce — Zod's `z.coerce.number()` is too permissive (it accepts empty string as 0). Do explicit coercion first, then pass numbers into Zod.

**Warning signs:**
- "Reagent volume must be a positive number, got [object Object]" in the error banner.
- File opens in Excel and looks fine, but the importer rejects B4.
- Bead region validation rejects "12" (string) but accepts 12 (number) from the same file position on different runs.

**Phase ownership:** parser.

---

### Pitfall 8: Blank-stop rules false-trigger on mid-list empty rows

**What goes wrong:**
Spec: "read rows 8 downward until column A is blank, then stop." Vendor files in the wild have:
- A genuinely empty row in the middle of the list as a visual separator (e.g., separating cytokines from chemokines).
- A row where column A is empty but B/C are filled (formatting mistake in the source file).
- A row where A looks empty but contains a zero-width space or a cell-formula returning `""`.

If the parser stops at the first "blank" row, it silently truncates the master analyte list. The file imports "successfully" with 8 analytes when it should have 15. Operator doesn't notice until they go to select an analyte and it's missing.

**Why it happens:**
"Blank" is ambiguous. SheetJS's `sheet_to_json` with default options treats `""`, `null`, and `undefined` as blank, but treats `0` as a value and treats `" "` (space) as a value. Formula cells evaluating to `""` may appear as `""` or as `{ t: 's', v: '' }` depending on the file's calc chain.

**How to avoid:**
- Define "blank" precisely in the parser: `trim() === "" || raw === null || raw === undefined`.
- Apply only to column A for the master stop rule. A row where A is blank but B or C have values → collect as an error ("Row N has missing target name but bead region/concentration are filled"), not a silent stop.
- Same rule for premix columns: stop when *that column's cell* is blank; a blank D-column separator between master and premix is handled by the "scan Row 6 starting at column E" premix-discovery rule (spec §Blank-stop rules).
- Warn (not error) if the parsed master list is suspiciously short (< 3 analytes). Vendor panels are typically 10-40 analytes.
- Regression test with a fixture: master list with a genuinely empty row at row 12 → assert parse either (a) correctly stops at row 11 *or* (b) reports an error depending on what you decide. Either is defensible; document the choice.

**Warning signs:**
- Imported analyte count lower than the vendor's product sheet.
- Operator reports an analyte missing from the picker that was supposedly in the file.
- Result banner says "Imported 8 analytes" for a file the vendor markets as a 15-plex.

**Phase ownership:** parser + validator.

---

### Pitfall 9: Case-insensitive lookups inconsistently applied

**What goes wrong:**
Spec §Metadata says platform/species lookup is case-insensitive; §Analyte list semantics says premix-column analyte names must match master "case-insensitively"; §Idempotency says master panels match by `(platform_id, species_id)` and analytes by `(name, platform_id, species_id)` case-insensitive. That is four places where case-insensitivity must be applied. If any one of them reverts to exact match, the same file imports differently depending on whitespace / capitalization.

The v1 validator does case-insensitive platform/species lookup (see `validator.ts:64`, `validator.ts:77`). The v1 analyte repository does case-insensitive find (see `analyte.ts:67`). So the pattern *exists* — but v2 adds premix-column analyte matching (new code) and master-panel match by `(platform_id, species_id)` which doesn't involve name at all. Consistency requires auditing every new lookup.

**Why it happens:**
Developer adds new lookup, forgets the case-insensitive rule, tests with lowercase data, ships.

**How to avoid:**
- Single helper function `eqCI(a: string, b: string): boolean` used at every string comparison site. Grep for `=== ` on string fields during PR review.
- SQL side: use `sql\`lower(${column}) = lower(${value})\`` (already the pattern in v1 repositories — preserve it).
- Trim before comparing: `a.trim().toLowerCase() === b.trim().toLowerCase()`. Vendor files often have trailing spaces.
- Fixture with mixed-case data: "IL-6" in master, "il-6" in premix column → assert match. "Milliplex" in file metadata, "milliplex" in DB → assert match. "IL-6 " (trailing space) vs "IL-6" → assert match (or explicit error, but be consistent).

**Warning signs:**
- "Premix column F row 9: analyte 'IL-6' not found in master list" — but IL-6 *is* in the master list, just with different capitalization or a trailing space.
- Platform "MilliPlex" rejected when "Milliplex" is in the DB.
- Re-import of the same file with minor casing tweaks creates duplicate analytes instead of upserting.

**Phase ownership:** parser + validator.

---

### Pitfall 10: Merged cells, hidden rows, and formula cells silently mislead the parser

**What goes wrong:**
Real vendor files contain:
- **Merged cells**: B1:C1 merged to span "Panel Name: Cytokines" visually. SheetJS reports the value only in the top-left cell (B1); C1 reads as `undefined`. If parser accesses only B1, fine. If it assumes "Panel Name:" label in A1 and value in B1, a merge across A1:B1 puts the label in A1 and B1 is empty.
- **Hidden rows/columns**: vendor hid Row 7 (the header row) because they moved the labels to Row 5 and forgot to delete Row 7. `sheet_to_json` reads hidden rows by default — which in this case is correct for our spec but surprising.
- **Formula cells**: `=VLOOKUP(...)` returning the analyte name. SheetJS evaluates formulas at read time *if* `readFile` is called with `cellFormula: false` (default is true in some versions). Formula values can be stale if the file was last saved without recalc.
- **Frozen panes and autofilter**: irrelevant to parsing but sometimes confuse visual debugging ("the file looks different in LibreOffice").

**Why it happens:**
Vendor spreadsheets are authored by marketing / product managers, not validated against a schema. QC is visual.

**How to avoid:**
- Read with explicit options: `XLSX.readFile(path, { cellDates: false, cellText: false, cellFormula: false })`. This returns evaluated values, not formulas, and avoids date-auto-parsing surprises.
- Do not attempt to handle merged cells specially. Document the assumption: "Metadata cells must be authored as individual cells, not merged ranges." Provide a template file for vendors to avoid.
- Hidden rows: ignore the hidden attribute. Parse by content.
- Add a "smoke check" on parse: if B1-B4 are all empty but A1-A4 have label-like strings, emit a hint error: "This file may have merged cells or unexpected layout. Did you author it using the provided template?"
- Include a vendor-file fixture (real or representative) in the test suite, not just programmatic fixtures.

**Warning signs:**
- Parse rejects a file with "Panel Name is required" but the file clearly has a panel name visible.
- Analyte list has names like "VLOOKUP" because a formula wasn't evaluated.
- Vendor support requests: "I sent you our standard file, why doesn't it work?"

**Phase ownership:** parser + verification.

---

### Pitfall 11: Large xlsx files block the main process during parse

**What goes wrong:**
`XLSX.readFile` is synchronous and CPU-bound. A 10-tab file with 50 analytes per tab is small (< 1 MB) — parse is fast. A 30-tab file with formulas, embedded images (vendor branding), and frozen metadata tabs is 10+ MB and takes multiple seconds. The Electron main process blocks; the renderer UI freezes (no progress spinner, no way to cancel).

Note: the v1 importer has the same issue, but v1 files are CSV and small. v2 files are larger.

**Why it happens:**
SheetJS is single-threaded and synchronous by design. The v1 IPC handler (`ipc/import.ts:28`) calls `importPanelData` synchronously inside the `ipcMain.handle` async function — the `async` wrapper doesn't make the underlying parse async.

**How to avoid:**
- Measure first: add timing around `XLSX.readFile` and log parse duration. If < 500 ms for typical files, stop here — a spinner is enough.
- If parse duration is user-noticeable: run the parser in a Node `worker_threads` Worker. Pass file path in; pass parse result out. Main process stays responsive.
- In the UI, show a non-cancelable spinner with "Parsing file..." during the IPC call. Transition to "Validating..." after parse completes. Transition to "Saving..." during DB writes.
- Do *not* stream-parse. SheetJS doesn't expose a streaming API; implementing one is out of scope.
- Cap file size: reject files > 50 MB with "File too large — please split into multiple files." Avoids pathological cases without prematurely optimizing.

**Warning signs:**
- User reports the app "freezes" for 3-5 seconds after selecting a file.
- Click-to-import latency makes operators click twice, triggering a double-import (if not guarded).
- Electron's unresponsive-window detection fires.

**Phase ownership:** ipc + ui (measure first before committing to worker-thread complexity).

---

## Data-Model Pitfalls

### Pitfall 12: Drizzle migration ordering — schema → backfill → constraint tightening

**What goes wrong:**
Correct order for evolving a live schema with data:
1. Add new nullable columns and tables.
2. Deploy + let existing data live with NULLs.
3. (If needed) data-migration script to backfill.
4. (If needed) tighten constraints (e.g., NOT NULL, unique).

Wrong order: add a NOT NULL column with a default, then try to populate meaningfully later — you've already filled every row with the default, and can't tell which rows were "real" vs defaulted.

For v2 specifically: `panels.master_panel_id` and `analytes.master_panel_id` are nullable (correct per spec). This is step 1-2. There is no current plan to tighten to NOT NULL (step 4) — if that plan ever materializes, it's a separate migration that must first check for NULLs and either backfill or reject.

**Why it happens:**
Developers conflate "the final schema should look like X" with "the migration to get there is one step." In an app with live data, each constraint tightening is its own step.

**How to avoid:**
- Keep `master_panel_id` nullable forever, or at minimum until all v1-imported data is re-imported through v2.
- Document this explicitly in the schema file as a comment: `// nullable — v1-imported rows have NULL; may tighten in a future milestone`.
- If a future milestone wants to require master_panel_id, add a preflight check: `SELECT COUNT(*) FROM analytes WHERE master_panel_id IS NULL` — if > 0, block the migration and tell the operator to re-import.
- No single migration file should both add a column and tighten a constraint that depends on data. Split into separate files.

**Warning signs:**
- Migration fails on a production DB because a NOT NULL constraint can't be added to a column that has NULLs.
- An "emergency" data-fix script is needed mid-deploy.
- Foreign key constraint fires on rows that were imported before the constraint was added.

**Phase ownership:** schema.

---

### Pitfall 13: Cascade-delete rules unstated → orphan records on master panel deletion

**What goes wrong:**
Spec says master-panel deletion is not in v2 scope. Agreed. But the FK definitions still need cascade rules explicitly stated *now*, because otherwise Drizzle/SQLite defaults apply. Default behavior in SQLite is `ON DELETE NO ACTION` (which is equivalent to RESTRICT in most cases), meaning a future admin-level delete would fail unless all referencing rows are deleted first. If someone later adds a master-panel delete UI without thinking about cascades, the delete fails or (worse) gets wrapped in a script that deletes referencing rows ad-hoc.

Related: `panels.master_panel_id` FK pointing at master_panels — if a master panel is ever deleted, what happens to premix panels that referenced it? Leave them orphaned (FK goes to a non-existent row)? Set FK to NULL? Cascade-delete the premix?

**Why it happens:**
FK cascade is an easy thing to forget in Drizzle schema files because the syntax is verbose. Default is "no action" — which is a conservative choice but surfaces late.

**How to avoid:**
- Every FK in `schema.ts` declares its cascade rule explicitly, even if it's the default. For `master_panel_id` on `panels` and `analytes`, the right default is `ON DELETE SET NULL` — a master-panel delete sets the FK to NULL on linked rows, preserving historical panels/analytes. Matches the spec's "leave orphaned" philosophy.
- Drizzle syntax: `.references(() => masterPanels.id, { onDelete: 'set null' })`.
- Document in the schema file: "Master panel deletion sets master_panel_id to NULL on linked panels/analytes — historical data preserved, falls back to v1 behavior."
- Even though v2 doesn't expose master-panel delete in the UI, the cascade rule should be in place so a future milestone can add the delete safely.

**Warning signs:**
- A hypothetical "delete master panel" operation throws a FK constraint error.
- Historical runs break when a master panel is deleted.
- Inconsistent state: some analytes have master_panel_id pointing at a non-existent master_panels row.

**Phase ownership:** schema.

---

### Pitfall 14: Composite unique index quirks in SQLite / Drizzle

**What goes wrong:**
`UNIQUE(platform_id, species_id)` on `master_panels` — this is what the spec wants. In SQLite, NULL is not equal to NULL for uniqueness purposes: you can have multiple rows with `(NULL, NULL)` or `(NULL, some_species_id)`. For `master_panels`, both FKs are NOT NULL, so this doesn't bite. But if someone ever makes `platform_id` nullable in a future change, the unique constraint silently allows duplicates.

Drizzle-kit generator for composite unique: use `uniqueIndex('master_panels_platform_species_uniq').on(t.platformId, t.speciesId)` in the schema definition. Do not rely on column-level `.unique()` — that generates single-column indexes.

**Why it happens:**
SQLite's NULL handling in UNIQUE is non-obvious; Drizzle syntax has multiple ways to express composite constraints, not all of which generate the expected SQL.

**How to avoid:**
- Use `uniqueIndex(...).on(platformId, speciesId)` in Drizzle, not column-level `.unique()`.
- After running `drizzle-kit generate`, inspect the generated SQL to confirm: `CREATE UNIQUE INDEX 'master_panels_platform_species_uniq' ON 'master_panels' ('platform_id', 'species_id');`.
- Because both FKs are NOT NULL (spec requires both platform_id and species_id), SQLite's NULL-dedup behavior is not a risk for v2 — document this in a schema comment so future changes don't accidentally introduce nullability.
- Test: attempt to insert two master_panels rows with the same (platform_id, species_id). Expect UNIQUE constraint violation. Assert upsert semantics in importer swallow this and turn it into an UPDATE.

**Warning signs:**
- Two master panels for Milliplex/Human after a re-import.
- `UNIQUE constraint failed` error surfacing in the UI instead of being handled as upsert.

**Phase ownership:** schema + parser.

---

### Pitfall 15: `panels` table rename confusion ("premix_panels" vs spec's "panels")

**What goes wrong:**
The current schema uses `premixPanels` as the table name (see `schema.ts:22`). The v2 spec refers to this table variously as "panels" and "premix panels" and suggests "keep table name for compat." If the spec is read literally, a developer may rename the table — breaking v1 data. Or they may leave it alone and introduce a new mental model where "master panel" and "premix panel" are distinct concepts with similar names, confusing future readers.

**Why it happens:**
Naming drift between the original flat-panel model (v1) and the master/premix distinction (v2). The table name `premix_panels` is ambiguous in v1 because there were no "master panels" to distinguish from. Now there are.

**How to avoid:**
- Keep the table name `premix_panels` as-is. Do not rename.
- Document in `schema.ts` with a block comment: "`premix_panels` stores both premix subsets (v2) and legacy panels (v1-imported, master_panel_id = NULL). Table name preserved for migration compatibility."
- Shared types: consider renaming `PremixPanel` TS type to something clearer, or add a discriminated union `type Panel = { kind: 'premix'; masterPanelId: string } | { kind: 'legacy'; masterPanelId: null }`. This is a refactor, not a requirement — but worth flagging for a later cleanup phase.
- Never introduce a new table called `panels`. Drizzle will not warn you that `premix_panels` and `panels` are conceptually the same.

**Warning signs:**
- Two tables appearing in future schemas: `premix_panels` and `panels`.
- Confusion in review: "which table is the one the spec calls 'panels'?"
- Migration script attempting `ALTER TABLE premix_panels RENAME TO panels`.

**Phase ownership:** schema + verification (code review checks table names).

---

## Calculator-Wiring Pitfalls

### Pitfall 16: Two sources of truth for reagent volume drift over time

**What goes wrong:**
Post-v2, `reagent_volume_per_well` lives on `master_panels`. Platform default lives on `platforms.stockConcentration`-adjacent config (currently the `volumePerWell` on runs is derived from platform — see `schema.ts:99`). That's two places. They will drift: vendor ships a kit with different reagent volume, operator re-imports, master gets updated — but the platform default stays unchanged. This is *fine* when the master panel is the source of truth, *but* only when the calculator consistently reads from master first. Any code path that reads platform default directly (other than the documented fallback) is a bug.

**Why it happens:**
Calculator refactors happen in multiple places (run setup, prep recipe generation, reload/display). If each path is updated independently, one gets missed.

**How to avoid:**
- Single function `resolveReagentVolume(run: RunContext): { volume: number, source: 'master_panel' | 'platform_default' | 'run_record' }`. Every call site uses this function. Ban direct access to `platforms.volumePerWell` (if that column exists) or to master_panel fields outside this function.
- Returns the source along with the value so UI can display provenance (see Pitfall 4).
- Audit existing calculator code (Phase 2 deliverables) for direct platform-default reads. Replace with calls to the new resolver.
- Snapshot test: for each of the three sources (master / platform / frozen run), assert resolver returns the expected volume and source.

**Warning signs:**
- Prep recipe shows one volume; run-summary screen shows a different volume for the same run.
- After a master re-import, historical runs' volumes change on display (see Pitfall 5).
- Grep reveals `platforms.volumePerWell` or `master_panel.reagent_volume_per_well` accessed outside the resolver.

**Phase ownership:** calculator.

---

### Pitfall 17: Full-custom runs (no panel) skip master-panel lookup — correct, but tested?

**What goes wrong:**
Spec path 2: "if the run is a `full custom` (no panel) → use platform default." This is correct for full-custom because there's no panel selected, so there's no master to read from. But a subtle case: a full-custom run *does* have a `(platform, species)` selection, and a master panel *does* exist for that pair. Should it use the master's reagent volume or the platform default?

The spec says platform default. That's a defensible choice (full-custom is by definition outside the vendor's panel). But the rule must be explicit because a naive implementation might say "look up master by (platform, species); if found, use it" — which would pull the master volume for full-custom runs too.

**Why it happens:**
The resolver function's interface doesn't distinguish "no panel selected" from "panel selected but not found." Both produce master_panel_id = null on the run record. Calculator code treats them the same, which is usually right but may not be.

**How to avoid:**
- Resolver takes `run.requestType` as an input. If `requestType === 'custom'`, skip master lookup entirely and return platform default with `source: 'platform_default'`. If `requestType` is premix or premix+singles, look up master, fall back to platform default.
- Test matrix:
  - premix + master exists → master volume
  - premix + master missing (v1 panel) → platform default
  - premix+singles + master exists → master volume
  - custom + no master exists → platform default
  - custom + master exists for (platform, species) → platform default (explicit: we ignore master for custom)
- Document the rationale in the resolver's JSDoc: "Full-custom runs use platform default even when a master panel exists, because full-custom is by definition outside the vendor-defined panel scope."

**Warning signs:**
- Full-custom run volume doesn't match platform default.
- Two full-custom runs on the same platform/species have different volumes because one was created before a master panel was imported and one after.

**Phase ownership:** calculator + verification.

---

## UI Pitfalls (Vendor Singles Term Rollout)

### Pitfall 18: "Singleplex"/"Simplex" label only renders when master panel exists

**What goes wrong:**
D-4.1-05 resolves to render `vendor_singles_term` in the AnalyteGrid. Implementation: "if master.vendor_singles_term is set, show it; else show 'Analytes'." What's missing: the case where a v1-imported run has no master panel at all. In that case, master is NULL, vendor_singles_term is inaccessible, and the UI must fall back to something — "Analytes," "Singles," "Single," whatever. But the fallback must be deliberate, not an accidental empty string.

**Why it happens:**
`master_panel` joins yield null in some run-display paths. UI code assumes the string is non-empty. Empty label renders as blank space in the UI or (worse) as "undefined" if the template string isn't guarded.

**How to avoid:**
- UI layer: single utility function `resolveVendorSinglesLabel(masterPanel: MasterPanel | null): string`. Returns: `masterPanel?.vendorSinglesTerm?.trim() || 'Single'` (or whatever the team picks). Never returns empty string.
- Tests: null master → 'Single'. Master with empty/whitespace vendor_singles_term → 'Single'. Master with "Simplex" → 'Simplex'. Master with "Singleplex" → 'Singleplex'.
- Grep for any JSX that references `masterPanel.vendorSinglesTerm` directly. Replace with the resolver.

**Warning signs:**
- Empty column header or button label in the analyte grid for v1-imported panels.
- "undefined" rendered as a label string.
- Different operators see different labels in the same view because their local DB state differs.

**Phase ownership:** ui.

---

### Pitfall 19: Mixed-vendor term display in cross-panel views

**What goes wrong:**
Some views (e.g., the analyte picker for a "premix + singles" run) may display analytes drawn from two different master panels — Milliplex panel uses "Singleplex," Thermo panel uses "Simplex." UI must pick one label, or render per-analyte labels, or render a generic "Singles" — each choice has pros and cons.

Also: in the run-setup view, the operator picks a premix panel, and that panel has an associated master whose vendor_singles_term applies. Clear. But in the Manage view, listing all analytes across platforms, the term varies — do we suppress the vendor-term column? Use platform-scoped grouping?

**Why it happens:**
Spec §Vendor singles term UI is explicitly an "open decision." Until locked, different developers make different assumptions.

**How to avoid:**
- Lock open decision 3 (vendor-term UI placement) before starting UI implementation. Document the decision in the phase plan.
- Default recommendation: vendor term only renders in views *scoped to a single master panel* (e.g., a single run's analyte picker where the panel is already selected). Cross-panel views use generic "Singles" or "Analytes."
- If mixed display is required, display as `"Singleplex / Simplex"` or group analytes by panel with per-group headers.
- Verification: walk through every view in the app that displays analyte lists. Decide per view: master-scoped or cross-panel. Document.

**Warning signs:**
- Operator confusion: "the button said 'Simplex' on one screen and 'Singleplex' on another — are those the same thing?"
- UI code has ad-hoc fallback logic in multiple components, inconsistent.

**Phase ownership:** ui.

---

### Pitfall 20: Label length variation breaks layout

**What goes wrong:**
"Singleplex" = 10 chars, "Simplex" = 7 chars, "Single" (fallback) = 6 chars. Other vendors may use longer labels ("Single Analyte", 14 chars). If the UI allocates a fixed-width column or button for the label, longer vendor terms wrap or truncate. This is a minor issue but worth catching early.

**Why it happens:**
Developer tests with one vendor term and doesn't verify with longer strings. CSS `white-space: nowrap` on a label clips without warning.

**How to avoid:**
- CSS: allow labels to wrap or expand. Avoid fixed widths on any element that renders vendor_singles_term.
- Visual test with extreme fixture: vendor_singles_term = "Single Analyte Multiplex Panel" (absurdly long). Verify layout doesn't break.
- Optional: cap stored vendor_singles_term length (validator rejects > 30 chars) — forces operators to abbreviate if vendor uses something silly.

**Warning signs:**
- Label text truncated with ellipsis.
- Button height changes when label switches between short and long terms.
- Different columns misalign when some panels have long labels and others short.

**Phase ownership:** ui.

---

## Integration Pitfalls (v1 ↔ v2 Coexistence)

### Pitfall 21: v1 importer path left accessible, operators use it by accident

**What goes wrong:**
Open decision 1 says: replace v1 or coexist. If "coexist," the UI exposes both paths. Operator clicks the wrong one, uploads a vendor xlsx file through the v1 CSV importer — parser fails obscurely ("Cannot read property 'platform' of undefined") because v1 expects headered rows and the vendor file has metadata in B1-B4. Or worse: v1 silently parses a file that happens to have the right column names in Row 7 and imports garbage data.

**Why it happens:**
Two paths for the same conceptual operation is always confusing. UI labels like "Import Panel Data" and "Import Master Panel File" are not clearly distinguishable.

**How to avoid:**
- Strong preference: resolve open decision 1 as "replace." Remove v1 UI trigger in the same phase that ships v2. Leave v1 IPC handler registered (so existing tests still work) but unreachable from the UI.
- If "coexist" is chosen: label v1 clearly as "Legacy CSV import (v1 format)" with a warning banner. Hide it behind a "Show advanced" disclosure. New "Import Panel File" button is the default.
- v1 importer rejects `.xlsx` files with multi-tab structure: detect in parser, bail with "This file looks like a v2 panel file — please use the new 'Import Panel File' button." Symmetric: v2 importer rejects `.csv` files with "CSV is not supported in v2 — please use the v2 xlsx format."
- File-extension filter in the file dialog (already correct for v1: csv/xlsx/xls; v2 should be xlsx only per spec).

**Warning signs:**
- Support ticket: "I imported the file but the analytes didn't show up" — turns out they used v1.
- Two different "successful import" banners appearing depending on which button was clicked.
- DB has half-v1-format, half-v2-format analytes with no way to tell apart.

**Phase ownership:** ipc + ui + verification.

---

### Pitfall 22: Re-import idempotency breaks when v1 and v2 interleave

**What goes wrong:**
Timeline:
1. Day 1: operator imports CSV via v1. Analytes created. `master_panel_id = NULL`.
2. Day 30: operator imports xlsx via v2. Spec says upsert by `(name, platform_id, species_id)`. Correct behavior: find existing v1 analytes, UPDATE their `master_panel_id` to the new master. Done.
3. Day 60: operator *re-imports* the same CSV through v1 again (for whatever reason — rollback, retry). v1's `find-or-create` pattern matches the existing analyte by `(name, platform_id, species_id)` — good, no duplicate. But v1 doesn't know about `master_panel_id` — it doesn't touch that column, so the FK from step 2 survives. Good.
4. Day 61: operator re-imports the v2 file. Upsert matches by `(name, platform_id, species_id)`, UPDATEs `master_panel_id` (no-op, already set), updates bead_region + concentration. Good.

Happy path works. But consider: in step 3, v1 *overwrites* bead_region with the CSV's value, which may differ from the xlsx's value. Now the analyte has FK to master (from step 2) but bead_region from CSV (step 3). Master panel and analyte are out of sync.

**Why it happens:**
v1 and v2 have overlapping writes to the same rows. Neither knows about the other's invariants.

**How to avoid:**
- Resolve open decision 1 as "replace" (see Pitfall 21). If v1 is unreachable, this scenario can't happen.
- If coexist: document that mixed v1/v2 import of the same platform/species is *unsupported* and may produce inconsistent bead_region/concentration. Add a warning banner when v1 import is used for a (platform, species) that has a master panel.
- Optional safeguard: v1 importer detects analytes with non-null `master_panel_id` and refuses to update them ("This analyte is managed by a v2 master panel — re-import via v2 to update"). This is implementable but may be more complexity than coexist is worth.

**Warning signs:**
- Bead region of an analyte silently changes after a v1 re-import.
- Concentration values mismatch between master panel's claimed spec and the analyte row's stored value.
- Analyte row's updated_at is newer than the master panel's updated_at despite the master being the source of truth.

**Phase ownership:** verification (this is a known-limitations-to-document pitfall, not a code change, unless coexist path gets safeguards).

---

### Pitfall 23: FK adoption silently orphans analytes on partial v2 upload

**What goes wrong:**
Scenario: operator has 20 v1-imported analytes for Milliplex/Human. Operator's first v2 file for Milliplex/Human contains only 15 of those 20 (vendor split the panel into two files). After v2 import, 15 analytes have `master_panel_id` set to the new master; 5 have `master_panel_id = NULL` still. Those 5 are orphaned — no master panel claims them, but they're still selectable in the analyte picker.

Spec §Idempotency says "Deletion of orphaned analytes or premixes is not automatic." Correct — we don't want to lose data. But *surfacing* the orphans in the UI is missing. Operator doesn't know to re-import the missing panels.

**Why it happens:**
The v2 importer only affects analytes *mentioned in the file*. Analytes in the DB that aren't in the file are untouched, by design. Design is correct; visibility is missing.

**How to avoid:**
- After v2 import, compute: `SELECT COUNT(*) FROM analytes WHERE platform_id = ? AND species_id = ? AND master_panel_id IS NULL`. If > 0, include in the result banner: "Note: 5 analytes for Milliplex/Human are not linked to a master panel. They may be from a different vendor file not yet imported."
- Manage UI: analyte list shows "Unmastered" badge for `master_panel_id IS NULL` rows, with a tooltip "This analyte was imported before the v2 format or is missing from the most recent v2 file. Re-import via v2 to link it."
- This is informational only — don't block runs, don't delete the rows.

**Warning signs:**
- Operator complaints: "I imported the new file but this analyte is still shown as 'legacy.'"
- Runs using orphaned analytes silently use platform-default reagent volume (see Pitfall 4) without indication.

**Phase ownership:** ui + verification.

---

## Testing / Verification Pitfalls

### Pitfall 24: Manual xlsx fixtures drift from the spec

**What goes wrong:**
Team creates a "reference" xlsx file by hand in Excel, commits to repo as test fixture. Spec evolves — B4 changes from "Reagent Volume" label to "Assay Volume (µL)" label, or A6 vendor-term cell is relocated. The fixture file is not updated because it's binary and nobody opens it. Tests pass on the stale fixture. Real vendor files fail.

Or: fixture is regenerated on macOS, uploaded, and Excel on Windows renders it differently because of font-metric differences (no functional impact but confusing during manual smoke test).

**Why it happens:**
Binary fixtures are opaque. Diff is useless. Review depends on whoever authored the file opening it again.

**How to avoid:**
- Generate fixtures programmatically in test setup: `XLSX.utils.book_new()` + `XLSX.utils.aoa_to_sheet(arrayOfArrays)`. Commit the *generator script*, not the xlsx file.
- If a binary fixture is truly needed (e.g., to test a real vendor file's quirks), commit it with a README documenting what it contains and why it can't be generated programmatically.
- Every test that parses a fixture also documents the fixture's structure in a comment at the top of the test.
- Include one "adversarial" fixture per class of pitfall: merged cells, numeric-as-text, blank separator rows, mixed-case lookups. Each generator is a one-liner.

**Warning signs:**
- Test fixture hasn't been updated in 6 months but the spec has.
- Review comment: "I can't tell what this fixture contains, please document."
- Tests pass in CI but importer fails on real vendor file.

**Phase ownership:** verification.

---

### Pitfall 25: Can't test file-dialog interaction on macOS dev machine

**What goes wrong:**
Project is Windows-only for deployment. Dev on macOS. File-dialog interaction (`dialog.showOpenDialog`) is platform-specific — dialog chrome differs, file-path normalization differs (backslash vs forward slash), drag-drop behavior differs. A bug in the dialog layer won't surface during macOS dev.

Additionally: the Claude Code SDK has an ELECTRON_RUN_AS_NODE issue that makes in-terminal Electron dev unreliable (see MEMORY.md `electron_sdk_gotcha.md`). So even the macOS dev path for running Electron interactively is flaky.

**Why it happens:**
Platform assumptions baked into IPC layer. Dev never exercises the real code path.

**How to avoid:**
- Decouple file-dialog from parser. IPC handler's job is to get a file path — parser/validator/importer take a file path as input and do not touch Electron APIs.
- Unit tests call the parser/validator/importer directly with fixture file paths. No IPC, no dialog. Works on macOS, works on Windows, works in CI.
- Manual smoke test on Windows (the existing HUMAN-UAT pattern) covers the dialog leg. Document the smoke test as explicit verification of dialog interaction, not just "the thing works end-to-end."
- IPC handler unit test: mock `dialog.showOpenDialog` to return a known path, assert the handler calls the importer with that path. This catches IPC-layer regressions without needing a real dialog.

**Warning signs:**
- A bug in file-path handling surfaces during Windows UAT and wasn't caught by any automated test.
- macOS dev path appears to work, but something subtly different about Windows paths breaks on deployment.

**Phase ownership:** ipc + verification.

---

### Pitfall 26: Electron main-process errors silently crash IPC response

**What goes wrong:**
Inside the IPC handler (`ipc/import.ts:28` is the v1 pattern), the handler has a `try/catch` that returns an error-shaped result. Good. But if the error occurs in a sync path *outside* the `try/catch` (e.g., in a Drizzle query during row 5 of a batch insert), or if a native module throws a non-Error (e.g., `throw 'some string'`), the IPC response can hang or return `undefined` to the renderer. Renderer's `await ipcRenderer.invoke(...)` returns undefined, renderer code destructures `{success, errors}` on `undefined`, throws silently, no banner.

**Why it happens:**
Error-path testing is usually shallow. Happy-path tests don't exercise "what happens when better-sqlite3 throws mid-transaction."

**How to avoid:**
- IPC handler: wrap the *entire* handler body in try/catch, including the dialog interaction. Any throw returns `{success: false, errors: [{row: 0, issues: [String(err)]}]}`.
- Renderer-side: check `result?.success === true` before destructuring. If result is undefined or malformed, show a generic error banner: "Import failed. Check the console for details."
- Log all main-process errors via `console.error` with enough context (file path, phase of parse) so the console log is useful when operator reports a failure.
- Test: deliberately corrupt a DB write (e.g., disconnect the DB file mid-transaction) and assert the renderer receives a structured error, not undefined.

**Warning signs:**
- "Import button doesn't do anything" reports.
- Renderer console shows `TypeError: Cannot destructure property 'success' of 'undefined'`.
- No banner appears on import failure — user thinks the import succeeded.

**Phase ownership:** ipc + ui.

---

### Pitfall 27: Per-tab vs whole-file transaction boundary unstated

**What goes wrong:**
Open decision 5: strict-vs-partial. Suggested default is strict. But implementation-wise, "strict" could mean:
- **(a)** One transaction wrapping all tabs. First tab's error rolls back everything.
- **(b)** One transaction per tab. First tab commits even if second tab fails.
- **(c)** Validation-first across all tabs (collecting errors), then one transaction for all tabs if no errors (the v1 pattern).

Option (c) matches the v1 importer pattern (see `importer.ts:23` — validation errors bail before any DB write) and the spec §Per-tab parse pipeline step 7 ("Collect all validation errors across all tabs before any DB writes"). That's the right choice. But if someone implements (a) or (b) without reading the spec carefully, the behavior diverges.

**Why it happens:**
"Strict" is a word, not an implementation. The validation-then-commit pattern is not universal — lots of importers do per-item commits.

**How to avoid:**
- Implementation follows the v1 pattern exactly: validate everything first (parser + validator), collect all errors, if any errors → return structured error result, no DB mutation. If clean → single transaction wrapping all tab writes.
- Test: file with 3 tabs, tab 2 has a validation error. Assert: no rows inserted, error banner lists tab-2's issue. No partial import.
- Test: file with 3 tabs, all valid. Assert: 3 master panels created, analytes created, links created. Single transaction.
- Test: DB-level error in tab 3's write (simulate). Assert: transaction rolls back entirely — no tabs 1 or 2 leave residue.

**Warning signs:**
- Partial state after a failed import: some tabs imported, others didn't.
- Operator reports "I got an error but some of the panels showed up" — indicates (a) or (b) was implemented.

**Phase ownership:** parser + ipc.

---

## Technical Debt Patterns

Shortcuts that seem reasonable but create long-term problems — *specific to v2.0 scope*.

| Shortcut | Immediate Benefit | Long-term Cost | When Acceptable |
|----------|-------------------|----------------|-----------------|
| Keep v1 CSV importer alive "just in case" | No migration burden for operators | Two code paths to maintain, Pitfalls 21/22 bite | Only if stakeholders explicitly require legacy format support |
| Nullable `master_panel_id` with "we'll tighten later" promise | Easier v2 deploy | "Later" never comes; code assumes NOT NULL sporadically, NULL handling inconsistent | Acceptable as long as nullable-forever is documented, not "temporary" |
| Inline XLSX parsing in IPC handler | Fewer files | Cannot unit-test parser on macOS, Pitfall 25 | Never — parser must be decoupled from IPC |
| Store reagent_volume only on run record, not snapshot master_panel_id | Smaller schema | Cannot trace which master_panel version was in effect at save time | Acceptable for v2 (volume is the only user-visible value); reconsider if vendor_singles_term or bead_region history is ever needed |
| Silent platform-default fallback with no UI indicator | Simpler UX | Pitfall 4 — wrong volume used at bench, traced months later | Never — provenance must be visible |
| "Master panel name is authoritative on every import" | No need for operator-lock logic | Pitfall 3 — operator edits revert silently | Acceptable if documented in UI help text; preferable: add `name_locked` flag |
| Per-tab transaction (option (b)) instead of validation-first then whole-file transaction | Simpler error recovery | Partial imports leave DB in mixed state | Never for v2 — spec explicitly requires validate-first |
| Hand-authored xlsx test fixtures | Fast to create initially | Drift, opacity, Pitfall 24 | Only for "real vendor file" fixtures with documented provenance |

---

## Integration Gotchas

Common mistakes when connecting v2 to the existing Electron + Drizzle app — *specific to v2.0 scope*.

| Integration | Common Mistake | Correct Approach |
|-------------|----------------|------------------|
| SheetJS + Electron | Bundling SheetJS into renderer process (exposes to XSS if HTML imports are ever enabled) | SheetJS lives in main process only; renderer receives structured JSON over IPC |
| Drizzle migrations + packaged Electron | Migrations path assumed to be relative to `__dirname` works in dev but fails after packaging | Already handled in `migrate.ts:11-13` with `app.isPackaged` branch — preserve this pattern for any new migration-adjacent code |
| Drizzle schema changes + live data | Generate migration, apply to dev DB, forget prod has different existing data | Test migration against a *copy* of a real user's DB before release; backfill scripts run separately from DDL |
| `better-sqlite3` transactions + async | Wrap async code inside `sqlite.transaction(() => {...})` — better-sqlite3 is sync, `async` inside the transaction doesn't actually yield | Keep everything inside the transaction synchronous; async work happens before/after the transaction callback |
| IPC result shapes + TypeScript | Add a field to `ImportResult` but forget to update preload/renderer types | Share types in `shared/types/` and import from both sides; never duplicate interface definitions |
| Renderer state + DB changes post-import | After import, renderer's cached analyte/panel list is stale | Refetch analytes/panels after import-success banner; or broadcast an IPC event and have renderer subscribe |
| Case-insensitive lookups + SQLite COLLATE | Using `lower(col) = lower(?)` is correct but defeats indexes | For v2 scale (< 10k analytes) this is fine; if indexing becomes needed, add `COLLATE NOCASE` to the column definition |

---

## Performance Traps

Patterns specific to v2.0 — xlsx ingest + master-panel joins.

| Trap | Symptoms | Prevention | When It Breaks |
|------|----------|------------|----------------|
| Synchronous xlsx parse blocks main process | UI freeze during import | See Pitfall 11; worker thread if parse > 500ms | Files > ~5 MB or > 20 tabs |
| N+1 query pattern on panel → analyte fetch | Manage page slow to load panel details | Current repos use this pattern (`panel.ts:37-44`); replace with single JOIN query as panel counts grow | > 20 panels or > 500 analytes |
| Re-parsing the same file on retry | Redundant work on transient DB errors | Cache parsed result in-memory for the duration of the import; retry only the DB transaction, not parse | > 5 MB files with flaky DB writes (unlikely in practice) |
| Loading all master_panels on every calculator invocation | Slow run-setup UI | Calculator resolver takes `masterPanelId` and fetches one row, not all rows | > 50 master panels (unlikely in v2 scope) |
| Unique-index scan on upsert probe | Slow imports with many analytes | Indexed `(platform_id, species_id, lower(name))` — currently uses `lower()` in WHERE which doesn't use column indexes | > 1000 analytes per (platform, species) — unlikely, panels are typically < 50 |

---

## Security Mistakes

v2.0-specific security concerns beyond general Electron hardening.

| Mistake | Risk | Prevention |
|---------|------|------------|
| Accepting xlsx files from untrusted source | XLSX can contain macros (xlsm) or XXE in xlsx's internal XML | File-extension filter is `.xlsx` only, not `.xlsm`. SheetJS `readFile` does not execute macros — safe. Do not handle .xlsm |
| Exposing file-path strings in error messages | Local filesystem structure leaks in UI error banners | Error messages include file *name* only (basename), not full path |
| IPC handler trusting renderer-supplied path | Renderer could pass arbitrary path; main process reads file from disk | v1 pattern (file dialog in main process, path never round-trips to renderer) is correct — preserve for v2 |
| Logging full parsed content | PII-free in v2, but vendor panel data may be proprietary — log leakage to console goes into crash dumps | Log only parse summary (tab count, analyte count), not row-level data, at INFO level |
| Raw SQL interpolation during upsert | SQL injection via vendor-supplied analyte name | Drizzle parameterizes automatically — do not use string interpolation for upsert WHERE clauses |

---

## UX Pitfalls

v2.0-specific UX — import flow + vendor-term rollout.

| Pitfall | User Impact | Better Approach |
|---------|-------------|-----------------|
| Error message lists only the *first* error, not all errors | Operator fixes one issue, imports again, gets next error, repeats | Collect all validation errors across all tabs (matches spec §Error reporting); display as a scrollable list |
| Error location is "tab 2, row 9" but operator can't easily find that in Excel | Operator opens file, counts rows, gets wrong row because of header offset | Include the *literal cell address* (e.g., "F9") in addition to or instead of "row 9, column F" |
| "Import successful" banner with no per-tab breakdown | Operator doesn't know which panels got created | Spec §Result banner covers this — per-tab summary. Verify implementation matches |
| Silent re-upload of unchanged file | Operator unsure if their change took effect | Result banner distinguishes "3 master panels updated, 0 created" from "3 master panels created, 0 updated" |
| Unclear whether v1 or v2 importer is in use | Operator clicks wrong button, gets confusing errors | If coexist path is chosen, visually distinct buttons with different icons; if replace, remove v1 button entirely |
| Vendor term rendered inconsistently across screens | Cognitive load — "Simplex? Singleplex? Singles? Are these the same?" | Single resolver function (Pitfall 18), explicit per-view decision (Pitfall 19) |
| File dialog default directory doesn't remember last location | Operator navigates to vendor-files folder on every import | Electron `dialog.showOpenDialog` with `defaultPath` persisted in user settings |

---

## "Looks Done But Isn't" Checklist

Things that appear complete but are missing critical v2.0 pieces.

- [ ] **XLSX parser:** Often missing mixed-type coercion — verify Reagent Volume "50" (string) is coerced to 50 (number) before Zod validation (Pitfall 7)
- [ ] **XLSX parser:** Often missing case-insensitive match in *premix-to-master* name comparison — verify "il-6" in premix column F matches "IL-6" in master column A (Pitfall 9)
- [ ] **XLSX parser:** Often missing duplicate-tab-within-file detection — verify two tabs with the same (platform, species) produce a validation error (Pitfall 3)
- [ ] **Importer:** Often missing case-insensitive analyte upsert against v1-imported rows — verify second v2 import of same file produces zero new analyte rows (Pitfall 1)
- [ ] **Importer:** Often missing transactional rollback on partial failure — verify that a tab-3 DB error leaves tabs 1 and 2 unwritten (Pitfall 27)
- [ ] **Schema migration:** Often missing explicit FK cascade rule — verify master_panel_id FK declares `onDelete: 'set null'` (Pitfall 13)
- [ ] **Schema migration:** Often missing composite unique index — verify `uniqueIndex(...).on(platformId, speciesId)` appears in generated SQL (Pitfall 14)
- [ ] **Calculator:** Often missing provenance UI indicator — verify run-setup screen shows which source (master / platform default) supplied the reagent volume (Pitfall 4)
- [ ] **Calculator:** Often missing historical-preservation on reload — verify old run reloads with stored `volume_per_well`, not re-derived from current master (Pitfall 5)
- [ ] **Calculator:** Often missing full-custom branch test — verify full-custom runs use platform default even when a master panel exists for (platform, species) (Pitfall 17)
- [ ] **UI (vendor term):** Often missing fallback for null master — verify v1-imported panel renders "Single" (or chosen fallback) not empty string (Pitfall 18)
- [ ] **UI (vendor term):** Often missing long-label layout test — verify "Singleplex" doesn't break button alignment (Pitfall 20)
- [ ] **IPC:** Often missing structured error on uncaught throw — verify renderer receives `{success: false, errors: [...]}` when main process throws (Pitfall 26)
- [ ] **Fixtures:** Often missing programmatic generator — verify test fixtures are generated from code, not hand-authored xlsx files (Pitfall 24)
- [ ] **Fixtures:** Often missing adversarial cases — verify fixtures cover: merged cells, numeric-as-text, blank separator, mixed case, duplicate tabs (multiple pitfalls)
- [ ] **v1 coexistence:** Often missing "which importer was used" indicator — verify DB state allows distinguishing v1-imported analytes (master_panel_id IS NULL) from v2-imported (Pitfall 23)

---

## Recovery Strategies

When v2.0 pitfalls occur despite prevention.

| Pitfall | Recovery Cost | Recovery Steps |
|---------|---------------|----------------|
| Duplicate analytes after v2 re-import (Pitfall 1) | MEDIUM | Write SQL cleanup: `DELETE FROM analytes WHERE id IN (SELECT id FROM ... GROUP BY lower(name), platform_id, species_id HAVING COUNT(*) > 1)` keeping the row with non-null master_panel_id; reconcile panel_analytes links before deleting |
| Migration partial state (Pitfall 2) | HIGH if prod DB, LOW if dev | Dev: delete DB, re-seed. Prod: manual SQL repair based on which migration step failed; backup before any migration is mandatory |
| Operator name edits lost after re-import (Pitfall 3) | LOW | Add `name_locked` flag; existing users re-edit (one-time cost) |
| Silent platform-default use (Pitfall 4) | MEDIUM if runs already saved with wrong volume | Audit `runs.volume_per_well` against expected master-panel values; flag runs for operator review; cannot retroactively fix bench results |
| Run reload shows wrong historical volume (Pitfall 5) | LOW if caught early | Fix resolver to read from `runs.volume_per_well` directly; no data correction needed |
| Partial import leaves DB mixed (Pitfall 27) | MEDIUM | Manual DB inspection; delete the partially-inserted master panel row and re-import after fixing the offending tab |
| v1/v2 interleave drift (Pitfall 22) | MEDIUM | Re-import under v2, accept v2 values as authoritative; document the incident |
| Orphaned analytes after partial v2 import (Pitfall 23) | LOW | Re-import the missing file; or accept the orphans with a UI badge |
| Renderer received undefined from IPC (Pitfall 26) | LOW | Check main-process logs for uncaught error; fix handler try/catch |
| Fixtures drift from spec (Pitfall 24) | LOW | Replace hand-authored fixtures with programmatic generators in a dedicated refactor |

---

## Pitfall-to-Phase Mapping

How v2.0 roadmap phases should address these pitfalls. "Phase ownership" labels are suggestions — the roadmapper decides the actual phase structure.

| Pitfall | Suggested Phase Ownership | Verification |
|---------|--------------------------|--------------|
| 1. Nullable FK backfill corrupts v1 data | schema + parser | Fixture: seed v1 analyte, run v2 import, assert single row with FK set |
| 2. Migration ordering | schema | Inspect generated SQL; test sequential migration on dev DB with data |
| 3. Name overwrite on re-import | validator + ui | Test: edit name in UI, re-import, assert expected behavior (after decision locked) |
| 4. Silent calculator fallback | calculator + ui | Snapshot test: master missing → UI shows "platform default" provenance indicator |
| 5. Run records lose historical volume | calculator + verification | Test: save run, update master, reload run, assert original volume |
| 6. SheetJS addressing off-by-one | parser + verification | Unit test each cell access with programmatic fixture |
| 7. Numeric-as-text coercion | parser | Fixture with B4 as text "50"; assert successful parse |
| 8. Blank-stop rule false triggers | parser + validator | Fixture with mid-list empty row; assert expected behavior |
| 9. Case-insensitive lookup inconsistency | parser + validator | Fixture with mixed-case premix analyte name matching master |
| 10. Merged cells / formulas | parser + verification | Adversarial fixture with merged B1:C1; assert error or graceful handling |
| 11. Main process blocking on parse | ipc + ui | Measure parse time; if > 500ms, worker thread + spinner |
| 12. Drizzle migration ordering | schema | No combined schema + data changes in single migration file |
| 13. Cascade rule unstated | schema | FK declarations include explicit `onDelete` |
| 14. Composite unique index | schema + parser | Inspect generated SQL; test duplicate insert → upsert |
| 15. Table name confusion | schema + verification | Code review checks no `panels` table appears alongside `premix_panels` |
| 16. Two sources of truth drift | calculator | Single resolver function; grep bans direct master/platform access |
| 17. Full-custom run volume source | calculator + verification | Test matrix: 5 paths × expected volume |
| 18. Vendor term null fallback | ui | Test: null master → resolver returns fallback string |
| 19. Mixed-vendor term display | ui | Walkthrough of every analyte-list view with decision matrix |
| 20. Label length layout | ui | Visual test with absurdly long term |
| 21. v1 importer path accidental use | ipc + ui + verification | Depends on open decision 1 resolution |
| 22. v1/v2 interleave | verification | Document as known limitation; optional safeguard |
| 23. Orphan analytes after partial v2 | ui + verification | Post-import banner counts unmastered analytes |
| 24. Fixture drift | verification | Programmatic generator committed, not binary xlsx |
| 25. macOS dev can't test dialog | ipc + verification | Decouple parser from IPC; unit test parser on macOS; Windows UAT for dialog |
| 26. IPC silent failure | ipc + ui | Renderer defensive on undefined result; handler try/catch wraps everything |
| 27. Per-tab vs whole-file transaction | parser + ipc | Implementation matches v1 pattern (validate-all, then single transaction) |

---

## Open Decisions → Pitfall Exposure

Each unresolved open decision from spec §Open decisions correlates to one or more pitfalls above. The /gsd-discuss-phase step should close these before planning.

| Open decision | Exposure if left ambiguous |
|---------------|---------------------------|
| 1. Replace or coexist? | Pitfalls 21, 22 (v1 path usage, interleave drift) |
| 2. Calculator strictness | Pitfall 4 (silent fallback). Strict mode eliminates; permissive requires UI provenance |
| 3. Vendor singles term UI placement | Pitfalls 18, 19 (null fallback, mixed display) |
| 4. Premix drop semantics | Related to Pitfall 23 (orphans). Spec §Idempotency already suggests "leave orphaned" — confirm |
| 5. Validation strictness (strict vs partial) | Pitfall 27 (transaction boundary). Strict matches v1 pattern |
| 6. File-level schema versioning | Not a direct pitfall above, but adding a version cell in the tab layout would let future parsers detect format evolution without guessing |

---

## Sources

All findings drawn from:
- `.planning/PANEL-UPLOAD-V2-SPEC.md` (v2 spec, authoritative)
- `src/main/db/schema.ts` (current schema state, 4 migrations deep)
- `src/main/import/importer.ts`, `parser.ts`, `validator.ts` (v1 importer patterns to preserve)
- `src/main/db/repositories/analyte.ts`, `panel.ts` (existing case-insensitive lookup pattern)
- `src/main/ipc/import.ts` (v1 IPC error-handling pattern)
- `.planning/research/v1.0-archive/PITFALLS.md` (format consistency; v1 pitfalls not re-researched)
- Electron + SheetJS + Drizzle known behavior from prior phases (Phases 1-4.1)
- MEMORY notes: `electron_sdk_gotcha.md`, `deployment_windows.md`

No web search performed — all pitfalls are domain-derived from spec + existing code + prior milestone learnings.

---
*Pitfalls research for: Immunoplex Assay Calculator v2.0 — Panel XLSX Upload + Master-Panel Data Model*
*Researched: 2026-04-23*
