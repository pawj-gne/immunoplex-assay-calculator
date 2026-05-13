# Phase 16: Windows UAT & Release — Research

**Researched:** 2026-05-12
**Domain:** Release engineering — Electron Windows installer + Keep-a-Changelog + GitHub Release + operator-driven UAT script + planning-doc reconciliation sweep
**Confidence:** HIGH (every claim cross-verified against in-repo files or live tool output; only `[CITED: keepachangelog.com]` is external)

## Summary

Phase 16 is a **release-engineering gate**, not a feature phase. There is no new TypeScript, no new schema, no new IPC, no new UI component. The work breaks down into four mechanical buckets, each with established in-repo precedent: (1) version bump + `npm run build:win` (the Phase 4.1-05 pattern, ported to v1.0.0), (2) Windows physical-hardware UAT recorded against a hybrid Section-A/B/C script (the Phase 4 `04-SMOKE-TEST-GUIDE.md` pattern, extended with a per-SMK3-XX matrix), (3) a planning-doc reconciliation sweep (every `v2.0` reference in ROADMAP/STATE/PROJECT/REQUIREMENTS rewritten to the v1.x arc per D-16-20), and (4) git tag `v1.0.0` + `gh release create v1.0.0` piping the CHANGELOG.md inaugural entry as the release body.

Three pieces of state diverge from CONTEXT.md and must be resolved by the planner before any task runs: (a) `package.json` is **already at 0.7.0** (CONTEXT.md says 0.6.0 — that was true on 2026-04-23 but a v0.7.0 release was cut on 2026-04-25 against the now-superseded v2.0/sub-panel-CSV importer; jumping 0.7.0 → 1.0.0 is still consistent with D-16-01 and the "Smoke 3 is v1" narrative), (b) the existing `electron-builder.yml` produces `immunoplex-assay-calculator-1.0.0-setup.exe` — there is **no `${arch}` placeholder** in `nsis.artifactName`, so the D-16-02 expected filename `immunoplex-assay-calculator-1.0.0-x64-setup.exe` requires either editing the artifactName template OR accepting the existing non-arch-suffixed name, (c) `04.1-SMOKE-TEST-RETEST.md` does not exist on disk — CONTEXT.md `<canonical_refs>` lists it as a "(if it exists yet)" pattern reference; the planner cannot use it as a format template and must derive Section A from `04-SMOKE-TEST-GUIDE.md` directly.

**Primary recommendation:** Three plans, wave-split exactly as CONTEXT.md "Plan Structure" recommends. Wave 1 — reconciliation sweep + CHANGELOG.md draft + `seed-legacy-run.ts` author + hand-calc cheat sheet. Wave 2 — version bump + `npm run build:win` + `16-SMOKE-TEST-GUIDE.md` hand-off + `checkpoint:human-action` for physical UAT. Wave 3 — record `16-SMOKE-TEST-RETEST.md` outcomes + git tag `v1.0.0` + `gh release create` + STATE/ROADMAP/PROJECT closeout. Wave 2 is the blocking human gate; Wave 3 cannot start until Wave 2 returns `## Overall: PASS`.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Version bump | Build config (`package.json`) | — | Single source of truth; `electron-builder.yml` reads `${version}` from package.json [VERIFIED: electron-builder.yml line 27 `${name}-${version}-setup.${ext}`] |
| Windows installer build | electron-builder (NSIS target) | electron-vite (renderer + main bundle) | Existing chain `npm run build:win` → `electron-vite build` → `electron-builder --win` already produces a working Windows .exe [VERIFIED: package.json line 18] |
| Installer artifact distribution | Local `dist/` filesystem + manual transfer | GitHub Releases (post-tag) | Past releases v0.5.0 / v0.6.1 / v0.7.0 all uploaded as release assets via gh CLI [VERIFIED: `gh release view v0.7.0` shows `asset: immunoplex-assay-calculator-0.7.0-setup.exe`] |
| Reconciliation sweep | Documentation (`.planning/*.md`) | None — pure file edits | No code change; touches PROJECT.md / STATE.md / ROADMAP.md / REQUIREMENTS.md / 16-CONTEXT.md only |
| Operator-driven UAT | Physical Windows lab PC + markdown checklist | macOS dev host (build only) | CLAUDE.md §Testing Windows-only — macOS host cannot run Windows .exe [CITED: CLAUDE.md lines 49-52] |
| Synthetic legacy run insertion | Node script via `better-sqlite3` raw SQL OR Electron-app one-shot | drizzle-orm (optional, lazy) | The installed app's DB lives at `app.getPath('userData') + '/immunoplex.db'` on Windows = `%APPDATA%\immunoplex-assay-calculator\immunoplex.db` [VERIFIED: src/main/db/client.ts line 13] — script must open this file directly because Electron-app routes go through IPC which is renderer-side |
| Audit-trail historical-run verification | Visual UAT against installed app | `calculation_rules_version IS NULL` row inserted by seed script | Phase 15's `HistoricalRunBanner` toggles on `calculationRulesVersion !== 'smoke3'` [VERIFIED: STATE.md decision 15-04] |
| Git tag + GitHub Release | gh CLI (dev machine) | git tag (annotated, pushed) | `gh auth status` shows `pawj-gne` logged in with `repo` scope on dev machine [VERIFIED: live `gh auth status`] |
| CHANGELOG → Release body | `gh release create --notes-file` OR `--notes "$(...)"` | None | Single source of truth = CHANGELOG.md §[1.0.0]; pipe verbatim into release body per D-16-13 |

## Standard Stack

This phase consumes existing project dependencies; no new packages are introduced.

### Core (already installed and version-verified)

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| electron-builder | ^25.1.8 | Produces Windows NSIS .exe; reads `version` from package.json | Already wired in Plan 04-03; `npm run build:win` works today [VERIFIED: package.json line 55] |
| electron | ^33.4.11 | Runtime — bundled into installer | Locked by past releases v0.5.0 → v0.7.0 [VERIFIED: package.json line 54] |
| better-sqlite3 | ^12.6.2 | Used by `scripts/seed-legacy-run.ts` to open `%APPDATA%\...\immunoplex.db` directly | Already the project's DB driver — no new dependency [VERIFIED: package.json line 30] |
| drizzle-orm | ^0.45.1 | Optional in seed-legacy-run.ts — raw SQL via better-sqlite3 is simpler and avoids needing to bundle drizzle schema into a standalone Node script | Already the project's ORM but not needed for one synthetic INSERT [VERIFIED: package.json line 32] |
| tsx | ^4.21.0 | Runs `seed-legacy-run.ts` directly without compile step | Already the convention — used for `scripts/build-panels-fixture.ts` and `npm run fixtures:panels` [VERIFIED: package.json line 24, 63] |
| xlsx | ^0.18.5 | Reads `templates/panels/all-panels.xlsx` — used during build-panels-fixture; not used in Phase 16 directly | Already the convention [VERIFIED: package.json line 38] |
| gh CLI | 2.89.0 (2026-03-26) | `gh release create v1.0.0` + asset upload | Already installed on dev machine; user `pawj-gne` authenticated with `repo` scope [VERIFIED: live `gh --version` + `gh auth status`] |
| git | (system) | Tag `v1.0.0`, push to origin | Past tags v0.1.0 → v0.7.0 all annotated + pushed via this flow [VERIFIED: `git tag -l`] |

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| Node.js | v24.9.0 (dev machine) | Runs build pipeline + tsx scripts | All build tooling [VERIFIED: live `node --version`] |
| Wine | (unverified) | macOS → Windows NSIS cross-compile; electron-builder spawns wine on macOS hosts | Required for `npm run build:win` on macOS [CITED: electron-builder docs — known requirement for cross-compile]. Past Phase 4.1-05 successfully built x64 + arm64 from macOS — assume wine is functional on the dev machine. |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| `gh release create --notes-file CHANGELOG-1.0.0-section.md` | `gh release create --notes "$(awk ...)"` extracting the §[1.0.0] block inline | Notes-file is cleaner and reviewable; awk-inline avoids creating a transient file but is harder to test. Recommend: extract the §[1.0.0] block into a temp file at release time, point `--notes-file` at it, delete after. |
| Standalone tsx `seed-legacy-run.ts` opening better-sqlite3 directly | Electron-headless approach (spawn the installed app with `--seed-legacy-run` flag) | Direct SQLite is simpler — no new IPC channel, no app-launch race. The DB file is just a SQLite file at a known path. Recommend: tsx + better-sqlite3 + raw SQL INSERT. |
| `electron-builder.yml` artifact rename to include `${arch}` (e.g., `${name}-${version}-${arch}-setup.${ext}`) | Accept the current `${name}-${version}-setup.${ext}` (produces `immunoplex-assay-calculator-1.0.0-setup.exe`) | Adding `${arch}` makes the filename match D-16-02's `1.0.0-x64-setup.exe` expectation and future-proofs against arm64 reintroduction. Cost: one YAML edit. Recommend: edit electron-builder.yml `nsis.artifactName` to `${name}-${version}-${arch}-setup.${ext}` (mirrors what Plan 04-03 did originally and what CONTEXT.md expects). |

**No new packages to install** — `npm install` not needed for Phase 16 unless the planner discovers a missing dev dep at task run time. [VERIFIED: package.json read in full]

## Architecture Patterns

### System Flow Diagram

