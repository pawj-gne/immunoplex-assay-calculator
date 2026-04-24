---
phase: 5
slug: master-panel-schema-repository-foundation
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-04-23
---

# Phase 5 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest (latest stable — Wave 0 installs) |
| **Config file** | `vitest.config.ts` at repo root (Wave 0 creates) |
| **Quick run command** | `npx vitest run src/main/db/repositories` |
| **Full suite command** | `npx vitest run` |
| **Estimated runtime** | ~5 s (in-memory `better-sqlite3`) |

---

## Sampling Rate

- **After every task commit:** Run `npx vitest run src/main/db/repositories`
- **After every plan wave:** Run `npx vitest run`
- **Before `/gsd-verify-work`:** Full suite must be green + `npm run typecheck` green
- **Max feedback latency:** 10 s

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| TBD-W0-01 | 01 | 0 | — | — | vitest devDep + config installed | bash | `node -e "require('vitest/package.json')"` | ❌ W0 | ⬜ pending |
| TBD-W0-02 | 01 | 0 | — | — | Shared in-memory DB fixture compiles | unit | `npx vitest run src/main/db/__tests__/testDb.spec.ts` | ❌ W0 | ⬜ pending |
| TBD-01-XX | 01 | 1 | MPAN-01 / SC #1 | — | Migration applies to v1 dev DB with no data loss; new table + nullable FK columns present | integration | `npx vitest run src/main/db/__tests__/migration.test.ts` | ❌ W0 | ⬜ pending |
| TBD-01-XX | 01 | 1 | MPAN-01 / SC #2 | — | Generated `0004_*.sql` contains composite `CREATE UNIQUE INDEX ... (platform_id, species_id)` | grep | `grep -E "CREATE UNIQUE INDEX.*master_panels_platform_species_uniq.*platform_id.*species_id" drizzle/migrations/0004_*.sql` | ❌ W0 | ⬜ pending |
| TBD-01-XX | 01 | 1 | MPAN-01 / SC #3 | — | Two `master_panels` rows with same `(platform_id, species_id)` → UNIQUE violation; case-differing platform/species *names* accepted | unit | `npx vitest run src/main/db/repositories/__tests__/masterPanel.test.ts` | ❌ W0 | ⬜ pending |
| TBD-02-XX | 02 | 2 | SC #4 (D-12) | — | `PRAGMA foreign_keys = ON` verified in client.ts; deleting a platform referenced by a master_panel raises FK violation (`onDelete: 'restrict'`) | unit | `npx vitest run src/main/db/__tests__/client.test.ts` | ❌ W0 | ⬜ pending |
| TBD-03-XX | 03 | 2 | MPAN-02 / SC #5 (Pitfall-1 gate) | — | `upsertByNameInMaster` UPDATEs an existing v1 row in place (case-insensitive name match) and sets `master_panel_id`; returns `action: 'adopted'` when existing row had `master_panel_id IS NULL`; `action: 'updated'` when set; `action: 'created'` on miss; `premix_conc` untouched on all UPDATE paths | unit | `npx vitest run src/main/db/repositories/__tests__/analyte.test.ts` | ❌ W0 | ⬜ pending |
| TBD-03-XX | 03 | 2 | SC #5 (master upsert) | — | `upsertByPlatformAndSpecies` creates on miss, updates on match, returns `{ id, action }` | unit | `npx vitest run src/main/db/repositories/__tests__/masterPanel.test.ts` | ❌ W0 | ⬜ pending |

*Per-task IDs (TBD-XX-YY) are placeholders — the planner replaces them with the actual task IDs it assigns, keeping the Requirement / Test Type / Command columns intact.*

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `package.json` — add `vitest` to `devDependencies` via `npm install --save-dev vitest`; add `"test": "vitest run"` script
- [ ] `vitest.config.ts` — root config: `{ test: { environment: 'node', globals: false, include: ['src/**/*.test.ts'] } }`
- [ ] `src/main/db/__tests__/testDb.ts` — shared fixture: new in-memory `better-sqlite3` Database, `pragma('foreign_keys = ON')`, run Drizzle migrations, seed a platform + species row, return `{ sqlite, db, seed }`
- [ ] `src/main/db/__tests__/client.test.ts` — SC #4 PRAGMA + FK enforcement
- [ ] `src/main/db/__tests__/migration.test.ts` — SC #1 applies 0004 to a v1-shaped dump without data loss
- [ ] `src/main/db/repositories/__tests__/masterPanel.test.ts` — SC #3 composite-unique; SC #5 master-panel `{ id, action }`
- [ ] `src/main/db/repositories/__tests__/analyte.test.ts` — SC #5 Pitfall-1 adoption gate (the critical test)

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Boot-time FK safety on real Windows dev DB | SC #4 side-effect | `PRAGMA foreign_keys = ON` may surface orphans in actual shipped DB that don't exist in the in-memory fixture (Pitfall 2 per RESEARCH.md §Runtime State Inventory) | On a Windows workstation, copy current dev `.sqlite` to `db-precheck.sqlite`, run `sqlite3 db-precheck.sqlite "PRAGMA foreign_key_check;"` — must return zero rows before merging Phase 5. If rows returned, file a follow-up phase before enabling the pragma in prod. |
| `drizzle-kit generate` emits composite UNIQUE INDEX | MPAN-01 / SC #2 | Confirms drizzle-kit 0.31.8 does not hit issue #3411 on this specific pattern | After running `npx drizzle-kit generate`, human inspects the emitted `drizzle/migrations/0004_*.sql` and confirms the grep command in the Per-Task table passes. If missing, fall back to a hand-authored supplementary migration file (leave `_journal.json` untouched). |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags (`vitest run`, not `vitest`)
- [ ] Feedback latency < 10 s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
