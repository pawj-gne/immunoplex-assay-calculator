---
phase: 13
slug: smoke-3-panel-xlsx-parser-v3
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-05-12
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

> Populated by the planner. Each task row links Task ID → Plan/Wave → Requirement → Test Command. Status updated during execution.

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| TBD-by-planner | — | — | — | — | — | — | — | — | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

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
| SMK3-DIL-01 | Diluent stored verbatim (open-text, no normalization) | Integration | `npm test -- importer.test.ts -t "diluent verbatim"` | ❌ Wave 0 |
| (schema) | `master_panel_reagents` CHECK constraints (reagent_kind enum; SAPE conc NOT NULL) | Repository | `npm test -- masterPanelReagent.test.ts` | ❌ Wave 0 |
| (schema) | Composite UNIQUE on `(platform_id, species_id, name)` (D-14) | Repository | `npm test -- masterPanel.test.ts -t "composite UNIQUE"` | Partial — extend existing |
| (schema) | Migration 0007 applies cleanly + schema artifacts exist + row counts preserved through table-recreate dance | Migration | `npm test -- migration.test.ts -t "0007"` | Partial — extend existing |
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
- [ ] `src/main/import/__tests__/importer.test.ts` — NEW (transaction; wholesale-replace; FK SET NULL; rollback)
- [ ] `src/main/import/__tests__/allPanelsFixture.test.ts` — NEW (17/17 SC #6 gate)

### Repository layer
- [ ] `src/main/db/repositories/masterPanelReagent.ts` — NEW
- [ ] `src/main/db/repositories/__tests__/masterPanelReagent.test.ts` — NEW
- [ ] `src/main/db/__tests__/migration.test.ts` — extend with 0007 forward-migration assertions
- [ ] `src/shared/types/masterPanelReagent.ts` — NEW (`MasterPanelReagent`, `MasterPanelReagentCreate`)
- [ ] `src/main/db/repositories/analyte.ts` — add `deleteByMasterPanelId(masterPanelId)`
- [ ] `src/main/db/repositories/panel.ts` — add `deleteByMasterPanelId(masterPanelId)` + `setMasterPanelId(panelId, masterPanelId)`
- [ ] `src/main/db/repositories/masterPanel.ts` — add `findByPlatformSpeciesName`, `createWithMetadata`, `updateMetadata`, `deleteCascadeMasterPanelChildren`

### Legacy cleanup (SC #5)
- [ ] DELETE `templates/panel-template.csv`
- [ ] DELETE `templates/sample-panel-import.csv`

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Schema push to live SQLite via drizzle-kit | (schema) | `db:push` runs against a real SQLite file, not the test in-memory DB | `npm run db:push` after running `db:generate`; inspect emitted SQL; confirm `master_panel_reagents` table + UNIQUE indexes exist via `sqlite3` CLI |
| Windows build smoke (full import flow) | SMK3-08/11 | App is Windows-only for deployment; macOS dev cannot exercise the installed app | `npm run build:win` → download release artifact → install on Windows workstation → import `templates/panels/all-panels.xlsx` → verify per-sheet banner content + 17/17 panels in Manage page |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references listed above
- [ ] No watch-mode flags
- [ ] Feedback latency < 20s (full suite)
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