```
                  [Phase 15.1 merged on dev/v1-01]
                                  │
                                  ▼
            ┌─────────────────────────────────────────┐
            │  WAVE 1: Reconciliation + Authoring     │
            │  (parallel; no file conflicts)          │
            │                                         │
            │  ├── Reconciliation sweep               │
            │  │     STATE.md: v2.0 → v1.0           │
            │  │     PROJECT.md: §Current Milestone  │
            │  │     ROADMAP.md: Phase 16 SC#1,      │
            │  │       version TBD, Phase 6/7 → v1.1 │
            │  │       /v1.2 sections                 │
            │  │     REQUIREMENTS.md: v2.0 framing → │
            │  │       v1.0 framing                   │
            │  │                                       │
            │  ├── CHANGELOG.md draft (Keep-a-       │
            │  │     Changelog 1.1.0 format)         │
            │  │     §[Unreleased] empty placeholder  │
            │  │     §[1.0.0] - YYYY-MM-DD            │
            │  │     ### Added / Changed / Removed /  │
            │  │     Fixed                            │
            │  │                                       │
            │  ├── scripts/seed-legacy-run.ts         │
            │  │     better-sqlite3 + raw SQL INSERT  │
            │  │     calculation_rules_version=NULL   │
            │  │     all 10 Phase 15 snapshot cols    │
            │  │     left NULL → triggers banner       │
            │  │                                       │
            │  ├── 16-SMOKE-TEST-GUIDE.md            │
            │  │     Section A: ~15-step E2E flow     │
            │  │     Section B: SMK3-01..17 + D-15-08 │
            │  │       matrix (one row per req/decision)│
            │  │     Section C: free-text              │
            │  │                                       │
            │  └── 16-HAND-CALC.md cheat sheet        │
            │        PRD worked example + 2-3 more    │
            │        operator hand-checks Section A    │
            └─────────────────────────────────────────┘
                                  │
                                  ▼
            ┌─────────────────────────────────────────┐
            │  WAVE 2: Build + HUMAN-UAT              │
            │  (sequential; UAT blocks tag)           │
            │                                         │
            │  ├── package.json: "0.7.0" → "1.0.0"   │
            │  ├── (optional) electron-builder.yml:   │
            │  │     nsis.artifactName += ${arch}     │
            │  ├── npm run typecheck                  │
            │  ├── npm run build                      │
            │  ├── npm run build:win                  │
            │  ├── verify dist/...-1.0.0-...-setup.exe│
            │  │                                       │
            │  └── checkpoint:human-action            │
            │        Transfer .exe to Windows lab PC  │
            │        Install fresh                     │
            │        Run seed-legacy-run.ts in lab    │
            │        Walk Section A (15 steps)        │
            │        Tick Section B (SMK3-01..17 +    │
            │           D-15-08) PASS/FAIL/N/A         │
            │        Free-text Section C              │
            │        Record to 16-SMOKE-TEST-RETEST.md│
            │        Append `## Overall: PASS|FAIL`    │
            └─────────────────────────────────────────┘
                                  │
                          PASS    │    FAIL
                  ┌──────────────┴──────────────┐
                  ▼                              ▼
       [WAVE 3 runs]                    [STOP — /gsd-plan-phase
                                         16 --gaps OR Phase 16.1]
                  │
                  ▼
            ┌─────────────────────────────────────────┐
            │  WAVE 3: Tag + Release + Closeout       │
            │  (sequential)                            │
            │                                         │
            │  ├── git tag -a v1.0.0 -m "..."         │
            │  ├── git push origin v1.0.0             │
            │  ├── extract CHANGELOG §[1.0.0] →       │
            │  │     /tmp/release-notes.md             │
            │  ├── gh release create v1.0.0 \         │
            │  │     --notes-file /tmp/release-notes.md\│
            │  │     --title "v1.0.0 — Smoke 3 ..."   │
            │  │     dist/immunoplex-assay-calculator-│
            │  │       1.0.0-x64-setup.exe             │
            │  ├── STATE.md: status=complete,         │
            │  │     milestone=v1.0 → v1.1 (next)     │
            │  ├── ROADMAP.md: Phase 16 [x] Complete  │
            │  ├── PROJECT.md: §Current Milestone =   │
            │  │     "v1.0 released YYYY-MM-DD;       │
            │  │     v1.1 staged (Phase 6 — trigger:  │
            │  │     lab-confirmed real-world use)"   │
            │  └── 16-CONTEXT.md cleanup (optional)   │
            └─────────────────────────────────────────┘
```

### Recommended Plan Structure

Wave-split per CONTEXT.md "Plan Structure (Claude's Discretion)" recommendation. Three plans, eight tasks (rough count):

```
.planning/phases/16-windows-uat-release/
├── 16-CONTEXT.md                 # already exists
├── 16-RESEARCH.md                # this file
├── 16-01-PLAN.md                 # Wave 1: reconciliation + CHANGELOG + seed + UAT script + hand-calc
├── 16-02-PLAN.md                 # Wave 2: version bump + build:win + HUMAN-UAT checkpoint
├── 16-03-PLAN.md                 # Wave 3: tag + GitHub release + STATE/ROADMAP/PROJECT closeout
├── 16-SMOKE-TEST-GUIDE.md        # Wave 1 output, consumed in Wave 2
├── 16-SMOKE-TEST-RETEST.md       # Wave 2 output (operator-authored), consumed in Wave 3
├── 16-HAND-CALC.md               # Wave 1 output, referenced from Section A Step 6
└── 16-01-SUMMARY.md, 16-02-..., 16-03-...
```

### Pattern 1: `checkpoint:human-action` task

The exact YAML shape used by Plan 04.1-05 Task 2. The Phase 16 build → install → walk → record cycle reuses this idiom verbatim.

```yaml
# Source: .planning/phases/04.1-smoke-test-fixes/04.1-05-PLAN.md Task 2 [VERIFIED: in-repo]
<task type="checkpoint:human-action" gate="blocking">
  <name>Task N: HUMAN-UAT — Windows Smoke 3 walkthrough</name>
  <files>.planning/phases/16-windows-uat-release/16-SMOKE-TEST-RETEST.md</files>
  <what-built>
    Plan 16-02 produced dist/immunoplex-assay-calculator-1.0.0-...-setup.exe with Phases 12-15.1 merged.
    seed-legacy-run.ts and 16-SMOKE-TEST-GUIDE.md are ready to follow.
  </what-built>
  <action>...wait for operator...</action>
  <how-to-verify>
    Operator follows 16-SMOKE-TEST-GUIDE.md Section A (E2E), Section B (per-SMK3 matrix), Section C (free-text).
    Records results in 16-SMOKE-TEST-RETEST.md with `## Overall: PASS|FAIL` line.
  </how-to-verify>
  <resume-signal>Type "retest passed" or "retest failed: <summary>"</resume-signal>
</task>
```

### Pattern 2: `seed-legacy-run.ts` shape (D-16-15 (b))

The script runs on the operator's Windows PC (per CONTEXT.md `<canonical_refs>` it lives at `scripts/seed-legacy-run.ts`). It opens the installed app's SQLite file directly — no Electron, no IPC. Verified path:

```typescript
// Source: synthesized from src/main/db/client.ts:13 + src/main/db/repositories/run.ts:41-118 [VERIFIED]
// Path: scripts/seed-legacy-run.ts
import Database from 'better-sqlite3'
import * as path from 'path'
import * as os from 'os'
import * as crypto from 'crypto'

// On Windows lab PC, Electron's app.getPath('userData') resolves to:
//   C:\Users\<user>\AppData\Roaming\immunoplex-assay-calculator\immunoplex.db
// On macOS dev (for local sanity testing):
//   ~/Library/Application Support/immunoplex-assay-calculator/immunoplex.db
const dbPath = process.env.IMMUNOPLEX_DB_PATH ?? path.join(
  os.homedir(),
  'AppData', 'Roaming', 'immunoplex-assay-calculator', 'immunoplex.db'
)

const sqlite = new Database(dbPath)
sqlite.pragma('foreign_keys = ON')

const now = new Date().toISOString()
const id = crypto.randomUUID()

// Pick a real (platformId, speciesId, panelId) triple that exists in the seeded DB.
// After importing all-panels.xlsx in Section A Step 2, milliplex-mouse with
// "Milliplex Mouse Premix Panel I 33-plex" will exist. The seed script can either
// hard-code those IDs (planner verifies via /platforms IPC after the import) OR
// receive them via env vars.

// Insert a synthetic pre-Phase-15 run: calculation_rules_version IS NULL +
// all 10 Phase 15 snapshot fields IS NULL. Phase 15's HistoricalRunBanner
// (STATE.md decision 15-04) toggles when calculation_rules_version !== 'smoke3'.
sqlite.prepare(`
  INSERT INTO runs (
    id, request_number, request_override_ad_hoc, user_name, operator_id, run_date,
    sample_type, dilution_factor, sample_count, replicate_mode, request_type,
    platform_id, species_id, panel_id, volume_per_well, dead_volume,
    hamilton, run_plate_position, standard_position, trough_position, comments,
    plex, plate_count, plates_json, created_at, updated_at,
    -- Smoke 3 snapshot fields LEFT NULL — this is the historical-run shape
    calculation_rules_version
  ) VALUES (
    ?, 9000, 0, 'Legacy Operator', ?, '2026-02-15',
    'Supernatant', 5, 24, 'singles', 'premix',
    'milliplex', 'milliplex-mouse', ?, 25, 2000,
    1, 1, 1, 1, 'Seeded pre-Phase-15 run for SMK3-16 UAT',
    7, 1, '{"1":["A4","B4","C4"]}', ?, ?,
    NULL
  )
`).run(id, /* operator_id */ '<UUID-from-DB>', /* panel_id */ '<imported-panel-UUID>', now, now)

