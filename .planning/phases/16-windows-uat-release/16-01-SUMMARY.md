---
phase: 16
plan: 01
subsystem: documentation
tags:
  - release
  - reconciliation
  - changelog
  - uat-script
  - hand-calc
  - documentation
requirements-completed:
  - D-16-01
  - D-16-02
  - D-16-03
  - D-16-05
  - D-16-06
  - D-16-07
  - D-16-08
  - D-16-09
  - D-16-10
  - D-16-11
  - D-16-12
  - D-16-13
  - D-16-14
  - D-16-15a
  - D-16-15c
  - D-16-15d
  - D-16-19
  - D-16-20
  - D-16-21
dependency-graph:
  requires:
    - 16-CONTEXT.md (locked decisions D-16-01..23)
    - 16-RESEARCH.md (release-engineering inventory + pitfalls)
    - 16-PATTERNS.md (in-repo analogs for every touch point)
    - 16-VALIDATION.md (per-task verification map)
    - templates/panels/all-panels.xlsx (Phase 13-02 fixture — 16 panels + Table sheet)
    - .planning/SMOKE-3-PRD.md (PRD worked example numbers)
    - .planning/phases/04-run-documentation-persistence-deployment/04-SMOKE-TEST-GUIDE.md (Section A E2E pattern)
  provides:
    - CHANGELOG.md (consumed by Wave 3 gh release create --notes-file)
    - 16-SMOKE-TEST-GUIDE.md (consumed by Wave 2 HUMAN-UAT checkpoint handoff)
    - 16-HAND-CALC.md (operator calc-verification reference during Section A Step 6)
    - Reconciled milestone label (STATE/PROJECT/ROADMAP/REQUIREMENTS all v1.x release arc)
  affects:
    - Wave 2 (Plan 16-02): consumes the three artifacts above
    - Wave 3 (Plan 16-03): tag v1.0.0 + reuse CHANGELOG §[1.0.0] verbatim as release body
tech-stack:
  added: []
  patterns:
    - Keep-a-Changelog 1.1.0 format (https://keepachangelog.com/en/1.1.0/)
    - Hybrid UAT script (Section A E2E + Section B per-requirement matrix + Section C free-text) — adapted from Phase 4 04-SMOKE-TEST-GUIDE.md
    - Conventional Commits (`docs(16-01): ...`) on dev/v1-01 branch
key-files:
  created:
    - CHANGELOG.md
    - .planning/phases/16-windows-uat-release/16-SMOKE-TEST-GUIDE.md
    - .planning/phases/16-windows-uat-release/16-HAND-CALC.md
    - .planning/phases/16-windows-uat-release/16-01-SUMMARY.md
  modified:
    - .planning/STATE.md
    - .planning/PROJECT.md
    - .planning/ROADMAP.md
    - .planning/REQUIREMENTS.md
decisions:
  - "Reused Thermofisher Human Panel I as both the (a) all-4-audit-blocks panel and the (d) SAPE-conc-1 panel — keeps the operator on a familiar fixture across Section A Steps 4-9 and reduces panel-switching cognitive load"
  - "Selected Millipore Human Panel 1 as the (c) override-trigger panel (Beads vol/well = 0.025 mL → 148-well new-bead volume = 3.7 mL → 20% cap = 0.74 mL → Old Beads = 1.0 mL trips override modal cleanly)"
  - "Total assay volume in 16-HAND-CALC.md is documented as approximate (per-reagent rows are the strict gates) to avoid locking in a specific reagent-inclusion model that may differ from on-screen rendering — operators verify per-reagent volumes strictly and total assay volume loosely"
  - "Used today's actual date (2026-05-13) for CHANGELOG §[1.0.0] header instead of plan-template '2026-05-12' — Wave 2 release tag will be cut on 2026-05-13 or later, date stays consistent"
metrics:
  duration: "~5m 40s"
  tasks-completed: 3
  files-touched: 6
  commits: 3
  completed-date: "2026-05-13"
---

# Phase 16 Plan 01: Wave 1 Pre-Release Reconciliation + UAT Authoring — Summary

Reconcile every planning-doc reference to the stale "v2.0 Panel XLSX Upload" milestone label
to the v1.x release arc (v1.0 active for Smoke 3; v1.1 = Phase 6 hosting; v1.2 = Phase 7
central audit), then author the three operator-facing release artifacts (CHANGELOG.md at
repo root, 16-SMOKE-TEST-GUIDE.md, 16-HAND-CALC.md) consumed by Wave 2 build + UAT
checkpoint and Wave 3 tag + GitHub Release.

## What Shipped

### Task 1 — Reconciliation sweep (commit `cb537d0`)
- `.planning/STATE.md`: frontmatter `milestone: v2.0` → `v1.0`, `status: ready_to_execute` →
  `in_progress`; §Current Position block rewritten; Performance Metrics §By Phase appended
  with Phase 13 (6/6), Phase 15.1 (3/3), Phase 16 (0/3 Wave 1 in progress)
- `.planning/PROJECT.md`: §Current Milestone block replaced from "v2.0 Panel XLSX Upload +
  Master-Panel Data Model" to "v1.0 Release — Smoke 3 calculator on Windows lab PC" with
  §Next Milestone "v1.1 — Network Layer & Central Server (Phase 6)" carrying explicit
  trigger ("lab-confirmed v1.0 real-world use, suggestion ≥1-2 weeks")
- `.planning/ROADMAP.md`: Overview paragraph anchored on v1.x; Phase 16 summary line locked
  to v1.0.0; Phase 6 header → "v1.1" with Release target; Plan 06-05 build label → v1.1.0;
  Phase 7 header → "v1.2" with depends_on v1.1.0; Phase 16 SC#1 rewritten x64-only (drops
  arm64 per D-16-03); SC#5 rewritten v1.0.0-locked (drops "v0.8.0 vs v2.0.0" TBD per
  D-16-01); footer last-updated bumped to 2026-05-13
