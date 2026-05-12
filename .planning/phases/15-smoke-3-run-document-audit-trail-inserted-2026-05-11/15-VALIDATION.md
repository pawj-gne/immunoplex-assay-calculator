---
phase: 15
slug: smoke-3-run-document-audit-trail-inserted-2026-05-11
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-05-12
---

# Phase 15 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest 1.x (Node environment only — no jsdom; renderer `.tsx` excluded) |
| **Config file** | `vitest.config.ts` (root) |
| **Quick run command** | `npm test -- --run <pattern>` |
| **Full suite command** | `npm test -- --run` |
| **Estimated runtime** | ~30 seconds (full suite) |

> **Note:** Per RESEARCH.md §4, Vitest config is `environment: 'node'` and `include: ['src/**/*.test.ts']` — `.tsx` files are excluded. True audit-trail render coverage is therefore manual-UAT in Phase 16, following the Phase 14 precedent. Pure helper logic (PE volume math, diluent branch label derivation) is extracted to `.ts` modules so it can be unit-tested in this phase.

---

## Sampling Rate

- **After every task commit:** Run `npm test -- --run <task-scope>` (e.g. `npm test -- --run db/__tests__/migration` after schema work)
- **After every plan wave:** Run `npm test -- --run` (full suite)
- **Before `/gsd-verify-work`:** Full suite must be green AND `npm run typecheck` must pass AND `npm run build` must succeed (Phase 16 needs `npm run build:win` artifact)
- **Max feedback latency:** ~60 seconds (typecheck + targeted vitest)

---

## Per-Task Verification Map

> Task IDs are placeholders — planner fills in once PLAN.md files are written. Each row maps a task to the test that proves its acceptance criterion. Manual-UAT rows route to Phase 16 (no inline verify).

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 15-01-01 | 01 | 1 | SMK3-16 | — | Schema delta — 10 new nullable columns on `runs` | unit (column-presence) | `npm test -- --run src/main/db/__tests__/migration.test.ts` | ❌ W0 (extends existing) | ⬜ pending |
| 15-01-02 | 01 | 1 | SMK3-16 | — | RunRecord/RunCreate types include the 10 new optional fields | typecheck | `npm run typecheck` | ✅ | ⬜ pending |
| 15-01-03 | 01 | 1 | SMK3-16 | — | runRepository.create/update round-trips the 10 new fields | unit (round-trip) | `npm test -- --run src/main/db/__tests__/run.test.ts` | ❌ W0 (extends existing) | ⬜ pending |
| 15-02-01 | 02 | 1 | SMK3-16 | — | New IPC channel `MASTER_PANEL_GET_WITH_REAGENTS` returns master_panel + per-reagent rows in one call | unit (handler) | `npm test -- --run src/main/ipc` | ✅ / ❌ W0 | ⬜ pending |
| 15-02-02 | 02 | 1 | SMK3-16 | — | preload bridge exposes the new channel; renderer-side typing matches | typecheck | `npm run typecheck` | ✅ | ⬜ pending |
| 15-03-01 | 03 | 2 | SMK3-12, SMK3-15, SMK3-16, SMK3-17 | — | `buildRunSnapshot` is async and populates the 10 new fields from selectionStore + IPC fetch | unit (snapshot) | `npm test -- --run src/renderer/src/features/run/hooks/__tests__/useRunSnapshot.test.ts` (NEW) | ❌ W0 | ⬜ pending |
| 15-04-01 | 04 | 2 | SMK3-15, SMK3-17 | — | Audit trail UI renders Inputs / Intermediates / Outputs / Diluent decision blocks (manual UAT) | manual | (Phase 16 UAT Section A Step 8 + Section B SMK3-15) | n/a | ⬜ pending |
| 15-04-02 | 04 | 2 | SMK3-12 | — | SAPE Name row renders in FinalizedRunHeader (manual UAT) | manual | (Phase 16 UAT Section B SMK3-12) | n/a | ⬜ pending |
| 15-04-03 | 04 | 2 | SMK3-16 | — | Pre-Phase-15 advisory banner renders when `calculationRulesVersion !== 'smoke3'` (manual UAT) | manual | (Phase 16 UAT Section A Step 8 reopen-and-verify) | n/a | ⬜ pending |
| 15-04-04 | 04 | 2 | SMK3-15 | — | Pure helpers: PE volume formula + diluent branch label derivation extracted to `.ts` modules | unit (helpers) | `npm test -- --run src/renderer/src/features/run/lib/__tests__/auditTrail.test.ts` (NEW) | ❌ W0 | ⬜ pending |
| 15-05-01 | 05 | 3 | SMK3-17 | — | Group M added to calculator integration tests — 7 PE volume edge cases (typical 1×, 0.5×, 2×, null, 0, undefined, ceiling-after-division) | unit (math) | `npm test -- --run src/renderer/src/lib/__tests__/calculator.integration.test.ts` | ✅ (extend) | ⬜ pending |
| 15-05-02 | 05 | 3 | SMK3-12, SMK3-15, SMK3-16, SMK3-17 | — | Full suite green + typecheck + `npm run build` succeeds (Windows build artifact precondition for Phase 16) | gate | `npm test -- --run && npm run typecheck && npm run build` | ✅ | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