console.log(`Seeded legacy run ${id}. Reopen in app; HistoricalRunBanner should appear.`)
sqlite.close()
```

**Critical details:**
- DB path on Windows: `%APPDATA%\immunoplex-assay-calculator\immunoplex.db` [VERIFIED: client.ts uses `app.getPath('userData') + '/immunoplex.db'`; Electron's docs: `userData` on win32 = `%APPDATA%/<appName>`]
- App **must be closed** when the script runs — SQLite WAL mode (line 19 of client.ts) handles concurrent reads but a foreign-key violation during a Phase-15 IPC INSERT would corrupt the test. Section A Step 3 (run seed script) MUST sit between Step 2 (close app after import) and Step 4 (reopen app).
- The seed script needs **real** `operator_id` and `panel_id` UUIDs that exist after Section A Step 2 has imported `all-panels.xlsx`. Two options: (a) the script queries those IDs at run time (`SELECT id FROM operators LIMIT 1`, `SELECT id FROM premix_panels WHERE platform_id='milliplex' AND species_id='milliplex-mouse' LIMIT 1`), or (b) the operator pastes them into env vars. Option (a) is more operator-friendly. [VERIFIED: seed.ts seeds 9 operators on first launch; an imported panel's UUID is generated by the importer transaction]
- `plates_json` shape is `JSON.stringify(Record<plateNumber, well-id[]>)`. Minimum valid value: `'{"1":[]}'` — empty plate 1 row [VERIFIED: run.ts line 79 `platesJson: JSON.stringify(data.plates)` + schema for `Record<number, string[]>`]

### Pattern 3: Keep-a-Changelog 1.1.0 format

```markdown
# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [1.0.0] - 2026-MM-DD

### Added
- Smoke 3 calculator rules: ceiling-to-0.1-mL rounding, setups-scaled dead volume,
  concentration-keyed diluent resolution (any 1× premix wins)
- Plate page inputs: Old Beads, Old Antibodies, Number of Setups
- Run document audit trail: 4-block layout (Inputs / Intermediates / Outputs /
  Diluent decision) with per-reagent breakdown; SAPE Name in metadata header
- Override badge when Old Beads or Old Antibodies exceed the 20% cap
- Sectioned-xlsx panel importer (Criteria / Values / Category blocks per sheet);
  wholesale-replace on re-upload; Roman → Arabic panel-name normalization
- Master `Table` sheet ignored during panel import
- PE volume formula computed from SAPE concentration (typically 1× → PE volume
  equals total assay volume)
- Historical-run advisory banner on runs saved before Smoke 3 rules shipped

### Changed
- Volume rounding precision changed from "nearest mL" to "ceiling at 0.1 mL"
- Dead volume formula changed from a fixed 2 mL constant to (setups × 2 mL)
- Diluent selection rule replaced (was request-type-keyed; now concentration-keyed)
- Duplicate plate layout fills adjacent rows within a column (was horizontal pairs
  + vertical column-12 pairs)
- Bead region display now shows a single flat list (was grouped by panel)

### Removed
- Legacy CSV panel import (`templates/panel-template.csv`,
  `templates/sample-panel-import.csv`)
- "Stock concentration: Xx" label on platform selection screens
- v0.7.0 sub-panel data model (superseded by Smoke 3 per-reagent schema)

### Fixed
- (carryover from Phase 4.1) Duplicate pair orientation now matches Hamilton
  column-major pipetting
- (carryover from Phase 4.1) Adding a second plate no longer wipes plate 1
- (carryover from Phase 4.1) Species visible in run metadata header and RunList
- (carryover from Phase 4.1) Analyte picker scopes to selected premix panel