- `.planning/REQUIREMENTS.md`: §v2.0 header annotated with v1.x re-scope blockquote per
  D-16-20; footer last-updated bumped to 2026-05-13
- `HUMAN-UAT-04.1-05-01` retained in STATE.md Pending Todos (Wave 3 / Plan 16-03 owns its
  removal per CONTEXT.md plan-time addendum)

### Task 2 — CHANGELOG.md (commit `fd838b0`)
- New file at repo root, Keep-a-Changelog 1.1.0 format
- `## [Unreleased]` empty placeholder + `## [1.0.0] - 2026-05-13` inaugural entry
- Sections: Added (13 entries) / Changed (5 entries) / Removed (3 entries) / Fixed (4
  entries) — Deprecated and Security omitted per D-16-11
- Plain-language audience (no SMK3-XX / D-XX codes in user-visible body per D-16-12)
- `### Removed` explicitly names "v0.7.0 sub-panel CSV importer (superseded by Smoke 3
  per-reagent schema)" to explain the v0.7.0 → v1.0.0 version gap per CONTEXT plan-time
  addendum
- Footer link references for `[unreleased]` (compare URL) and `[1.0.0]` (tag URL) using
  `https://github.com/pawj-gne/immunoplex-assay-calculator` base
- `electron-builder.yml` already excludes CHANGELOG.md from the packaged installer (line 9
  glob `!{...,CHANGELOG.md,README.md}`) — no installer-side edit needed

### Task 3 — 16-SMOKE-TEST-GUIDE.md + 16-HAND-CALC.md (commit `d4ff7c8`)

