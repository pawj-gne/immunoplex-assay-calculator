---
phase: 13
slug: smoke-3-panel-xlsx-parser-v3
status: draft
nyquist_compliant: true
wave_0_complete: false
created: 2026-05-12
last_revised: 2026-05-12
---

# Phase 13 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

> Source: derived from `13-RESEARCH.md` §Validation Architecture.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | `vitest@2.1.9` (installed; `pool: 'forks'`, `globals: true`, `environment: 'node'`) |
| **Config file** | `vitest.config.ts` (existing) |
| **Quick run command** | `npm test -- src/main/import` |
| **Full suite command** | `npm test` |
| **Estimated runtime** | ~2–5s quick · ~10–20s full |

---

## Sampling Rate

- **After every task commit:** Run `npm test -- src/main/import`
- **After every plan wave:** Run `npm test`
- **Before `/gsd-verify-work`:** Full suite must be green
- **Max feedback latency:** ~20 seconds (full suite)

---

## Per-Task Verification Map

> Back-filled per checker validation info. Each task row links Task ID → Plan/Wave → Requirement → Test Command. Status updated during execution.

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 13-01-T1 | 13-01 | 1 | schema | — | N/A | unit (tsc) | `npx tsc --noEmit -p tsconfig.node.json --composite false` | ❌ W0 | ⬜ pending |
| 13-01-T2 | 13-01 | 1 | schema | T-13-02 | DB UNIQUE + CHECK enforce master-panel constraints | unit (tsc) | `npx tsc --noEmit -p tsconfig.node.json --composite false` | ❌ W0 | ⬜ pending |
| 13-01-T3 | 13-01 | 1 | schema, SMK3-11 | T-13-01, T-13-04 | Repository methods do not open transactions; importer owns scope | unit (tsc) | `npx tsc --noEmit -p tsconfig.node.json --composite false` | ❌ W0 | ⬜ pending |
| 13-01-T4 | 13-01 | 1 | schema | T-13-01 | CHECK reagent_kind_enum + sape_conc_not_null enforced at DB layer | repository | `npm test -- masterPanelReagent.test.ts` (skipped until 13-03 lands) | ❌ W0 | ⬜ pending |
| 13-01-T5 | 13-01 | 1 | schema | T-13-02 | Composite UNIQUE (platform_id, species_id, name) rejects duplicates at DB layer (D-14) | repository | `npm test -- masterPanel.test.ts` | Partial (extend existing) | ⬜ pending |
| 13-02-T1 | 13-02 | 1 | infra | — | N/A | infra | `npm run fixtures:panels -- --help` (smoke check tsx resolves) | ❌ W0 | ⬜ pending |
| 13-02-T2 | 13-02 | 1 | SMK3-08, SMK3-10 | T-13-05 | Generator script reads committed CSV fixtures (no external network) | infra | `node_modules/.bin/tsx scripts/build-panels-fixture.ts` | ❌ W0 | ⬜ pending |
| 13-02-T3 | 13-02 | 1 | SMK3-08, SMK3-10 | T-13-05 | Generated .xlsx committed deterministically; SHA-256 stable across regenerations | infra | `node -e "...; if (wb.SheetNames.length !== 18) process.exit(1)"` (inline JS verify of 17 panels + Table sheet) | ❌ W0 | ⬜ pending |
| 13-03-T1 | 13-03 | 2 | schema | T-13-08 | Generated SQL contains the mandatory CHECK + UNIQUE + FK SET NULL clauses | migration (grep) | `grep -ic "ON DELETE SET NULL" drizzle/migrations/0007_*.sql` (>= 2 expected) | ❌ W0 | ⬜ pending |
| 13-03-T2 | 13-03 | 2 | schema, SMK3-11 | T-13-08, T-13-10 | Post-migration FK SET NULL constraint behavior verified at SQL layer (WARN-5 rename); D-15 + D-17 verified | migration | `npm test -- migration.test.ts` | Partial (extend existing) | ⬜ pending |
| 13-03-T3 | 13-03 | 2 | schema | T-13-01 | Plan 01 deferred (it.skip) tests now active against the migrated in-memory DB | repository | `npm test -- masterPanelReagent.test.ts masterPanel.test.ts` | ❌ W0 (un-skip from 13-01 output) | ⬜ pending |
| 13-03-T4 | 13-03 | 2 | schema | T-13-08, T-13-10 | Live dev DB schema matches generated migration (manual checkpoint; reversible via backup) | manual | manual (`npm run db:push` — [BLOCKING] human-action checkpoint) | n/a (manual) | ⬜ pending |
| 13-04-T1 | 13-04 | 2 | SMK3-09 | T-13-11 (input validation) | Roman→Arabic conversion rejects out-of-range with D-20 message; canonReagentKind trims whitespace + aliases (no overflow surface) | unit | `npm test -- normalize.test.ts` | ❌ W0 | ⬜ pending |
| 13-04-T2 | 13-04 | 2 | SMK3-08, SMK3-10, SMK3-DIL-01 | T-13-12 (parser DoS) | Parser blank-stop rules + Table-skip + Pattern A/B detection + diluent verbatim capture | unit | `npm test -- parser.test.ts` | ❌ W0 (REWRITE) | ⬜ pending |
| 13-04-T3 | 13-04 | 2 | SMK3-08, SMK3-09 | T-13-13 (cross-sheet collision) | Validator aggregates errors across ALL sheets before returning; D-21 collision rejects entire file | unit | `npm test -- validator.test.ts` | ❌ W0 | ⬜ pending |
| 13-05-T1 | 13-05 | 3 | SMK3-08, SMK3-09, SMK3-10, SMK3-11, SMK3-DIL-01 | T-13-16, T-13-19 | Single transaction wraps all per-panel writes; rollback on any throw | unit (tsc) | `npx tsc --noEmit -p tsconfig.node.json --composite false` | ❌ W0 (REWRITE) | ⬜ pending |
| 13-05-T2 | 13-05 | 3 | SMK3-08, SMK3-11, SMK3-DIL-01 | T-13-16, T-13-20, T-13-21 | Wholesale-replace + FK SET NULL + diluent verbatim + MANDATORY rollback (WARN-1) + Phase 12 SMK3-16 cross-phase regression (WARN-3) | integration | `npm test -- importer.test.ts` | ❌ W0 | ⬜ pending |
| 13-05-T3 | 13-05 | 3 | SMK3-08, SMK3-09, SMK3-10, SMK3-11, SMK3-DIL-01 | T-13-19 | SC #6 17/17 fixture gate via templates/panels/all-panels.xlsx (Plan 02 output) | integration | `npm test -- allPanelsFixture.test.ts` | ❌ W0 (requires `all-panels.xlsx`) | ⬜ pending |
| 13-06-T1 | 13-06 | 4 | SMK3-08, SMK3-11 | T-13-22 | IPC + preload type declarations match main-process ImportResult shape; tsc catches drift | unit (tsc) | `npx tsc --noEmit -p tsconfig.node.json --composite false && npx tsc --noEmit -p tsconfig.web.json --composite false` | Partial (extend existing) | ⬜ pending |
| 13-06-T2 | 13-06 | 4 | SMK3-08, SMK3-11 | T-13-17 | Banner renders structured per-sheet summaries + grouped errors; no PII | unit (tsc + grep) | `npx tsc --noEmit -p tsconfig.web.json --composite false` + `grep -c "result.summaries\|wasUpdate" src/renderer/src/features/import/ImportButton.tsx` | Partial (extend existing) | ⬜ pending |
| 13-06-T3 | 13-06 | 4 | SMK3-08, SMK3-09, SMK3-10, SMK3-11, SMK3-DIL-01 | T-13-23 | Legacy CSV deletion (SC #5) verified at filesystem; full suite green + Phase 12 runStore regression preserved | integration | `npm test && npm test -- runStore.test.ts && npm run typecheck && npm run lint` | n/a (deletion) | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

**Sampling continuity:** Every task in waves 1-4 has an automated verify command. No three consecutive tasks rely on the same Wave 0 dependency, and no task chain exceeds two manual checkpoints (only 13-03-T4 is manual; surrounding tasks 13-03-T1/T2/T3 + 13-05-T1 are all automated).

---

## Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| SMK3-08 | Multi-sheet xlsx parse → `ResolvedPanel[]` | Unit + integration | `npm test -- parser.test.ts allPanelsFixture.test.ts` | ❌ Wave 0 (rewrite) |
| SMK3-08 | Per-reagent rows in Values block (beads/antibodies/sape × conc/diluent/vol) | Unit | `npm test -- parser.test.ts -t "parseValues"` | ❌ Wave 0 |
| SMK3-08 | Premix matrix in Category block (Pattern A + Pattern B layouts) | Unit | `npm test -- parser.test.ts -t "parseCategory"` | ❌ Wave 0 |
| SMK3-09 | Roman → Arabic normalization (I..X) | Unit | `npm test -- normalize.test.ts` | ❌ Wave 0 |
| SMK3-09 | Out-of-range Roman or invalid panel name rejected with D-20 message | Unit | `npm test -- normalize.test.ts -t "out of range"` | ❌ Wave 0 |
| SMK3-10 | `Table` sheet skipped (case-insensitive equality) | Unit | `npm test -- parser.test.ts -t "Table sheet"` | ❌ Wave 0 |
| SMK3-10 | Non-Table sheets without Criteria/Values/Category markers fail validation | Unit | `npm test -- parser.test.ts -t "missing marker"` | ❌ Wave 0 |
| SMK3-11 | Wholesale-replace deletes old children + INSERTs fresh | Integration | `npm test -- importer.test.ts -t "wholesale replace"` | ❌ Wave 0 |
| SMK3-11 | Re-upload of (Platform, Species, Panel) updates master in place | Integration | `npm test -- importer.test.ts -t "update existing"` | ❌ Wave 0 |
| SMK3-11 | `runs.panel_id` becomes NULL after wholesale-delete (D-15 SET NULL) | Integration | `npm test -- importer.test.ts -t "FK SET NULL"` | ❌ Wave 0 |
| SMK3-11 | `run_single_analytes.analyte_id` NULL after replace (D-17 SET NULL) | Integration | `npm test -- importer.test.ts -t "analyte SET NULL"` | ❌ Wave 0 |
| SMK3-11 | D-21 duplicate-normalize file reject (zero DB writes) | Unit | `npm test -- validator.test.ts -t "duplicate normalize"` | ❌ Wave 0 |
| SMK3-11 | Importer rolls back ALL writes on mid-transaction throw (WARN-1 MANDATORY) | Integration | `npm test -- importer.test.ts -t "rolls back"` | ❌ Wave 0 |
| SMK3-11 ↔ SMK3-16 | Phase 12 cross-phase regression: runs.number_of_setups + volume_per_well + plates_json intact after FK SET NULL (WARN-3 MANDATORY) | Integration | `npm test -- importer.test.ts -t "SMK3-16\|cross-phase regression"` | ❌ Wave 0 |
| SMK3-DIL-01 | Diluent stored verbatim (open-text, no normalization) | Integration | `npm test -- importer.test.ts -t "diluent verbatim"` | ❌ Wave 0 |
| (schema) | `master_panel_reagents` CHECK constraints (reagent_kind enum; SAPE conc NOT NULL) | Repository | `npm test -- masterPanelReagent.test.ts` | ❌ Wave 0 |
| (schema) | Composite UNIQUE on `(platform_id, species_id, name)` (D-14) | Repository | `npm test -- masterPanel.test.ts -t "composite UNIQUE"` | Partial — extend existing |
| (schema) | Migration 0007 applies cleanly + schema artifacts exist + FK SET NULL constraint behavior verified | Migration | `npm test -- migration.test.ts -t "0007"` | Partial — extend existing |
| SC #6 | 17/17 fixtures parse via `templates/panels/all-panels.xlsx` | Integration | `npm test -- allPanelsFixture.test.ts` | ❌ Wave 0 (requires `all-panels.xlsx`) |

---

## Wave 0 Requirements

> These artifacts MUST exist before sampling-rate gates can fire. Planner assigns to the first wave that creates them.

### Scripts + Fixtures
- [ ] `scripts/build-panels-fixture.ts` — converts `templates/panels/*.csv` → `templates/panels/all-panels.xlsx`
- [ ] `templates/panels/all-panels.xlsx` — generated artifact (committed once; regenerable)
- [ ] `tsx` devDependency in `package.json`; `scripts.fixtures:panels` npm task

### New parser/validator/importer surface
- [ ] `src/main/import/normalize.ts` — `normalizePanelName(raw, sheetName)`, `canonReagentKind(s)`, Roman→Arabic (I..X)
- [ ] `src/main/import/__tests__/normalize.test.ts` — Roman edge cases (bounds; case sensitivity; non-matching)
- [ ] `src/main/import/__tests__/parser.test.ts` — REWRITE (existing file references deleted `panel-template.csv`)
- [ ] `src/main/import/__tests__/validator.test.ts` — NEW (multi-sheet error aggregation; D-21 collision; premix-member matching)
- [ ] `src/main/import/__tests__/importer.test.ts` — NEW (transaction; wholesale-replace; FK SET NULL; MANDATORY rollback T-6; MANDATORY Phase 12 cross-phase regression T-11)
- [ ] `src/main/import/__tests__/allPanelsFixture.test.ts` — NEW (17/17 SC #6 gate)

### Repository layer
- [ ] `src/main/db/repositories/masterPanelReagent.ts` — NEW
- [ ] `src/main/db/repositories/__tests__/masterPanelReagent.test.ts` — NEW
- [ ] `src/main/db/__tests__/migration.test.ts` — extend with 0007 forward-migration assertions
- [ ] `src/shared/types/masterPanelReagent.ts` — NEW (`MasterPanelReagent`, `MasterPanelReagentCreate`)
- [ ] `src/main/db/repositories/analyte.ts` — add `deleteByMasterPanelId(masterPanelId)`
- [ ] `src/main/db/repositories/panel.ts` — add `deleteByMasterPanelId(masterPanelId)` + extend `create()` to accept `masterPanelId`
- [ ] `src/main/db/repositories/masterPanel.ts` — add `findByPlatformSpeciesName`, `createWithMetadata`, `updateMetadata`, `deleteCascadeMasterPanelChildren`

### Legacy cleanup (SC #5)
- [ ] DELETE `templates/panel-template.csv` (in 13-06)
- [ ] DELETE `templates/sample-panel-import.csv` (in 13-06)

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Schema push to live SQLite via drizzle-kit | (schema) | `db:push` runs against a real SQLite file, not the test in-memory DB | `npm run db:push` after running `db:generate`; inspect emitted SQL; confirm `master_panel_reagents` table + UNIQUE indexes exist via `sqlite3` CLI |
| Pitfall F row-count preservation through the FK-change recreate-dance | (schema) | The recreate-dance must preserve drizzle's row-copy semantics against a populated dev DB; the in-memory migration test verifies the CONSTRAINT, not historical row preservation through the table-recreate itself (WARN-5 clarification) | Inside 13-03 Task 4: take a row-count snapshot of `runs` + `run_single_analytes` BEFORE running `npm run db:push`; take another row-count snapshot AFTER; diff must be zero. Backup via `cp` is the recovery path if drift is observed. |
| Windows build smoke (full import flow) | SMK3-08/11 | App is Windows-only for deployment; macOS dev cannot exercise the installed app | `npm run build:win` → download release artifact → install on Windows workstation → import `templates/panels/all-panels.xlsx` → verify per-sheet banner content + 17/17 panels in Manage page |

---

## Validation Sign-Off

- [x] All tasks have `<automated>` verify or Wave 0 dependencies (every row in the Per-Task Verification Map has a command or "manual" marker)
- [x] Sampling continuity: no 3 consecutive tasks without automated verify (only 13-03-T4 is manual; bracketed by automated tasks on both sides)
- [x] Wave 0 covers all MISSING references listed above
- [x] No watch-mode flags
- [x] Feedback latency < 20s (full suite, per RESEARCH §Validation Architecture)
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** pending /gsd-verify-work