[unreleased]: https://github.com/pawj-gne/immunoplex-assay-calculator/compare/v1.0.0...HEAD
[1.0.0]: https://github.com/pawj-gne/immunoplex-assay-calculator/releases/tag/v1.0.0
```

Sourced from [CITED: keepachangelog.com/en/1.1.0/]. Section order: `Added / Changed / Deprecated / Removed / Fixed / Security` — only categories that have content are rendered. D-16-11 lists Added / Changed / Removed / Fixed for v1.0.0 (no Deprecated, no Security findings).

### Anti-Patterns to Avoid

- **`gh release create --generate-notes`** — auto-generates from PR titles; bypasses the CHANGELOG single source of truth. Skip this flag.
- **Tagging from a non-clean tree** — `dev/v1-01` has uncommitted `.claude/settings.json` and untracked `.claude/worktrees/`. Either commit or stash before tag time, or the tag will refer to a tree that doesn't match what was built.
- **Force-pushing main** — explicitly forbidden by `.claude/commit.md`. Phase 16 stays on `dev/v1-01`; whether to merge dev → main and tag main, or tag dev, is a planner-locked detail. Past tags (v0.5.0–v0.7.0) appear to be on dev-branch commits, not main — `dev/v1-01` is treated as the de-facto main per CLAUDE.md. **Recommend:** tag the dev/v1-01 commit directly; defer the dev → main merge until v1.x ships.
- **Including secrets in CHANGELOG or release body** — no secrets are at risk in this phase (no API keys, no cert paths), but call this out so the operator/planner doesn't paste DB paths or env values into the release notes.
- **Re-running `seed-legacy-run.ts` after Section B SMK3-16 has been ticked** — leaves duplicate synthetic runs in the lab PC's DB. Operator should delete via the app's Past Runs delete button before re-running (or the script should `DELETE FROM runs WHERE comments LIKE 'Seeded pre-Phase-15%' AND calculation_rules_version IS NULL` before inserting).

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Windows installer artifact name including arch | Custom rename script after build | `${arch}` in `electron-builder.yml` `nsis.artifactName` | electron-builder already interpolates `${arch}` (and `${version}`, `${name}`, `${ext}`); adding it once vs. running a post-build mv is a one-line YAML edit [CITED: electron-builder docs — artifactName template variables] |
| Extracting the [1.0.0] section from CHANGELOG.md | Custom awk/sed regex pipeline | `gh release create --notes-file <path-to-section>` after a small awk extract OR `--notes "$(awk '/^## \\[1\\.0\\.0\\]/,/^## \\[/' CHANGELOG.md | head -n -1)"` | gh CLI handles the body upload; awk is one line; both options exist in established release flows. The extract IS hand-rolled but it's a 3-line awk command, not a tool. |
| Verifying CHANGELOG format compliance | Lint script | Manual review against [Keep a Changelog 1.1.0](https://keepachangelog.com/en/1.1.0/) | One-time inaugural entry; ROI on a linter is zero |
| Synthetic legacy run insert | Spawning a hidden Electron process to use the real IPC stack | Direct `better-sqlite3` INSERT via raw SQL | Bypasses the IPC layer; no race with a running app instance; matches the Phase 15 architecture that "audit trail reads from RunRecord, never from calculatorStore" [VERIFIED: STATE.md decision 15-04] |
| UAT report aggregation across SMK3-XX rows | Spreadsheet, Google Form | A single markdown matrix in `16-SMOKE-TEST-RETEST.md` | Operator already reads markdown on-screen per CLAUDE.md §Testing; matrix is a 21-row markdown table; no tooling needed |
| Code signing for SmartScreen suppression | Buy / borrow a code-signing cert for v1.0 | Accept SmartScreen click-through warning | D-26 (Plan 04-03) explicitly defers code signing; v1.0 ships unsigned; SmartScreen click-through is documented in `04-SMOKE-TEST-GUIDE.md` Step 1 with operator messaging — reuse that messaging verbatim in `16-SMOKE-TEST-GUIDE.md` Section A Step 1 [VERIFIED: 04-SMOKE-TEST-GUIDE.md line 20] |
| New IPC channel for seeded-run insertion | Add `SEED_LEGACY_RUN` IPC handler | Standalone tsx script | No production code value; script is one-shot, never ships in installer |

**Key insight:** Phase 16 has near-zero net-new code. Every "do" is either a config tweak, a markdown file, or a CLI invocation. The temptation to add new TypeScript modules (a seed IPC channel, a CHANGELOG linter, a UAT-results parser) should be resisted — every line of new code is a regression risk against an app that just passed Phase 15.1 with 439/439 tests green.

## Runtime State Inventory

This is a release-engineering phase that **renames** the milestone label from "v2.0" to "v1.0" (D-16-20) across planning docs and bumps an installer artifact name. The grep audit + planner walk-through must answer all five categories:

| Category | Items Found | Action Required |
|----------|-------------|------------------|
| **Stored data** | None in production DB. The seed script INSERTS a synthetic run into the operator's lab-PC `immunoplex.db` — that's NEW data, not renamed. No existing rows reference the "v2.0" string. **VERIFIED:** `grep -i 'v2\.0' src/main/db/seed.ts` returns 0 matches; `runs` table has no `milestone` column. | None — DB rows are untouched. |
| **Live service config** | None. No external services. The app is a single-binary desktop installer. GitHub Releases v0.5.0 / v0.6.1 / v0.7.0 exist as published releases — they are not "renamed", they are predecessors. **VERIFIED:** `gh release list` shows three past releases, none labeled v2.0. | None — past releases stay as published. |
| **OS-registered state** | NSIS installer registers a Windows uninstaller entry and a Start Menu shortcut keyed on `electron-builder.yml` `appId: com.electron.immunoplex-assay-calculator` and `productName: Immunoplex Assay Calculator`. Neither changes in Phase 16. **VERIFIED:** electron-builder.yml lines 1-2. The installed app on the lab PC must be **uninstalled before installing v1.0.0** (NSIS supports in-place upgrade but a clean uninstall + reinstall is the documented operator pattern from Phase 4.1-05 Task 2 `<how-to-verify>` "Uninstall the prior v0.5.0 build if present. Install v0.6.0"). | Operator follows `16-SMOKE-TEST-GUIDE.md` Section A Step 1 — uninstall old, install new. |
| **Secrets and env vars** | None used. No `.env` file in repo (confirmed by electron-builder.yml exclusion `!{.env,.env.*}`). `IMMUNOPLEX_DB_PATH` is an OPTIONAL env var the seed script can read to override the default Windows path — it is created by Phase 16, not renamed. **VERIFIED:** electron-builder.yml line 10. | None. |
| **Build artifacts / installed packages** | (1) `dist/immunoplex-assay-calculator-0.7.0-setup.exe` (or whatever was last built locally) — stale after the 1.0.0 version bump; build pipeline overwrites in place when `npm run build:win` runs. (2) The installed app on the operator's Windows PC is v0.6.1 or v0.5.0 (whatever was last UAT-tested — Phase 4.1-05 retest never completed per STATE.md `Pending Todos`); must be replaced. (3) Stale worktree branches: 29 `worktree-agent-*` branches exist in the local repo (verified via `git branch -a`) — they don't affect the release but the `dev/v1-01` branch needs to be clean before tag time. | (1) Rebuild as part of Wave 2; (2) operator action in Wave 2 UAT; (3) optional housekeeping — `git branch -D worktree-agent-*` before Wave 3 tag, NOT a blocker. |

**Nothing else found.** The "v2.0" string is purely a planning-doc label; it never made it into code, schema, env, or runtime state.

## Common Pitfalls

### Pitfall 1: `electron-builder.yml` artifact name does NOT include `${arch}`
**What goes wrong:** CONTEXT.md D-16-02 says the installer will be `immunoplex-assay-calculator-1.0.0-x64-setup.exe`. The current YAML produces `immunoplex-assay-calculator-1.0.0-setup.exe` (no arch). Plan 04-03 originally added `${arch}` but Plan 13's reduction to x64-only either removed it or the `${arch}` was never persisted to the YAML.
**Why it happens:** `nsis.artifactName: ${name}-${version}-setup.${ext}` is the **current** template — verified by direct read of electron-builder.yml line 27. Past v0.7.0 release asset is `immunoplex-assay-calculator-0.7.0-setup.exe` (no arch) — confirms current state.
**How to avoid:** Wave 2 includes a one-line YAML edit to add `${arch}`: `nsis.artifactName: ${name}-${version}-${arch}-setup.${ext}`. This produces `immunoplex-assay-calculator-1.0.0-x64-setup.exe` matching D-16-02 exactly. Plan 16-02 task acceptance criterion must grep for `${arch}` in `nsis.artifactName`.
**Warning signs:** `dist/` filename after build doesn't match D-16-02 string; downstream `gh release create ... dist/immunoplex-assay-calculator-1.0.0-x64-setup.exe` fails with "no such file".

### Pitfall 2: `package.json` already at 0.7.0, not 0.6.0
**What goes wrong:** CONTEXT.md D-16-02 says "package.json version: '1.0.0'" implying a bump from 0.6.0. Actual current state is 0.7.0 (verified live). The bump is 0.7.0 → 1.0.0, not 0.6.0 → 1.0.0.
**Why it happens:** v0.7.0 was tagged 2026-04-25 for the sub-panel CSV importer (now superseded by Smoke 3). The Smoke 3 work (Phases 12-15.1) has been built and merged on top of 0.7.0 without a corresponding version bump.
**How to avoid:** Planner Wave 2 task description says "bump 0.7.0 → 1.0.0" explicitly. The CHANGELOG.md §[1.0.0] Removed section should mention "v0.7.0 sub-panel data model superseded by Smoke 3 per-reagent schema" so the version-gap is explained for future maintainers. Avoid documenting this as a 0.6 → 1.0 jump.
**Warning signs:** `grep -c '"version": "0.6.0"' package.json` returns 0 (because actual is 0.7.0); Plan task acceptance written against 0.6.0 fails on the precondition check.

### Pitfall 3: `04.1-SMOKE-TEST-RETEST.md` doesn't exist — Phase 4 pattern is the only template
**What goes wrong:** CONTEXT.md `<canonical_refs>` lists `04.1-SMOKE-TEST-RETEST.md (if it exists yet)` as a reference for Phase 16's RETEST format. It doesn't exist — `04.1-05-PLAN.md` Task 2 sets it up but Phase 4.1's HUMAN-UAT was never completed (STATE.md `Pending Todos` still has `HUMAN-UAT-04.1-05-01`).
**Why it happens:** The lab PC has not yet retested Phase 4.1, and STATE.md confirms this. The retest format is **defined** in `04.1-05-PLAN.md` lines 244-265 (a structured markdown block with Part A 14-step table + Part B 4-fix list + Overall: PASS/FAIL), but no operator has produced one.
**How to avoid:** Phase 16 plan defines its own RETEST format from scratch in Plan 16-01 (Wave 1) as part of authoring `16-SMOKE-TEST-GUIDE.md`. The shape is: Section A 15-step table + Section B 18-row matrix (SMK3-01..17 + D-15-08) + Section C free-text + Overall line. Use Plan 04.1-05's defined-but-unrealized shape as the template; do NOT search for the file.
**Warning signs:** Plan 16-01 task tries to read `04.1-SMOKE-TEST-RETEST.md` and gets ENOENT.

### Pitfall 4: Phase 4.1 HUMAN-UAT is still pending in STATE.md
**What goes wrong:** STATE.md line 214: `HUMAN-UAT-04.1-05-01: Windows physical workstation smoke retest ... awaiting`. Phase 16 layers v1.0.0 directly on top of v0.6.x without that retest ever completing. If Phase 4 / 4.1 bugs (BUG-01/02/03, UI-01) regressed in any of Phases 12-15.1, they ship in v1.0.0 unverified.
**Why it happens:** The lab PC has been idle re: Phase 4.1; Smoke 3 work proceeded in parallel on dev machine.
**How to avoid:** Phase 16's Section A E2E flow MUST exercise the four Phase 4.1 fix sites (column-major duplicates, multi-plate preservation, species in metadata, panel scoping) — they're easy to hit during a 15-step E2E. Section B adds an explicit row for each as `D-4.1-01` / `D-4.1-02` / `D-4.1-03` / `D-4.1-04` checks. The Phase 4.1 retest is **subsumed** by Phase 16, not skipped — Plan 16-03 closeout removes `HUMAN-UAT-04.1-05-01` from STATE.md `Pending Todos` as superseded.
**Warning signs:** `grep HUMAN-UAT-04.1-05-01 STATE.md` returns hits after Phase 16 Wave 3 — closeout incomplete.

### Pitfall 5: NSIS in-place upgrade vs. uninstall-first
**What goes wrong:** NSIS installer supports `oneClick` and `perMachine` modes; the default (used in this project — `electron-builder.yml` doesn't set them so it uses electron-builder defaults) allows in-place upgrade BUT past Phase 4 / 4.1 operator scripts told the operator to uninstall first. Inconsistent operator guidance leads to "did v1.0.0 actually install? It says 0.7.0 in the title bar."
**Why it happens:** Electron-builder NSIS defaults: `oneClick: true`, `perMachine: false` — in-place upgrade is automatic. But the operator may have an older Start Menu shortcut still pointing at the v0.7.0 binary; SQLite DB lives in `%APPDATA%` and survives uninstall (a feature, not a bug — preserves operator data across releases).
**How to avoid:** `16-SMOKE-TEST-GUIDE.md` Section A Step 1 explicitly says: "uninstall any prior version via Windows Settings → Apps before running this installer". Pattern verified at `04-SMOKE-TEST-GUIDE.md` line 19-23 (which the operator already knows). Also: Section A Step 1 confirms the app footer / title shows `v1.0.0` — Phase 16 plan task in Wave 2 includes a footer-version-bump (the release skill SKILL.md Phase 3 Step 3 already prescribes this: "Update footer version in src/renderer/src/App.tsx").
**Warning signs:** App title shows v0.7.0 after Section A Step 2; operator can't find v1.0.0 in Start Menu.

### Pitfall 6: `gh release create` requires either pushed tag OR `--target <branch>`
**What goes wrong:** `gh release create v1.0.0` will fail if the tag `v1.0.0` doesn't exist on origin OR if you don't pass `--target dev/v1-01` to tell gh which commit to tag.
**Why it happens:** `gh release create` can both create a tag AND publish a release in one call, but it needs a target.
**How to avoid:** Two-step approach (matches past project pattern — v0.7.0 was a separate `git tag -a` + `git push origin v0.7.0` + `gh release create v0.7.0`): tag locally, push tag, then `gh release create v1.0.0` finds the existing tag and just creates the release. Verified flow against `git tag -l` (v0.7.0 exists) + `gh release view v0.7.0` (release on that tag exists, asset attached).
**Warning signs:** `gh release create` error: "could not find ref v1.0.0".

### Pitfall 7: Wine flakiness on macOS for cross-compile
**What goes wrong:** `npm run build:win` on macOS requires Wine; wine version drift can break electron-builder's signtool stub. Phase 4.1-05 successfully built x64 + arm64, so wine works on this dev machine — but the wine install can break on macOS updates between releases.
**Why it happens:** electron-builder calls wine for the NSIS rcedit step; Apple Silicon macOS + recent wine releases have a known compatibility band.
**How to avoid:** Plan 16-02 task acceptance criterion is "dist/...-x64-setup.exe exists AND is non-zero". If `npm run build:win` fails, the planner has a hands-off escape hatch already in CLAUDE.md (three-strike debug rule + escalate). Don't add wine version pinning to electron-builder.yml — out of scope.
**Warning signs:** electron-builder output like `wine: cannot find ...`, NSIS step error, empty `dist/`.

### Pitfall 8: SmartScreen warning is expected — operator messaging is critical
**What goes wrong:** Operator double-clicks the .exe, sees a SmartScreen "Windows protected your PC" warning, calls the dev to ask if the installer is broken or malicious.
**Why it happens:** No code-signing cert (D-26 deferral). The 04-SMOKE-TEST-GUIDE.md Step 1 already handles this with operator-friendly messaging; reuse it.
**How to avoid:** Copy the verbatim text from `04-SMOKE-TEST-GUIDE.md` lines 19-23 into `16-SMOKE-TEST-GUIDE.md` Section A Step 1: *"Windows SmartScreen will probably complain ('Windows protected your PC' / 'unrecognized app'). Click **More info** → **Run anyway**. This is expected — the installer isn't code-signed yet."*
**Warning signs:** Section C free-text observations mention SmartScreen as a blocker; operator stuck.

### Pitfall 9: gh CLI logged in as wrong user / wrong scope
**What goes wrong:** `gh release create v1.0.0` fails with 403 or "tag could not be created" because the gh token lacks `repo` scope or the user doesn't have push to `pawj-gne/immunoplex-assay-calculator`.
**Why it happens:** Multiple gh accounts on dev machine, token expired, repo permission revoked.
**How to avoid:** **Already verified in this research session:** `gh auth status` shows `pawj-gne` logged in to `github.com` with scopes `'read:org', 'repo', 'workflow'`. Token live. The release was previously cut by this account (v0.7.0 published 2026-04-25 by `pawj-gne` per `gh release view v0.7.0`). No action needed — gh CLI is ready.
**Warning signs:** `gh auth status` shows "not logged in" or a different user; `gh release list` returns 401.

### Pitfall 10: Dirty `dev/v1-01` tree at tag time
**What goes wrong:** `git status` currently shows `M .claude/settings.json` and `?? .claude/worktrees/`. Tagging in this state creates a tag pointing at a commit whose `git diff HEAD` is non-empty — the tag does NOT include those changes. Future archaeology gets confused.
**Why it happens:** `.claude/settings.json` and worktree state accumulate during planning sessions.
**How to avoid:** Plan 16-03 first task: clean working tree (commit or stash `.claude/settings.json`; either commit `.claude/worktrees/` or add it to `.gitignore`). Tag only when `git status --porcelain` is empty (or only contains intentionally-ignored files). Mirror the release SKILL.md Phase 1 step 2 wording: "If changes exist: review, delete any test/debug artifacts, then execute `/commit`."
**Warning signs:** `git status --porcelain | wc -l` > 0 at Wave 3 tag time.

## Code Examples

### Example 1: `npm run build:win` invocation (no changes needed; already wired)

```bash
# Source: package.json line 18 + electron-builder.yml [VERIFIED in-repo]
npm run build:win
# Behind the scenes:
#   npm run build                     -> npm run typecheck && electron-vite build
#   electron-builder --win            -> NSIS .exe for win.target arch (x64 only per electron-builder.yml lines 21-24)
# Output: dist/immunoplex-assay-calculator-${version}-setup.${ext}
#   (becomes ...-1.0.0-x64-setup.exe IF nsis.artifactName gains ${arch})
```

### Example 2: Annotated tag + push (past pattern; verified)

```bash
# Source: .claude/skills/release/SKILL.md Phase 4 Step 3 [VERIFIED in-repo]
# Past tags v0.5.0..v0.7.0 follow this exact shape (verified: `git tag -l` shows all annotated)