> Wave 0 = test scaffolding that must exist before the test rows above can pass.

- [ ] `src/renderer/src/features/run/hooks/__tests__/useRunSnapshot.test.ts` — NEW: stubs for snapshot fixture-based assertions (10 new fields populated)
- [ ] `src/renderer/src/features/run/lib/auditTrail.ts` — NEW: pure helpers (`computePeVolume`, `deriveDiluentBranchLabel`) extracted from the audit-trail render
- [ ] `src/renderer/src/features/run/lib/__tests__/auditTrail.test.ts` — NEW: covers the 7 PE volume edge cases + 3 diluent branch cases from CONTEXT.md `<specifics>`
- [ ] (No new test framework needed — Vitest is already installed; no jsdom needed because no `.tsx` render tests are added)

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Audit trail renders Inputs / Intermediates / Outputs / Diluent decision blocks with the worked example values from CONTEXT.md `<specifics>` | SMK3-15 | Vitest is Node-only — no jsdom in this project; .tsx render tests excluded by config. Phase 14 precedent routes visual confirmation to Phase 16 UAT. | Phase 16 UAT Section A Step 8 (reopen-and-verify-snapshot) + Section B SMK3-15 row — operator opens a Phase 15 Smoke 3 run and visually checks every line of the worked-example audit trail |
| SAPE Name row appears in FinalizedRunHeader metadata grid | SMK3-12 | Same — .tsx render tests excluded | Phase 16 UAT Section B SMK3-12 row — operator opens a Phase 15 Smoke 3 run and confirms the SAPE Name row reads the panel's Values-block SAPE name |
| Pre-Phase-15 advisory banner renders above audit trail when reopening a run saved before Phase 15 ships | SMK3-16 | Same — .tsx render tests excluded | Phase 16 UAT Section A Step 8 — operator opens a v1.0/v1.1 run from before Phase 15 and confirms the amber banner reads "This run was saved under previous calculation rules. Values displayed as recorded — no recompute on reopen." with em-dash placeholders in the audit trail's value cells |
| `[OVERRIDE]` chip renders inline under Old Beads / Old Antibodies in the Inputs block when `oldBeadsOverride`/`oldAntibodiesOverride` is true | SMK3-15 (deferred from Phase 14) | Same — .tsx render tests excluded | Phase 16 UAT Section B — operator triggers a 20%-cap override at save time, reopens the run, confirms the amber `[OVERRIDE]` chip + tooltip text |
| PE volume row in Outputs block shows the ceiling-rounded `finalVolume / sapeConcentration` value | SMK3-17 | Visual cross-check between rendered audit trail and unit-tested helper output | Phase 16 UAT Section B SMK3-17 row — operator confirms PE volume cell matches the Group M unit-test expectations against the Thermofisher Human Panel I fixture |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies, OR are explicitly listed in the Manual-Only Verifications table with a Phase 16 UAT routing
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify (Plan 04 has manual-only renderer rows — pure-helper tests in 15-04-04 satisfy the sampling rule for Plan 04)
- [ ] Wave 0 covers all MISSING references (`useRunSnapshot.test.ts`, `auditTrail.ts`, `auditTrail.test.ts`)
- [ ] No watch-mode flags (`--run` is mandatory in every command above)
- [ ] Feedback latency < 60s (targeted vitest + typecheck stays under the bar)
- [ ] `nyquist_compliant: true` set in frontmatter (planner sets after task IDs are finalized)

**Approval:** pending
