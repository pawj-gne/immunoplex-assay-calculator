---
phase: 16
slug: windows-uat-release
status: approved
nyquist_compliant: true
wave_0_complete: false
created: 2026-05-13
approved: 2026-05-13
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
| 16-01-T1 | 01 | 1 | D-16-01/03/19/20 (reconciliation) | T-16-01-01 | docs-only edit; no secrets in CHANGELOG | docs/grep | `grep -c 'milestone: v1.0' .planning/STATE.md && grep -c 'Current Milestone: v1.0 Release' .planning/PROJECT.md && grep -c 'tag \*\*v1.0.0\*\*' .planning/ROADMAP.md` | ✅ existing | ⬜ pending |
| 16-01-T2 | 01 | 1 | D-16-10/11/12/13 (CHANGELOG) | T-16-01-01 | plain-language audience; no SMK3/D-XX codes in body | docs/grep | `test -f CHANGELOG.md && grep -c '## \[1.0.0\] - 2026-05-12' CHANGELOG.md && [ $(grep -c 'SMK3-' CHANGELOG.md) -eq 0 ]` | ✅ created | ⬜ pending |
| 16-01-T3 | 01 | 1 | D-16-05/06/07/08/09/14/15/21 (UAT script + hand-calc) | T-16-01-02 | matrix audit trail; SMK3-16 N/A verbatim | docs/grep | `test -f .planning/phases/16-windows-uat-release/16-SMOKE-TEST-GUIDE.md && grep -cE 'SMK3-(0[1-9]\|1[0-7])' file ≥ 17 && grep -c 'N/A — historical-run banner is code-verified' file = 1` | ✅ created | ⬜ pending |
| 16-02-T1 | 02 | 2 | D-16-01 (version bump); D-16-16 (Phase 15.1 precondition) | — | pre-flight gate verifies Phase 15.1 [x] | config/grep | `grep -c '"version": "1.0.0"' package.json && grep -cE '^- \[x\] 15\.1-0[1-3]-PLAN\.md' .planning/ROADMAP.md == 3` | ✅ existing | ⬜ pending |
| 16-02-T2 | 02 | 2 | PHASE-16-SC-1; D-16-02/03 (electron-builder + build:win) | T-16-02-02 | x64-only build; no arm64 sneak-in | build | `grep -c '${name}-${version}-${arch}-setup' electron-builder.yml && npm run build:win && test -f dist/immunoplex-assay-calculator-1.0.0-x64-setup.exe && [ ! -f dist/immunoplex-assay-calculator-1.0.0-arm64-setup.exe ]` | dist/* created | ⬜ pending |
| 16-02-T3 | 02 | 2 | PHASE-16-SC-2/3/4 + all SMK3-* visual rows + D-15-08 (Windows UAT) | T-16-02-01/04/05 | operator validates SMK3-01..17 + D-15-08; SMK3-16 = N/A per D-16-21 | **manual** | MISSING — `16-SMOKE-TEST-RETEST.md` `## Overall: PASS` is the only acceptance signal (CLAUDE.md §Testing Windows-only — exempt from sampling-continuity rule per VALIDATION sign-off note) | ✅ created (operator-authored) | ⬜ pending |
| 16-03-T1 | 03 | 3 | D-16-23 (pre-tag cleanup); RETEST PASS gate | T-16-03-06 | safe-delete merged only; unmerged listed | gate/grep | `grep -c '^## Overall: PASS' .planning/phases/16-windows-uat-release/16-SMOKE-TEST-RETEST.md && grep -c '^.claude/worktrees/' .gitignore && [ $(git branch --merged dev/v1-01 \| grep -c worktree-agent) -eq 0 ]` | ✅ existing | ⬜ pending |
| 16-03-T2 | 03 | 3 | PHASE-16-SC-5; D-16-01/13 (tag + GitHub Release) | T-16-03-01/02/03/04 | gh auth pre-check; CHANGELOG verbatim body | gate/api | `git tag -l v1.0.0 \| grep -c v1.0.0 && gh release view v1.0.0 --json tagName --jq '.tagName' \| grep -c v1.0.0 && gh release view v1.0.0 --json assets --jq '.assets[].name' \| grep -c 'immunoplex-assay-calculator-1.0.0-x64-setup.exe'` | live tag + release | ⬜ pending |
| 16-03-T3 | 03 | 3 | D-16-19/20 (closeout commit pair) | T-16-03-05 | two-commit pair per 16-PATTERNS touch point #9 | docs/grep | `grep -c '^milestone: v1.1' .planning/STATE.md && grep -c 'Current Milestone: v1.0 Released' .planning/PROJECT.md && git log --oneline -2 \| grep -c 'docs(phase-16)' == 2` | ✅ existing | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

**Approval note (planner sign-off 2026-05-13):** Every code-writing task (16-01-T1/T2/T3, 16-02-T1/T2, 16-03-T1/T2/T3) has an automated `<verify>` command in its PLAN.md task block. The single MISSING is 16-02-T3 (Windows UAT) — explicitly exempt from the Nyquist sampling-continuity rule per the VALIDATION sign-off note ("manual UAT rows in Wave 2 are exempt"). `nyquist_compliant: true` toggled.

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
| Operator imports `templates/panels/all-panels.xlsx`, all 17 sheets load (16 panels + Table) | Phase 16 SC #3 + SMK3-10 | Real-file parser exercise on real Windows file path | `16-SMOKE-TEST-GUIDE.md` Section A Step 3 |
| Operator walks full Smoke 3 run end-to-end with calc output matching hand calc | Phase 16 SC #4 + SMK3-01..09, SMK3-12, SMK3-15 | Physical-hardware UI + form interaction + visual diff against `16-HAND-CALC.md` | `16-SMOKE-TEST-GUIDE.md` Section A Steps 4–15 + Section B per-row |
| Save-with-override round-trip — amber OVERRIDE badge visible on reopen | D-15-08 (Phase 15.1 HUMAN-UAT carryover items 1–2) | Real React render + Windows user-event ordering | `16-SMOKE-TEST-GUIDE.md` Section B `D-15-08` row + Section A Step 13 |
| 6 derived audit-trail rows display real "X.X mL" values on smoke3 run | SMK3-15 (Phase 15.1 HUMAN-UAT item 3 / WR-06) | Visual DOM diff on real Windows | `16-SMOKE-TEST-GUIDE.md` Section A Step 11 + Section B SMK3-15 row |
| Historical-run banner on legacy run | SMK3-16 (Phase 15.1 HUMAN-UAT item 4) | **N/A per D-16-21** — code-verified only (Phase 15 Group H); not user-observable without DB surgery | Section B SMK3-16 row marked `N/A — code-verified, deferred to future maintenance phase` |
| End-to-end IPC-failure recovery — corrupted master panel → save degrades to legacy | SMK3-16 + Phase 15.1 HUMAN-UAT item 4 secondary | Requires inducing IPC failure on running app | `N/A — code-verified` per D-16-21 (rolls into SMK3-16 row) |
| Tag `v1.0.0` on clean repo (no `worktree-agent-*` refs); `gh release create v1.0.0` succeeds | Phase 16 SC #5 + D-16-23 | gh CLI release publishes to GitHub; not dry-runnable | Wave 3 Task 2; verify on github.com |

---

## Validation Sign-Off

- [x] All tasks have `<automated>` verify or Wave 0 dependencies — **manual UAT row (16-02-T3) flagged in Per-Task Verification Map; all other tasks have grep/build/api automated commands**
- [x] Sampling continuity: no 3 consecutive tasks without automated verify — **applies only to code-writing tasks in Wave 1/3; UAT-only task in Wave 2 (16-02-T3) is exempt**
- [x] Wave 0 covers all MISSING references — N/A (no Wave 0 needed)
- [x] No watch-mode flags — confirmed (`npm test -- --run` is non-watch)
- [x] Feedback latency < 5s (automated) and < 2h (manual UAT round-trip)
- [x] `nyquist_compliant: true` set in frontmatter — planner sign-off 2026-05-13 after PLAN.md tasks audited against Per-Task Verification Map

**Approval:** approved 2026-05-13 — planner reviewed VALIDATION.md against PLAN.md (16-01-PLAN.md / 16-02-PLAN.md / 16-03-PLAN.md) task list. Every code-writing task has an automated `<verify>` command in its task block. The single manual UAT task (16-02-T3 Windows UAT) is explicitly exempt per the Nyquist sampling-continuity rule note above and is flagged as `manual` test type in the Per-Task map.