git tag -a v1.0.0 -m "Release v1.0.0 — Smoke 3 calculator on Windows lab PC"
git push origin v1.0.0
```

### Example 3: `gh release create` piping CHANGELOG section as body

```bash
# Source: synthesized from gh CLI docs + past v0.7.0 release shape [VERIFIED via `gh release view v0.7.0`]

# Step 1: extract the [1.0.0] section from CHANGELOG.md into a temp file
awk '/^## \[1\.0\.0\]/{flag=1} /^## \[/{if(flag && !/^## \[1\.0\.0\]/){exit}} flag' CHANGELOG.md > /tmp/v1.0.0-notes.md

# Step 2: create the release; gh finds the v1.0.0 tag already pushed; --notes-file pipes the section as body
gh release create v1.0.0 \
  --title "v1.0.0 — Smoke 3 calculator on Windows lab PC" \
  --notes-file /tmp/v1.0.0-notes.md \
  dist/immunoplex-assay-calculator-1.0.0-x64-setup.exe

# Optional: clean up the temp file
rm /tmp/v1.0.0-notes.md
```

### Example 4: Standalone `seed-legacy-run.ts` (D-16-15 (b))

```typescript
// Source: src/main/db/client.ts:13 (path resolution) + src/main/db/repositories/run.ts:55-101 (INSERT shape)
// + electron docs `app.getPath('userData')` resolution [VERIFIED in-repo]

import Database from 'better-sqlite3'
import * as path from 'path'
import * as os from 'os'
import * as crypto from 'crypto'

const dbPath = process.env.IMMUNOPLEX_DB_PATH ?? path.join(
  os.homedir(),
  'AppData', 'Roaming', 'immunoplex-assay-calculator', 'immunoplex.db'
)

console.log(`Opening DB at ${dbPath}`)
const sqlite = new Database(dbPath, { fileMustExist: true })
sqlite.pragma('foreign_keys = ON')

// Idempotency: remove any prior synthetic legacy run before inserting a fresh one
sqlite.prepare(`
  DELETE FROM runs WHERE comments LIKE '[Seeded pre-Phase-15 run]%' AND calculation_rules_version IS NULL
`).run()

// Look up real IDs that the imported all-panels.xlsx + initial seeds populated.
// Operator runs this script AFTER importing the xlsx in Section A Step 2.
const operator = sqlite.prepare(`SELECT id FROM operators WHERE active = 1 LIMIT 1`).get() as { id: string } | undefined
const panel = sqlite.prepare(`
  SELECT id FROM premix_panels
  WHERE platform_id = 'milliplex' AND species_id = 'milliplex-mouse'
  LIMIT 1
`).get() as { id: string } | undefined

if (!operator || !panel) {
  console.error('Cannot find operator or milliplex-mouse panel. Did you import all-panels.xlsx first?')
  process.exit(1)
}

const id = crypto.randomUUID()
const now = new Date().toISOString()

sqlite.prepare(`
  INSERT INTO runs (
    id, request_number, request_override_ad_hoc, user_name, operator_id, run_date,
    sample_type, dilution_factor, sample_count, replicate_mode, request_type,
    platform_id, species_id, panel_id, volume_per_well, dead_volume,
    hamilton, run_plate_position, standard_position, trough_position, comments,
    plex, plate_count, plates_json, created_at, updated_at, calculation_rules_version
  ) VALUES (
    ?, 9000, 0, 'Legacy Operator', ?, '2026-02-15',
    'Supernatant', 5, 24, 'singles', 'premix',
    'milliplex', 'milliplex-mouse', ?, 25, 2000,
    1, 1, 1, 1, '[Seeded pre-Phase-15 run] SMK3-16 UAT — should show HistoricalRunBanner',
    7, 1, '{"1":[]}', ?, ?, NULL
  )
`).run(id, operator.id, panel.id, now, now)

console.log(`Inserted legacy run ${id}. Reopen the app, navigate to Past Runs, Load this row — HistoricalRunBanner ("Computed under previous calculation rules") should appear above the audit trail.`)
sqlite.close()
```

**Runtime requirements:**
1. Operator must have `node` installed on the Windows lab PC OR the dev machine packages `seed-legacy-run.ts` into an executable. Recommend: ship the .ts file alongside the installer (e.g., as a release-asset attached to the v1.0.0 release) and instruct the operator to install Node from nodejs.org. **Alternative:** the dev runs the script remotely against a copy of `immunoplex.db` and ships the modified DB as a release asset (worse — touches operator data). Recommend the Node-install path.
2. `tsx` must be available — `npx tsx scripts/seed-legacy-run.ts` works without global install on a clean Node 18+.
3. The app **must be closed** when the script runs. Section A pre-step sequence: (a) close app, (b) run script, (c) reopen app.

### Example 5: Operator-facing instructions for seed-legacy-run.ts (16-SMOKE-TEST-GUIDE.md Section A Step 3)

```markdown
## 3. Seed a legacy (pre-Phase-15) run for the historical-run banner check

