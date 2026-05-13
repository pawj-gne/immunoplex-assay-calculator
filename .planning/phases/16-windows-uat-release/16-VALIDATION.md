---
phase: 16
slug: windows-uat-release
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-05-13
---

# Phase 16 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.
> **Phase 16 is a release/UAT phase, not a feature phase.** Most validation surface is the operator-driven Windows UAT, not automated tests. Wave 0 is empty; sampling rate is sparse.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest 2.x (existing) |
| **Config file** | `vitest.config.ts` (existing) |
| **Quick run command** | `npm test -- --run` |
| **Full suite command** | `npm test -- --run && npm run typecheck` |
| **Estimated runtime** | ~3 seconds (full suite is fast — 439 tests, no slow integration deps) |

---

## Sampling Rate

- **After every task commit:** `npm test -- --run` (3s — no reason to skip)
- **After every plan wave:** Full suite (`npm test -- --run && npm run typecheck`)
- **Before `npm run build:win`:** Full suite must be green; `npm run typecheck` must exit 0
- **Before `gh release create`:** Operator UAT must be `## Overall: PASS` in `16-SMOKE-TEST-RETEST.md`
- **Max feedback latency:** 5 seconds (automated); 1–2 hours (manual UAT round-trip)

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 16-01-XX | 01 | 1 | (reconciliation — no req) | — | N/A | docs/lint | `npm run typecheck` (catches refactor breakage if reconciliation touches code) | ✅ existing | ⬜ pending |
| 16-02-XX | 02 | 2 | SC#1 (build:win) | — | unsigned-installer SmartScreen warning expected (D-16 carryover) | build | `npm run build:win` → assert `dist/immunoplex-assay-calculator-1.0.0-x64-setup.exe` exists | ✅ existing | ⬜ pending |
| 16-02-YY | 02 | 2 | SC#2/3/4 (Windows UAT) | — | operator validates SMK3-01..17 + D-15-08 + D-16-21 N/A | **manual** | `16-SMOKE-TEST-RETEST.md` Overall: PASS | TBD by planner | ⬜ pending |
| 16-03-XX | 03 | 3 | SC#5 (tag + release) | — | gh release on clean tree, no `worktree-agent-*` refs | gate | `git status -s` empty; `git branch | grep worktree-agent | wc -l` = 0 | N/A (live check) | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

*Planner fills the actual Task IDs and per-task `Automated Command` cells when PLAN.md is written.*

---

## Wave 0 Requirements

**None.** Phase 12-15.1 already shipped 439/439 green vitest tests + `npm run typecheck` exit 0; no new infrastructure to install.

*Existing infrastructure covers all phase requirements where automation applies.*

---

## Manual-Only Verifications

This phase's validation surface is **primarily manual** — operator-driven Windows UAT. Per CLAUDE.md §Testing, no runtime verification is possible on macOS dev machines.

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| `npm run build:win` produces `immunoplex-assay-calculator-1.0.0-x64-setup.exe` | Phase 16 SC #1 | electron-builder runs only against the actual electron build pipeline; cannot dry-run | `npm run build:win` from macOS dev machine (cross-build OK for x64 Windows target); inspect `dist/` for the .exe |
| Installer deploys cleanly on Windows | Phase 16 SC #2 | Windows-only installer behavior; SmartScreen unsigned-installer warning expected | Copy .exe to lab PC; run installer; "Run anyway" past SmartScreen; verify app launches |
| Operator imports `templates/panels/all-panels.xlsx`, all 17 sheets load (16 panels + Table) | Phase 16 SC #3 + SMK3-10 | Real-file parser exercise on real Windows file path | `16-SMOKE-TEST-GUIDE.md` Section A Step 2 |
| Operator walks full Smoke 3 run end-to-end with calc output matching hand calc | Phase 16 SC #4 + SMK3-01..09, SMK3-12, SMK3-15 | Physical-hardware UI + form interaction + visual diff against `16-HAND-CALC.md` | `16-SMOKE-TEST-GUIDE.md` Section A Steps 3–10 + Section B per-row |
| Save-with-override round-trip — amber OVERRIDE badge visible on reopen | D-15-08 (Phase 15.1 HUMAN-UAT carryover items 1–2) | Real React render + Windows user-event ordering | `16-SMOKE-TEST-GUIDE.md` Section B `D-15-08` row |
| 6 derived audit-trail rows display real "X.X mL" values on smoke3 run | SMK3-15 (Phase 15.1 HUMAN-UAT item 3) | Visual DOM diff on real Windows | `16-SMOKE-TEST-GUIDE.md` Section A Step 9 + Section B SMK3-15 row |
| Historical-run banner on legacy run | SMK3-16 (Phase 15.1 HUMAN-UAT item 4) | **N/A per D-16-21** — code-verified only (Phase 15 Group H); not user-observable without DB surgery | Section B SMK3-16 row marked `N/A — code-verified, deferred to future maintenance phase` |
| End-to-end IPC-failure recovery — corrupted master panel → save degrades to legacy | SMK3-16 + Phase 15.1 HUMAN-UAT item 4 secondary | Requires inducing IPC failure on running app | Section B optional ad-hoc test, or `N/A — code-verified` (planner's call) |
| Tag `v1.0.0` on clean repo (no `worktree-agent-*` refs); `gh release create v1.0.0` succeeds | Phase 16 SC #5 + D-16-23 | gh CLI release publishes to GitHub; not dry-runnable | Wave 3 final task; verify on github.com |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies — **N/A: most tasks are manual UAT; flagged in Per-Task Verification Map above**
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify — **applies only to code-writing tasks in Wave 1/3; UAT-only tasks in Wave 2 are exempt**
- [ ] Wave 0 covers all MISSING references — N/A (no Wave 0 needed)
- [ ] No watch-mode flags — confirmed (`npm test -- --run` is non-watch)
- [ ] Feedback latency < 5s (automated) and < 2h (manual UAT round-trip)
- [ ] `nyquist_compliant: true` set in frontmatter — pending planner sign-off after PLAN.md written

**Approval:** pending — planner reviews this VALIDATION.md against PLAN.md task list and toggles `nyquist_compliant` to `true` once every code-writing task has an automated command in the Per-Task map.