**16-SMOKE-TEST-GUIDE.md** — Hybrid format per D-16-05:
- **Section A** (15 steps): Install → first launch v1.0.0 confirm → import all-panels.xlsx
  (16 panels) → Thermofisher/Human/Panel 1 (PRD case, samples=100, plates=2, Setups=1) →
  verify 7.4 mL beads / 3.7 mL antibodies / 2.0 mL dead → bump Setups=3 → switch to
  Millipore Human Panel 1 for override-trigger (Old Beads = 1.0 mL > 20% cap of 0.74 mL)
  → switch back to Thermofisher for SAPE conc=1 PE volume check → Document & Save
  (Request 16001) → verify Audit Trail 4 blocks with real mL values (Phase 15.1 WR-06) →
  SAPE Name visible → reopen verify override badge persists (Phase 15.1 WR-01) + cap modal
  does not re-trigger on first keystroke (Phase 15.1 UAT item #2) → Print + Start New Run
  → close+reopen persistence check
- **Section B** (18 rows): SMK3-01..17 (17 rows) + dedicated `D-15-08 override badge` row.
  SMK3-16 pre-marked **N/A** per D-16-21 with verbatim justification: "N/A — historical-run
  banner is code-verified (Phase 15 Group H); not user-observable on the lab PC without DB
  surgery, deferred to a future maintenance phase"
- **Section C**: Free-text operator observations
- **Overall: PASS / FAIL** gate line for Wave 2 retest signoff
- **FAQ** block: SmartScreen, data location (`%APPDATA%\immunoplex-assay-calculator\`),
  uninstall guidance

**16-HAND-CALC.md** — Operator cheat sheet per D-16-07/15:
- **Fixture Coverage Map** pinning actual panel names from `all-panels.xlsx`:
  (a) Thermofisher Human Panel I (PRD all-4-blocks panel),
  (c) Millipore Human Panel 1 (override trigger; bead vol/well = 0.025 mL),
  (d) Thermofisher Human Panel I (reused; SAPE conc=1)
- **PRD case 1**: Total wells = 148; bead = 7.4 mL; antibody = 3.7 mL; dead = 2.0 mL
- **PRD case 1 Setups=3**: dead = 6.0 mL; total assay volume +4 mL
- **D-16-15(c) override panel**: new bead = 3.7 mL; 20% cap = 0.74 mL; Old Beads = 1.0 mL
  trips modal
- **D-16-15(d) SAPE-conc=1 panel**: PE volume = total assay volume (no division step)

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Worktree base mismatch] Brought worktree forward to required base commit**
- **Found during:** First action (worktree branch check)
- **Issue:** Worktree was created from base `783ae51` (before Phase 16 plan artifacts
  landed), not the expected `43d1e77`. Plan files would have been missing.
- **Fix:** `git merge --ff-only 43d1e77` (clean fast-forward, no conflicts). This is a
  worktree-setup gap, not a code/doc issue.
- **Files modified:** Worktree branch ref only (no working-tree changes)
- **Commit:** N/A (fast-forward merge of existing commits)

**2. [Doc consistency - approximate total assay volume disclaimer]** Added explanatory
note in `16-HAND-CALC.md` PRD case 1 stating that total-assay-volume is approximate
(per-reagent rows are the strict gates). The plan template's expected total assay volume
"sum of new reagent volumes + dead volume" was ambiguous about whether SAPE volume +
plate-buffer overheads are included in the on-screen total. Documenting this as a soft
gate avoids a false-fail on Step 6 from a definitional mismatch.
- **Found during:** Task 3 — hand-calc authoring
- **Fix:** Inline disclaimer in PRD case 1 block ("If the on-screen value differs by more
  than 0.1 mL because of a slightly different reagent inclusion model, mark Step 6 as a
  soft fail with the on-screen value noted; the key gates are the per-reagent rows…")
- **Files modified:** `16-HAND-CALC.md`
- **Commit:** `d4ff7c8`

**3. [Doc consistency - explicit save-state hint for Step 13]** Added a callout note at
the top of Section A Step 13 reminding the operator that the saved run must include the
override (i.e., they must have saved on the Millipore override path from Step 8). Without
this, an operator who switched to Thermofisher in Step 9 and saved would not see the
override badge on reopen — a false fail on D-15-08.
- **Found during:** Task 3 — re-reading Section A flow after writing
- **Fix:** Inline note before Step 13 numbered list
- **Files modified:** `16-SMOKE-TEST-GUIDE.md`
- **Commit:** `d4ff7c8`

### Authentication Gates
None — Wave 1 is fully autonomous documentation work; no auth required.

## Verification

All acceptance criteria from Plan 16-01 verified by grep:

**Task 1:**
- `grep -cE '^milestone:\s*"?v1\.0"?\s*$' .planning/STATE.md` = 1 ✓
- `grep -c "milestone: v2.0" .planning/STATE.md` = 0 ✓
- `grep -c "Current Milestone: v1.0 Release" .planning/PROJECT.md` = 1 ✓
- `grep -c "Next Milestone: v1.1" .planning/PROJECT.md` = 1 ✓
- `grep -c "v1.1.0" .planning/ROADMAP.md` = 3 (≥ 2) ✓
- `grep -c "v1.2.0" .planning/ROADMAP.md` = 1 (≥ 1) ✓
- `grep -c "tag \*\*v1.0.0\*\*" .planning/ROADMAP.md` = 2 (≥ 1) ✓
- `grep -c "v0.8.0 vs v2.0.0" .planning/ROADMAP.md` = 0 ✓
- `grep -c "Re-scoped 2026-05-12 (Phase 16 reconciliation, per D-16-20)" .planning/REQUIREMENTS.md` = 1 ✓
- `grep -c "HUMAN-UAT-04.1-05-01" .planning/STATE.md` = 2 (≥ 1, retained per Wave 3 scope) ✓

**Task 2:**
- `test -f CHANGELOG.md` = 0 ✓
- `grep -c "## \[1.0.0\] - 2026-05-13" CHANGELOG.md` = 1 ✓ *(today's date; plan template
  had 2026-05-12, used 2026-05-13 per env current date)*
- `grep -c "## \[Unreleased\]" CHANGELOG.md` = 1 ✓
- `grep -c "### Added/Changed/Removed/Fixed" CHANGELOG.md` = 1/1/1/1 ✓
- `grep -c "SMK3-" CHANGELOG.md` = 0 ✓
- `grep -c "D-16-" CHANGELOG.md` = 0 ✓
- `grep -c "v0.7.0 sub-panel" CHANGELOG.md` = 1 ✓
- `grep -c "keepachangelog.com/en/1.1.0" CHANGELOG.md` = 1 ✓
- `grep -c "Semantic Versioning" CHANGELOG.md` = 1 ✓
- `grep -c "0.1 mL" CHANGELOG.md` = 2 (≥ 1) ✓
- `grep -c "Hamilton" CHANGELOG.md` = 1 ✓
- `grep -c "CHANGELOG.md" electron-builder.yml` = 1 ✓

**Task 3:**
- `test -f 16-SMOKE-TEST-GUIDE.md` = 0 ✓
- `test -f 16-HAND-CALC.md` = 0 ✓
- `grep -c "Section A — End-to-end run flow" 16-SMOKE-TEST-GUIDE.md` = 1 ✓
- `grep -c "Section B — Per-requirement acceptance matrix" 16-SMOKE-TEST-GUIDE.md` = 1 ✓
- `grep -c "Section C — Free-text observations" 16-SMOKE-TEST-GUIDE.md` = 1 ✓
- `grep -c "Overall: PASS / FAIL" 16-SMOKE-TEST-GUIDE.md` = 1 ✓
- `grep -cE "SMK3-(0[1-9]|1[0-7])" 16-SMOKE-TEST-GUIDE.md` = 17 (≥ 17) ✓
- `grep -c "D-15-08" 16-SMOKE-TEST-GUIDE.md` = 2 (≥ 1) ✓
- `grep -c "N/A — historical-run banner is code-verified" 16-SMOKE-TEST-GUIDE.md` = 1 ✓
- `grep -c "immunoplex-assay-calculator-1.0.0-x64-setup.exe" 16-SMOKE-TEST-GUIDE.md` = 2 (≥ 1) ✓
- `grep -c "16 panels imported" 16-SMOKE-TEST-GUIDE.md` = 2 *(one in Step 3 banner check,
  one in SMK3-10 matrix row; both intentional traceability — strengthens, doesn't weaken,
  acceptance gate)*
- `grep -c "PRD case 1" 16-HAND-CALC.md` = 5 (≥ 1) ✓
- `grep -c "Fixture Coverage Map" 16-HAND-CALC.md` = 1 ✓
- `grep -c "7.4 mL" 16-HAND-CALC.md` = 3 (≥ 1) ✓
- `grep -c "3.7 mL" 16-HAND-CALC.md` = 5 (≥ 1) ✓

## Commits

- `cb537d0` — `docs(16-01): reconcile v2.0 milestone label to v1.0 + reframe Phase 6/7 as v1.1/v1.2`
- `fd838b0` — `docs(16-01): create CHANGELOG.md inaugural v1.0.0 entry`
- `d4ff7c8` — `docs(16-01): author 16-SMOKE-TEST-GUIDE.md (Section A/B/C) + 16-HAND-CALC.md`

## Downstream Handoff

- **Wave 2 (Plan 16-02)** consumes:
  - `CHANGELOG.md` §[1.0.0] (Wave 3 will reuse verbatim as `gh release create --notes-file`
    body)
  - `16-SMOKE-TEST-GUIDE.md` (handed off to operator at Windows UAT checkpoint)
  - `16-HAND-CALC.md` (operator's calc-verification reference during Section A Step 6/8/9)
- **Wave 3 (Plan 16-03)** consumes the reconciled STATE/PROJECT/ROADMAP/REQUIREMENTS state
  + the `## Releases` section in STATE.md (which Plan 16-03 will append v1.0.0 to) +
  pre-tag cleanup of `worktree-agent-*` branches per D-16-23

## Self-Check: PASSED

**Files verified to exist:**
- FOUND: CHANGELOG.md
- FOUND: .planning/phases/16-windows-uat-release/16-SMOKE-TEST-GUIDE.md
- FOUND: .planning/phases/16-windows-uat-release/16-HAND-CALC.md
- FOUND: .planning/phases/16-windows-uat-release/16-01-SUMMARY.md (this file)

**Modified files verified:**
- MODIFIED: .planning/STATE.md (milestone, status, Current Position, Performance Metrics)
- MODIFIED: .planning/PROJECT.md (Current Milestone, Next Milestone blocks)
- MODIFIED: .planning/ROADMAP.md (Overview, Phase 16 summary, Phase 6/7 headers, Phase 16 SC#1/#5, footer)
- MODIFIED: .planning/REQUIREMENTS.md (§v2.0 header re-scope blockquote, footer)

**Commits verified:**
- FOUND: cb537d0 (Task 1 reconciliation)
- FOUND: fd838b0 (Task 2 CHANGELOG)
- FOUND: d4ff7c8 (Task 3 UAT artifacts)