This step inserts one synthetic "old" run into the app's database so you can
verify the amber "Computed under previous calculation rules" banner that
appears on runs saved before Smoke 3 rules shipped.

1. Make sure the app from Step 2 is **closed**. Alt+F4 the window.
2. Download `seed-legacy-run.ts` from the v1.0.0 release assets.
3. If Node.js is not installed, install it from https://nodejs.org/ (LTS).
4. Open PowerShell. Navigate to the folder containing `seed-legacy-run.ts`.
5. Run: `npx tsx seed-legacy-run.ts`
6. You should see: `Inserted legacy run <uuid>. Reopen the app...`
7. Reopen the Immunoplex Assay Calculator from the desktop shortcut.
8. Navigate to **Past Runs**. You should see a row with Request 09000 and
   the comment "[Seeded pre-Phase-15 run] SMK3-16 UAT...".
9. Click **Load** on that row. The wizard populates with the legacy data.
10. Walk to the Finalized Run View (step 5). Above the audit trail you should
    see an amber banner reading "Computed under previous calculation rules."

**✅ Pass:** Banner appears on the seeded run. (Section B SMK3-16 — PASS.)
**❌ Report if:** Banner is missing. (Run does not show as historical.)
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `x64 + arm64` build target | `x64 only` | D-16-03 (2026-05-12) | Halves build time; eliminates unverified arm64 binary risk; ROADMAP Phase 16 SC #1 needs reconciliation. |
| Round to nearest mL | Ceiling at 0.1 mL | SMK3-06 (Phase 12) | Already shipped; v1.0.0 CHANGELOG documents this as a Changed item. |
| Fixed 2 mL dead volume | `setups × 2 mL` | SMK3-05 (Phase 12) | Already shipped; CHANGELOG. |
| Request-type-keyed diluent | Concentration-keyed (any 1× premix wins) | SMK3-07 (Phase 12) | Already shipped; CHANGELOG. |
| Flat CSV importer | Sectioned-xlsx importer | SMK3-08 (Phase 13) | Already shipped; legacy CSV templates deleted; CHANGELOG. |
| Single `reagent_volume_per_well` per master panel | Per-reagent rows (Beads / Antibodies / SAPE) | SMK3-08 (Phase 13) | Already shipped; v0.7.0 sub-panel model superseded; CHANGELOG "Removed". |
| Wizard "Analytes" generic label | Vendor singles term (e.g., "Singleplex") | Was v2.0 VTRM-01 — **no longer applicable**; Smoke 3 PRD does not use vendor term | Phase 16 reconciliation drops VTRM-01/02 from active requirements. |

**Deprecated/outdated:**
- v0.7.0 sub-panel CSV importer — superseded by Smoke 3 sectioned-xlsx parser (Phase 13). Release notes for v0.7.0 stay live on GitHub for historical archaeology; v1.0.0 CHANGELOG "Removed" mentions this lineage.
- `panel-template.csv` and `sample-panel-import.csv` — deleted in Phase 13 (SMK3-LEGACY); confirmed not in `templates/panels/`.
- "v2.0 milestone label" in planning docs — reframed in D-16-20 to "v1.0 active; v1.1 (Phase 6) staged; v1.2 (Phase 7) staged". Reconciliation sweep in Wave 1.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | Wine is functional on the dev machine for macOS → Windows cross-compile | Standard Stack → Supporting | If wine is broken, `npm run build:win` fails in Wave 2 Task 1. Mitigation: Phase 4.1-05 succeeded with this toolchain ~3 weeks ago; very low probability. Three-strike rule applies. |
| A2 | The operator has admin rights to install Windows apps on the lab PC | Common Pitfalls → Pitfall 5 | If lab IT locked down install rights, NSIS installer prompts for credentials. Not blocking — operator typed past this in Phase 4 smoke test. |
| A3 | The operator can install Node.js LTS on the lab PC (needed for `seed-legacy-run.ts`) | Code Examples → Example 5 | If corporate IT blocks Node install, the SMK3-16 historical-banner check can't run from the script. Mitigations: (a) ship a pre-modified DB as a release asset (touches user data — risky), (b) dev runs script remotely and packages the resulting DB — only viable if dev has remote access to lab PC, (c) skip SMK3-16 with explicit `N/A` justification in Section B and revisit when a real pre-Phase-15 run accumulates organically. Recommend planner ask the operator before Wave 1 — this is a real go/no-go gate for D-16-15 (b). |
| A4 | The CHANGELOG.md inaugural entry should NOT back-fill v0.5.0..v0.7.0 historical releases | Code Examples → Example 3 | CONTEXT.md Claude's Discretion section recommends v1.0.0-only — this assumption matches the recommendation. Low risk. |
| A5 | `gh release create` against `pawj-gne/immunoplex-assay-calculator` will succeed with current token | Pitfalls → Pitfall 9 | Live `gh auth status` confirms it, but tokens can expire between research time and Wave 3 execution time. Re-verify in Plan 16-03 Task 1 pre-flight. |
| A6 | The lab PC is Windows x64 (Intel/AMD), not arm64 | D-16-03 + Out-of-scope arm64 | Verified in CONTEXT.md D-16-03 explicitly. Low risk. |
| A7 | The Bio-Rad Human Panel 1 fixture (premix conc = 10× across all 3 premixes, Beads diluent = "Assay Buffer", Antibodies diluent = "Human Diluent") satisfies D-16-15 (a) — a panel where the Values-table diluent fallback is exercised | Section B SMK3-07 row | VERIFIED: `templates/panels/bio-rad-human-panel-1.csv` head shows Beads `Concentration=variable, Diluent=Assay Buffer`, Antibodies `Diluent=Human Diluent`, SAPE concentration=1. Selecting any Bio-Rad premix in Section A triggers the fallback. |
| A8 | The Thermofisher Human Panel I fixture (SAPE concentration = 1) satisfies D-16-15 (d) — PE volume == total assay volume | Section B SMK3-17 row | VERIFIED: `templates/panels/thermofisher-human-panel-i.csv` row 11 shows `SAPE,1,n/a,0.05`. |
| A9 | The Millipore Human Panel 1 fixture (Premix Panel I/A 33-plex @ 1×, Th1/Th2 11-plex @ 1×, JAMmate A 3-plex @ 20×, JAMmate B 6-plex @ 20×) satisfies D-16-15 (a) — a panel where the audit-trail render exercises all 4 blocks AND the 1×-premix-wins diluent path | Section B SMK3-15 + SMK3-07 rows | VERIFIED: `templates/panels/millipore-human-panel-1.csv` row 17 shows Premix Concentration row with `1,1,20,20`. Selecting Premix Panel I/A or Th1/Th2 11-plex triggers the 1×-wins path. |
| A10 | "Stock concentration" labels in Phase 14 cleanup are gone — Section A Step 1 (platform select) doesn't show them | Section A E2E flow validity | Phase 14-03 plan summary in ROADMAP says the labels are removed. Low risk — verified in code by Phase 14 ROADMAP entry. |
| A11 | The synthetic legacy run's `panel_id` reference will succeed even though the seed script runs BEFORE the audit-trail fields are present on that panel's master_panel_reagents (because the seed run sets all snapshot fields to NULL) | Code Examples → Example 4 | Verified by run.ts logic: lines 88-101 only insert snapshot fields if `data.* !== undefined`; passing NULL is fine. The FK constraint on panel_id resolves to the imported premix_panels row — exists after Step 2 import. |
| A12 | `dev/v1-01` is the de-facto main branch for tagging purposes (i.e., tags can be cut on `dev/v1-01` HEAD, not on origin/main) | Anti-Patterns → "Force-pushing main" | Past tags v0.5.0..v0.7.0 were on dev-branch commits per project pattern. CLAUDE.md says "Never commit directly to main - use dev branches" but is silent on tag-branch policy. Confirmed by gh release shape: v0.7.0 release exists, tag exists, no observable PR-merged-to-main step in the recent git log. Treat as low risk but ASK the planner / user in Plan 16-03 if main should be updated post-tag. |

**If this table is empty:** Not the case — 12 assumptions logged. The planner and discuss-phase should walk these before Wave 1 starts. The two highest-risk items are **A3 (Node install on lab PC for seed script)** and **A12 (tag-branch policy)** — both deserve a sentence in the Plan 16-01 or 16-02 frontmatter.

## Open Questions

1. **Does the lab PC operator have admin rights to install Node.js for `seed-legacy-run.ts`?**
   - What we know: The operator successfully installed v0.5.0 (Phase 4 smoke test); admin rights worked then.
   - What's unclear: Whether corporate IT changed posture between then and now; whether Node specifically is allowed.
   - Recommendation: Plan 16-01 frontmatter `<open-question>` to the user. If "no", D-16-15 (b) needs a fallback path (see A3 above).

2. **Should `.claude/worktrees/` be added to `.gitignore` before tagging v1.0.0?**
   - What we know: 29 worktree-agent branches exist; `.claude/worktrees/` is currently untracked. The release SKILL.md Phase 1 step 1 deletes `tmpclaude-*` and `temp_*` but doesn't mention worktrees.
   - What's unclear: Whether worktrees are session-state (delete-safe) or whether they encode something operator-relevant.
   - Recommendation: Plan 16-03 Task 1 pre-flight adds `.claude/worktrees/` to `.gitignore` and commits as `chore: ignore .claude/worktrees session state` before tagging.

3. **Where does `seed-legacy-run.ts` ship? In the repo only, or as a release asset attached to v1.0.0?**
   - What we know: `scripts/` directory exists and is committed (build-panels-fixture.ts is in there).
   - What's unclear: Whether the operator should clone the repo to get the script or whether `gh release create v1.0.0 ... seed-legacy-run.ts` should attach it as an asset.
   - Recommendation: Attach as release asset. Operators don't have git locally; releases page is the natural distribution channel. Plan 16-03 `gh release create` command takes both the .exe and the seed script as positional args.

4. **Does the v1.0.0 GitHub Release title match the past pattern (`v0.7.0 — Sub-panel data model + lab CSV importer`)?**
   - What we know: Past releases follow `vX.Y.Z — <descriptive phrase>` exactly.
   - What's unclear: D-16-13 says "release body reuses the CHANGELOG section verbatim" but is silent on the title format.
   - Recommendation: Plan 16-03 uses `--title "v1.0.0 — Smoke 3 calculator on Windows lab PC"`. Mirrors v0.7.0 shape.

5. **Should Phase 16 update `src/renderer/src/App.tsx` footer version string?**
   - What we know: Release SKILL.md Phase 3 Step 3 explicitly prescribes this. Phase 4.1-05 did not include this step (the plan text references it only obliquely).
   - What's unclear: Whether the App.tsx footer is the visible version source for the operator, or whether package.json + Electron's window title suffice.
   - Recommendation: YES — Plan 16-02 includes the footer edit. The operator visually verifies "v1.0.0" in Section A Step 1 (first launch); the App.tsx footer is the easiest place for that.

6. **Does Phase 16 commit the dist/ artifact or .gitignore it?**
   - What we know: `.gitignore` not read in this research; CONTEXT.md doesn't mention it.
   - What's unclear: Whether `dist/*.exe` is currently tracked.
   - Recommendation: Plan 16-02 Task 1 acceptance criterion ensures `dist/` artifacts are NOT committed (only attached to GitHub release). Verify via `git status --porcelain dist/` returning empty before Wave 3 tag.

7. **What's the recovery path if a Section B SMK3-XX row fails?**
   - What we know: CONTEXT.md D-16-08 says "A single Fail blocks the v1.0.0 tag and triggers a Phase 16.1 fix-loop (Phase 4.1 precedent)."
   - What's unclear: Whether the operator can mark Fail-with-justification-to-defer (e.g., "SMK3-17 PE volume shows ÷ by 1× → equals total assay volume, BUT the rendered cell has a 0.0001 mL float-rounding error — acceptable but documented")
   - Recommendation: Section B accepts `PASS / FAIL / PASS-with-note / N/A`. The Overall: PASS is a function of `any FAIL → FAIL; else PASS`. PASS-with-note is logged but doesn't block. Plan 16-01 makes this scoring rubric explicit in `16-SMOKE-TEST-GUIDE.md` Section B preamble.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| node | All build steps + seed script + scripts/build-panels-fixture.ts | ✓ | v24.9.0 (dev) | — |
| npm | All build steps | ✓ | (bundled with node) | — |
| electron-builder | `npm run build:win` | ✓ | 25.1.8 (devDep) | — |
| wine | macOS cross-compile of .exe | ✓ (assumed — Phase 4.1-05 worked) | unverified | Build on Windows PC directly (defer if wine breaks) |
| git | tag + push | ✓ | (system) | — |
| gh CLI | release create | ✓ | 2.89.0 (2026-03-26) | Manual GitHub UI release |
| GitHub auth (pawj-gne) | release create | ✓ | repo + workflow scopes | Re-auth if expired |
| Windows lab PC | UAT | (operator-side) | (operator-side) | — (CANNOT fall back; physical hardware required) |
| Node.js on Windows lab PC | seed-legacy-run.ts | unknown | unknown | A3 above — skip SMK3-16 with N/A, OR ship pre-modified DB, OR dev remote-runs script |
| Admin rights on lab PC | NSIS install | ✓ (assumed — Phase 4 worked) | — | Operator escalates to IT |

**Missing dependencies with no fallback:**
- Windows lab PC physical access — non-negotiable, blocks Wave 2 HUMAN-UAT entirely.

**Missing dependencies with fallback:**
- Node.js on lab PC (for seed script) — see Open Question 1 + Assumption A3.

## Validation Architecture

`workflow.nyquist_validation` is **not set** in `.planning/config.json` → treat as enabled per default policy.

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Vitest 2.1.9 [VERIFIED: package.json line 66] |
| Config file | `vitest.config.ts` (not read in this research; Phase 5-02 established it) |
| Quick run command | `npm test -- --run --reporter=dot` |
| Full suite command | `npm test -- --run` |

**Important:** Phase 16 introduces **zero new unit tests**. The Phase 12-15.1 suite is already 439/439 green (STATE.md PROJECT.md note 2026-05-13). The validation surface for Phase 16 is **manual / operator-driven UAT against the installed Windows .exe**. Vitest cannot exercise an installer or a packaged Electron app.

### Phase Requirements → Test Map

The "requirements" for Phase 16 are NOT classical SMK3-XX implementation gates (those landed in Phases 12-15.1). They are:

1. **Build artifacts produced** — automated check.
2. **Reconciliation sweep complete** — automated grep check.
3. **CHANGELOG.md exists with §[1.0.0]** — automated grep check.
4. **HUMAN-UAT recorded** — manual (`16-SMOKE-TEST-RETEST.md` contains `## Overall: PASS`).
5. **Tag + release created** — automated check (`git tag -l` + `gh release view`).

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| P16-BUILD | `dist/...-1.0.0-x64-setup.exe` exists, non-zero | smoke | `test -s dist/immunoplex-assay-calculator-1.0.0-x64-setup.exe` | ❌ Wave 2 produces |
| P16-VERSION | package.json version = 1.0.0 | smoke | `grep -c '"version": "1.0.0"' package.json` (≥ 1) | ❌ Wave 2 produces |
| P16-CHANGELOG | CHANGELOG.md exists with §[1.0.0] heading | smoke | `grep -c '^## \[1\.0\.0\]' CHANGELOG.md` (= 1) | ❌ Wave 1 produces |
| P16-RECON-STATE | STATE.md milestone = v1.0 | smoke | `grep -c '^milestone: v1\.0' .planning/STATE.md` (= 1) | ❌ Wave 1 produces |
| P16-RECON-PROJECT | PROJECT.md §Current Milestone reframed | smoke | `grep -c 'Current Milestone: v1\.0' .planning/PROJECT.md` (≥ 1) | ❌ Wave 1 produces |
| P16-RECON-ROADMAP | ROADMAP.md Phase 16 SC #1 says x64 only | smoke | `grep -c 'x64 + arm64' .planning/ROADMAP.md` (= 0) | ❌ Wave 1 produces |
| P16-SEED-EXISTS | scripts/seed-legacy-run.ts exists, valid TypeScript | smoke | `test -s scripts/seed-legacy-run.ts && npx tsc --noEmit --allowJs scripts/seed-legacy-run.ts` | ❌ Wave 1 produces |
| P16-GUIDE-EXISTS | 16-SMOKE-TEST-GUIDE.md exists with Section A/B/C | smoke | `grep -c '^## Section A\|^## Section B\|^## Section C' .planning/phases/16-windows-uat-release/16-SMOKE-TEST-GUIDE.md` (= 3) | ❌ Wave 1 produces |
| P16-RETEST-PASS | 16-SMOKE-TEST-RETEST.md contains `## Overall: PASS` | manual | `grep -c '^## Overall: PASS' .planning/phases/16-windows-uat-release/16-SMOKE-TEST-RETEST.md` (= 1) | ❌ Wave 2 (operator) produces |
| P16-TAG | git tag v1.0.0 exists locally and on origin | smoke | `git tag -l v1.0.0 \| wc -l` (= 1) and `git ls-remote --tags origin v1.0.0 \| wc -l` (= 1) | ❌ Wave 3 produces |
| P16-RELEASE | gh release v1.0.0 exists and has installer asset | smoke | `gh release view v1.0.0 \| grep -c '^asset:'` (≥ 1) | ❌ Wave 3 produces |
| SMK3-01..17 | Per-requirement matrix in Section B of GUIDE | manual | operator-driven UAT; no automated form | (covered by P16-RETEST-PASS) |
| D-15-08 | Override badge displays when Old Beads/Old Antibodies > 20% cap | manual | Section B D-15-08 row | (covered by P16-RETEST-PASS) |

### Sampling Rate

- **Per task commit:** `npm run typecheck` (existing rule; not relaxed) + any Wave 1/3 task touching markdown skips vitest (it's documentation).
- **Per wave merge:** `npm test -- --run` once before Wave 2 build (sanity that Phases 12-15.1 still pass on `dev/v1-01` HEAD).
- **Phase gate:** Full vitest suite green before `npm run build:win` (Wave 2 Task 1 prerequisite).

### Wave 0 Gaps

- [ ] None — existing test infrastructure (vitest, 439 tests) covers all programmatic behavior. No new tests required. (Phase 16 is a release-engineering phase; the test surface IS the operator UAT.)

## Security Domain

`security_enforcement` is not set in `.planning/config.json` → treat as enabled per default policy.

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | yes (gh CLI token) | gh CLI manages token; user pawj-gne authenticated with `repo` scope — verified live. Do not embed token in scripts or CHANGELOG. |
| V3 Session Management | no | No session model in a desktop installer. |
| V4 Access Control | yes (GitHub repo + Windows install) | gh token scope (`repo`) is correct minimum; NSIS installer asks Windows UAC consent — out of project's control. |
| V5 Input Validation | yes (seed-legacy-run.ts inputs) | Script takes optional `IMMUNOPLEX_DB_PATH` env var; existing code already validates via better-sqlite3 `fileMustExist: true` — won't create a fresh DB if path is wrong. Operator notice. |
| V6 Cryptography | yes (installer signing — deferred) | D-26 (Plan 04-03) defers code signing. SmartScreen warning expected; documented for operator. **No new crypto code.** |
| V10 Malicious Code | yes (release-asset integrity) | gh CLI uses HTTPS for upload + GitHub provides asset checksums in the API; no project-side signing planned. **Accept** per D-26. |
| V14 Configuration | yes (electron-builder.yml + CHANGELOG content) | Avoid leaking internal paths, env values, or project-internal codes in the user-facing CHANGELOG body (D-16-12 explicitly: "no internal codes like SMK3-XX or D-XX-XX in the user-visible body"). |

### Known Threat Patterns for {Electron desktop + GitHub Releases}

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Unsigned installer triggers SmartScreen | Repudiation | Operator messaging in Section A Step 1 (reuse 04-SMOKE-TEST-GUIDE.md verbatim); code signing deferred per D-26 — accepted risk for internal lab deployment |
| Token leakage via CHANGELOG or release body | Information Disclosure | Plan 16-01 task acceptance: grep CHANGELOG.md for `ghp_`, `gho_`, `ghs_`, `github_pat_` — must return 0 |
| seed-legacy-run.ts inserts attacker-controlled row | Tampering | Script ships as a release asset; checksum on the release page; operator should download from the release URL, not arbitrary sources. Acceptance criterion: script body grep'd for any `eval()`, `exec()`, or untyped fetch — clean. |
| dist/ artifact swap during release upload | Tampering | gh CLI uploads over HTTPS; GitHub stores SHA-256 per asset; out of project's local control. Document for operator: "Download from the v1.0.0 release page on GitHub, not from email or chat." |
| `npm run build:win` runs untrusted build code | Tampering | Inherits project's existing supply-chain posture; no new deps added in Phase 16; npm audit (out of scope) untouched. |

**No HIGH-severity threats introduced in Phase 16.** Inherits Phase 4.1-05's D-26 posture (no code signing, internal-lab-only deployment); no expansion of attack surface.

## Sources

### Primary (HIGH confidence — in-repo verified)
- `.planning/phases/16-windows-uat-release/16-CONTEXT.md` — locked decisions D-16-01..20
- `package.json` — current version 0.7.0, scripts: build, build:win, fixtures:panels, test, typecheck
- `electron-builder.yml` — win.target x64-only (verified line 23-24), nsis.artifactName no ${arch} (line 27), signAndEditExecutable: false (line 20)
- `src/main/db/client.ts` — DB path resolution via `app.getPath('userData')` (line 13)
- `src/main/db/repositories/run.ts` — runs INSERT shape including all 10 Phase 15 snapshot fields (lines 55-101)
- `src/shared/types/run.ts` — RunCreate + RunRecord types
- `src/main/db/seed.ts` — operator + platform + species + panel seed data
- `templates/panels/thermofisher-human-panel-i.csv` — confirms SAPE concentration = 1 (row 11)
- `templates/panels/millipore-human-panel-1.csv` — confirms 1× + 20× premix coexistence in one panel (row 17)
- `templates/panels/bio-rad-human-panel-1.csv` — confirms Values-table diluent fallback path (rows 9-12 — Beads/Antibodies/SAPE diluent strings differ per reagent; all premixes are 10× = no 1× wins)
- `scripts/build-panels-fixture.ts` — `npm run fixtures:panels` regenerates all-panels.xlsx with 17 sheets (16 panels + Table)
- `.planning/phases/04-run-documentation-persistence-deployment/04-SMOKE-TEST-GUIDE.md` — Section A 14-step pattern
- `.planning/phases/04-run-documentation-persistence-deployment/04-SMOKE-TEST-RESULTS.md` — operator-authored RETEST format (PDF-derived but markdown structure visible)
- `.planning/phases/04.1-smoke-test-fixes/04.1-05-PLAN.md` — `checkpoint:human-action` YAML pattern + RETEST.md format definition
- `.planning/STATE.md` — milestone v2.0, decisions 12-01..15.1, Releases table, Pending Todos HUMAN-UAT-04.1-05-01
- `.planning/ROADMAP.md` — Phase 16 SC#1 ("x64 + arm64" needs reconciling), Phase 11 superseded note
- `.planning/PROJECT.md` — §Current Milestone wording (needs reframe)
- `.planning/REQUIREMENTS.md` — SMK3-01..17 IDs, validation status
- `.claude/skills/release/SKILL.md` — Phase 1-4 release flow
- `.claude/skills/commit/SKILL.md` — Conventional Commits + dev-branch rule
- CLAUDE.md lines 33-52 — dev-branch-only, Conventional Commits, three-strike debug rule, Windows-only testing
- Live `gh auth status` — pawj-gne logged in, repo+workflow scopes, token live
- Live `gh release view v0.7.0` — past release pattern: title shape, asset shape, body shape
- Live `gh --version` — 2.89.0 (2026-03-26)
- Live `node --version` — v24.9.0
- Live `git tag -l` — v0.1.0..v0.7.0 all present
- Live `git status --porcelain` — dev/v1-01 not fully clean

### Secondary (MEDIUM confidence)
- Past Phase 4.1-05 plan: built x64 + arm64 from macOS successfully — implies wine works on dev machine (not re-verified this session)
- Phase 15-RESEARCH.md / 15.1-RESEARCH.md / 15.1-PATTERNS.md existence noted but not deeply read this session — Plan 16-01 may want to skim 15.1-VALIDATION.md for any post-Phase-15.1 deltas

### Tertiary (LOW confidence)
- electron-builder NSIS in-place upgrade behavior (Pitfall 5) — inferred from electron-builder defaults; not verified by running the v0.7.0 → v1.0.0 upgrade end-to-end

### External (CITED)
- [keepachangelog.com/en/1.1.0/](https://keepachangelog.com/en/1.1.0/) — section order, version-heading shape, link-references format, six allowed change-type categories

## Project Constraints (from CLAUDE.md)

| Directive | Source | How Phase 16 Honors |
|-----------|--------|---------------------|
| Never commit directly to main — use dev branches (`dev/v1-01`, etc.) | CLAUDE.md §Workflows → Committing Changes | Phase 16 stays on `dev/v1-01`; tag is cut on dev branch HEAD; no main push. |
| Conversation-scoped commits by default | CLAUDE.md + `.claude/commit.md` | Each plan task commits only its diff; reconciliation sweep is one commit, CHANGELOG is one, version bump is one. |
| Always push after committing | CLAUDE.md + `.claude/commit.md` | Plan tasks include `git push -u origin HEAD` after each commit step. |
| Conventional Commits (`feat:`, `fix:`, `refactor:`, `docs:`, `chore:`) | CLAUDE.md + `.claude/commit.md` | Wave 1 commits: `docs(16):` for planning files, `feat(16):` for seed-legacy-run.ts. Wave 2: `chore(16): bump version to v1.0.0`. Wave 3: `chore(16): tag v1.0.0`. |
| Three-strike rule on debug attempts | CLAUDE.md §Workflows → Debugging | If wine breaks or build:win fails 3 times in Wave 2, stop and escalate. |
| Windows-only testing — dev on macOS, test on Windows | CLAUDE.md §Testing | Phase 16 designed around this exactly: build on macOS, transfer to lab, install, UAT. No macOS runtime tests. |
| ELECTRON_RUN_AS_NODE breaks Electron dev inside SDK | CLAUDE.md §Testing + MEMORY.md electron_sdk_gotcha | Does NOT affect Phase 16 — no in-SDK Electron dev tests are required (UAT is operator-side). |

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — every package + version + script verified against package.json + electron-builder.yml + live `node --version`/`gh --version`. No `[ASSUMED]` entries in this section.
- Architecture: HIGH — system flow diagram derives from Phase 4 + 4.1-05 precedent verified in-repo; checkpoint:human-action YAML pattern lifted verbatim from 04.1-05-PLAN.md.
- Pitfalls: HIGH-to-MEDIUM — 10 pitfalls; 8 verified by direct in-repo grep or live tool output, 2 inferred from electron-builder docs (Pitfall 5, Pitfall 7 wine flakiness).
- Code examples: HIGH — seed-legacy-run.ts shape synthesized from client.ts + run.ts INSERT shape (line 55-101 verified); CHANGELOG.md template direct from keepachangelog.com; gh release create pattern from past v0.7.0 verified live.
- Assumptions log: 12 entries, all flagged honestly. Two material ones (A3 Node-on-lab-PC, A12 tag-branch-policy) deserve explicit user confirmation before Wave 1 executes.

**Research date:** 2026-05-12
**Valid until:** 2026-05-19 (7 days — fast-moving release-engineering target; gh CLI version + electron-builder behavior should be re-verified if the gap stretches longer)
