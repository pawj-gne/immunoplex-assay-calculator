# Phase 16: Windows UAT & Release — Pattern Map

**Mapped:** 2026-05-12
**Files analyzed:** 11 touch points (4 new files, 4 modified files, 3 procedural)
**Analogs found:** 11 / 11 (all touch points have in-repo precedent)

This phase is release engineering, not feature work. Patterns are mechanical edits, doc-file shapes, and CLI invocations — copy verbatim from the cited analogs.

## Touch Point Mapping

| # | New/Modified File | Role | Closest In-Repo Analog | Pattern (what to copy) | Confidence |
|---|---|---|---|---|---|
| 1 | `package.json` (modify, version 0.7.0 → 1.0.0) | config | Commit `ca056e4` (0.6.1 → 0.7.0, 2026-04-25) — `package.json` line 3 | Single-line diff: `-  "version": "0.7.0",` / `+  "version": "1.0.0",`. Commit message form: `chore: bump version to X.Y.Z for <release>`. No other file edits in the same commit. | HIGH |
| 2 | `electron-builder.yml` (modify, add `${arch}` token) | config | `electron-builder.yml` line 26 (current value `${name}-${version}-setup.${ext}`) | Single-line YAML edit at line 26 under `nsis:`: replace with `artifactName: ${name}-${version}-${arch}-setup.${ext}`. Mirrors the `dmg.artifactName` / `appImage.artifactName` interpolation pattern already in the same file (lines 39, 48). Result: `immunoplex-assay-calculator-1.0.0-x64-setup.exe` (matches D-16-02 expected name). | HIGH |
| 3 | `CHANGELOG.md` (new, at repo root) | doc | None in-repo (does not exist). Closest content seeds: `.planning/SMOKE-3-PRD.md` §Calculation (variables + worked example); REQUIREMENTS.md SMK3-01..17 entries (lines 96–127); `.planning/STATE.md` §Releases list (line 41); CONTEXT.md D-16-11 (Added/Changed/Removed/Fixed section list, plain-language audience per D-16-12) | Keep-a-Changelog 1.1.0 skeleton (per RESEARCH.md Pattern 3, lines 270–300). v1.0.0 inaugural entry only — do NOT back-fill v0.x (D-16 "Claude's Discretion" recommendation). `### Removed` must mention "v0.7.0 sub-panel CSV importer (superseded by Smoke 3 per-reagent schema)" per CONTEXT.md plan-time addendum. **Note:** `electron-builder.yml` line 9 already excludes `CHANGELOG.md` from the packaged installer (`'!{...,CHANGELOG.md,README.md}'`) — no edit needed there. | HIGH |
| 4 | `npm run build:win` invocation | procedural | `package.json` line 18: `"build:win": "npm run build && electron-builder --win"`; `package.json` line 15: `"build": "npm run typecheck && electron-vite build"` | Wave 2 pre-flight sequence (per `.claude/skills/release/SKILL.md` Phase 1–2, lines 13–53): `find . -name "tmpclaude-*" -type f -delete` → `git status --porcelain` → `npx tsc --noEmit` OR `npm run typecheck` → `npm run build` → `npm run build:win` → `ls -la dist/*.exe`. Identical to Plan 04.1-05 Task 1 lines 130–148 (with version bumped to 1.0.0). | HIGH |
| 5 | `16-SMOKE-TEST-GUIDE.md` (new) | doc | `.planning/phases/04-run-documentation-persistence-deployment/04-SMOKE-TEST-GUIDE.md` (207 lines, 7 sections) | **Hybrid structure per D-16-05** — but the Section A E2E shape borrows numbered-step formatting from 04-SMOKE-TEST-GUIDE.md verbatim: header narrative (lines 1–8: "Thanks for helping test… ~15 minutes"), "## What you need" block (lines 9–14: installer filename + Windows PC + time), numbered top-level sections `## 1. Install the app` / `## 2. First launch` / `## 3. Walk through a full run…` (lines 17–172), per-step PASS/FAIL bullets with `✅ Pass:` / `❌ Report if:` markers (e.g., lines 23–26), tabular data fields where exact values matter (lines 65–80 — Request 9421 metadata form), and trailing FAQ block (lines 192–204). **Diverges from 04 precedent at Section B** (per-SMK3-XX matrix, no direct analog — fresh table; row keys are the SMK3-01..17 lines from REQUIREMENTS.md lines 96–127 + the dedicated `D-15-08 override badge` row per D-16-14 + the `SMK3-16` N/A row per D-16-21). Section C is free-text — no structural template needed. | HIGH |
| 6 | `16-SMOKE-TEST-RETEST.md` (new, operator-authored on Windows PC) | doc | `.planning/phases/04.1-smoke-test-fixes/04.1-05-PLAN.md` lines 243–265 (the unrealized retest template — `04.1-SMOKE-TEST-RETEST.md` was never written) | Copy the template skeleton verbatim from 04.1-05-PLAN.md lines 244–264, adjust headings: `# Phase 16 Smoke 3 Retest`, `Artifact: dist/immunoplex-assay-calculator-1.0.0-x64-setup.exe`, replace `## Part A — 14-Step Smoke Test` with `## Section A — End-to-end flow` (15 numbered rows), replace `## Part B — Phase 4.1 Fix Acceptance` with `## Section B — Per-requirement matrix` (one row per SMK3-01..17 + `D-15-08`), add `## Section C — Free-text observations`, retain the trailing `## Overall: PASS / FAIL` line as the resume-signal anchor. Same `\|------\|--------\|-------\|` table delimiter form (line 251). | HIGH |
| 7 | `16-HAND-CALC.md` (new) | doc | `.planning/SMOKE-3-PRD.md` §Calculation lines 97–157 (PRD worked example: Thermofisher / Human / Panel 1, 2 plates × 100 samples → 148 wells × 0.05 mL beads = 7.4 mL); `.planning/phases/12-smoke-3-calculator-rules/12-01-SUMMARY.md` lines 82–101 (canonical Group A fixture: 100 / singles / 2 / 50 µL / setups=1 → finalVolumeML 9.4; setups=3 → 13.4); `.planning/phases/15-smoke-3-run-document-audit-trail-inserted-2026-05-11/15-CONTEXT.md` lines 173–209 (full audit-trail rendering for the same worked example: 196 wells, beads 9.8 mL, antibodies 4.9 mL, PE 9.8 mL, Panel I @ 1× wins diluent) | The fully rendered audit-trail block in 15-CONTEXT.md lines 177–209 is the operator's hand-calc reference verbatim — it shows every line the operator should see on screen for the PRD case. Add 2–3 additional panels per D-16-07; derive them by re-running the PRD math against panels from `templates/panels/all-panels.xlsx` that satisfy fixture-coverage items (a) / (c) / (d) per D-16-15 (premix panel exercising all 4 audit blocks; panel where Old Beads > 20% triggers override; panel with SAPE conc = 1). | HIGH |
| 8 | `gh release create v1.0.0` invocation | procedural | `.claude/skills/release/SKILL.md` Phase 3 (lines 62–119) + RESEARCH.md "Alternatives Considered" row 1 (notes-file vs awk-inline) + RESEARCH.md System Flow Wave 3 (lines 142–152) | Two-step shape: (1) extract CHANGELOG §[1.0.0] section to a temp file via `awk '/^## \[1\.0\.0\]/,/^## \[/{if(/^## \[/ && !/^## \[1\.0\.0\]/)exit; print}' CHANGELOG.md > /tmp/release-notes-1.0.0.md`; (2) `gh release create v1.0.0 --notes-file /tmp/release-notes-1.0.0.md --title "v1.0.0 — Smoke 3 Calculator" dist/immunoplex-assay-calculator-1.0.0-x64-setup.exe`. The asset-upload-at-create-time form is verified against past tags (RESEARCH.md: "Past releases v0.5.0 / v0.6.1 / v0.7.0 all uploaded as release assets via gh CLI"). Note: `.claude/skills/release/SKILL.md` Phase 4 Step 3 (lines 140–144) covers the `git tag -a vX.X.X -m "Release vX.X.X"` + `git push origin vX.X.X` form — use that verbatim for the tag step preceding the `gh release create`. | HIGH |
| 9 | `STATE.md` / `ROADMAP.md` / `PROJECT.md` reconciliation edits | doc | `.planning/phases/15-smoke-3-run-document-audit-trail-inserted-2026-05-11/15-05-SUMMARY.md` frontmatter (lines 1–47) + commits `b3db79d` (`docs(phase-15): complete phase execution`), `66fa39c` (`docs(phase-15): evolve PROJECT.md after phase completion`), `81db460` (Phase 14 equivalent) | **Closeout commit pair pattern** (Wave 3): two separate commits — first `docs(phase-16): complete phase execution` updates STATE.md (advance Current Position, populate per-phase row in Performance Metrics table, append decisions to Accumulated Context, clear `HUMAN-UAT-04.1-05-01` from Pending Todos per D-16's plan-time addendum) + ROADMAP.md (Phase 16 status → Complete, reframe Phase 6 → v1.1, Phase 7 → v1.2 per D-16-20); second `docs(phase-16): evolve PROJECT.md after phase completion` updates PROJECT.md §Current Milestone from "v2.0 Panel XLSX Upload…" → "v1.0 Released YYYY-MM-DD" with §Next Milestone "v1.1 (Phase 6) — trigger: lab-confirmed real-world use". STATE.md frontmatter shape: see line 3 (`milestone: v2.0` → `v1.0`), line 4 (`milestone_name: Release`), line 5 (`status: ready_to_plan` → `complete`). Performance Metrics table row shape: see STATE.md line 63 (`Phase 15 \| 5/5 \| Complete \| 2026-05-12`). | HIGH |
| 10 | `.gitignore` (modify, append `.claude/worktrees/`) | config | `.gitignore` lines 1–43 (current file). No existing `.claude/` patterns — section-grouped by domain (Dependencies / Build outputs / Environment / IDE / OS / Logs / Testing / MCP config / Electron / Ingest staging) | Append a new section at end of file (after line 43): `# Claude Code worktrees (executor scratch — never committed)` then `.claude/worktrees/`. Mirrors the "Ingest staging" comment-then-path shape at lines 41–42 (`# Ingest staging (raw docx/xlsx sources — converted artifacts get committed elsewhere)` / `.planning/inbox/`). Single-line content addition; no existing `.claude/` entry to amend. | HIGH |
| 11 | Worktree-agent branch cleanup | procedural | CONTEXT.md D-16-23 + git state (29 stale `worktree-agent-*` branches present; example: `worktree-agent-a06bdb78c2735b9ef`, `worktree-agent-a0b9b72b`, `worktree-agent-a0f56b945a4af8809` per `git branch -a`) | Three-command sequence: (1) `git worktree prune` (drops locked-but-stale refs); (2) `git branch --merged dev/v1-01 \| grep '^[[:space:]]*worktree-agent-' \| xargs -r git branch -d` (safe delete — only branches fully merged into dev/v1-01); (3) `git branch --no-merged dev/v1-01 \| grep '^[[:space:]]*worktree-agent-'` (list-only, surface to user for manual review per D-16-23: "Skip any worktree-agent branch whose HEAD is not reachable from dev/v1-01 — flag to user, do not force-delete"). Runs in Wave 3 before `git tag -a v1.0.0`. Not a release-blocker if any branches resist deletion. | HIGH |

## Shared Patterns

### Closeout commit message convention
**Source:** Git log (commits `b3db79d`, `66fa39c`, `cae30d1`, `fbb592d`, `75ae4a4`, `81db460`)
**Apply to:** All Phase 16 Wave 3 doc-update commits.

Two-commit shape per phase close-out:
- `docs(phase-NN): complete phase execution` — STATE.md + ROADMAP.md edits
- `docs(phase-NN): evolve PROJECT.md after phase completion` — PROJECT.md §Current Milestone shift

Per-plan commits use `docs(NN-MM): …` form (e.g., `docs(15-05): add plan summary`, `docs(15.1-03): complete WR-01 plan`). Phase 16 plans 16-01 / 16-02 / 16-03 follow this convention.

### Version-bump commit convention
**Source:** Commits `ca056e4` (v0.7.0), `05e1989` (v0.6.0), `1c718c5` (v0.6.1), `92ee147` (v0.5.0)
**Apply to:** Wave 2 Task 1 (package.json bump).

`chore: bump version to X.Y.Z for <reason>` — single-file commit, `package.json` only. No `package-lock.json` co-commit historically (project does not commit lockfile per `.gitignore` review — confirmed in past version-bump diffs). Phase 16 form: `chore(16): bump version to 1.0.0 for v1.0 Smoke 3 release` (the `(16)` scope matches the per-phase scope used in commits like `chore(04.1-05): bump version to 0.6.0 for phase 4.1 bundle`).

### `checkpoint:human-action` YAML idiom
**Source:** `04.1-05-PLAN.md` Task 2 (lines 184–282), already cited verbatim in RESEARCH.md Pattern 1 (lines 185–201)
**Apply to:** Wave 2 final task (Windows UAT gate).

```yaml
<task type="checkpoint:human-action" gate="blocking">
  <name>Task N: HUMAN-UAT — Windows Smoke 3 walkthrough</name>
  <files>.planning/phases/16-windows-uat-release/16-SMOKE-TEST-RETEST.md</files>
  <what-built>…</what-built>
  <action>…wait for operator…</action>
  <how-to-verify>operator follows 16-SMOKE-TEST-GUIDE.md Section A/B/C; records to RETEST.md with `## Overall: PASS\|FAIL`</how-to-verify>
  <resume-signal>Type "retest passed" or "retest failed: <summary>"</resume-signal>
</task>
```

The `<resume-signal>` form (lines 278–281 of 04.1-05-PLAN.md) is the exact wording the planner copies — orchestrator routing depends on it.

### Plan SUMMARY frontmatter shape
**Source:** `.planning/phases/15-smoke-3-run-document-audit-trail-inserted-2026-05-11/15-05-SUMMARY.md` lines 1–47
**Apply to:** `16-01-SUMMARY.md`, `16-02-SUMMARY.md`, `16-03-SUMMARY.md` (generated by `/gsd-close-plan` after each plan).

Same YAML keys (`phase`, `plan`, `subsystem`, `tags`, `requires`, `provides`, `affects`, `tech-stack`, `key-files`, `key-decisions`, `requirements-completed`, `metrics`). Phase 16's `requirements-completed` field lists the SMK3-XX requirements UAT-confirmed in Wave 2 RETEST.md (Section B PASS rows).

## No Analog Found

None. Every Phase 16 touch point has either an exact in-repo precedent (Wave 2/3 mechanics, closeout commit pairs, version bumps) or a near-exact template to extend (Section A E2E format from 04-SMOKE-TEST-GUIDE.md; RETEST.md skeleton from 04.1-05-PLAN.md lines 244–264). Section B (per-requirement matrix) is the only structural extension — but the row-content source (REQUIREMENTS.md SMK3-01..17) is locked, and the table-row form is the same `\| key \| Pass/Fail/N/A \| evidence \|` shape used throughout the project's planning docs.

## Metadata

**Analog search scope:** `.planning/phases/04/`, `.planning/phases/04.1/`, `.planning/phases/12/`, `.planning/phases/14/`, `.planning/phases/15/`, `.planning/phases/15.1/`, `.claude/skills/`, repo root configs (`package.json`, `electron-builder.yml`, `.gitignore`), git log (`--all` across tags v0.1.0..v0.7.0).

**Files scanned:** 11 source/config + 10 phase planning docs + 2 skill files + `git show` on 3 version-bump commits + `git log --oneline --all` for closeout-commit patterns.

**Key cross-references for the planner:**
- `16-CONTEXT.md` D-16-23 (Wave 3 pre-tag cleanup scope) → touch points #10 + #11
- `16-CONTEXT.md` plan-time addendum (electron-builder `${arch}`; 0.7.0 → 1.0.0 baseline) → touch points #1 + #2
- `16-RESEARCH.md` Pattern 1 (checkpoint:human-action), Pattern 3 (Keep-a-Changelog) → touch points #3 + #6
- `04.1-05-PLAN.md` lines 110–182 (Task 1 build + verify acceptance criteria) → touch point #4 (Wave 2 Task 1 is the same shape with 1.0.0 substituted for 0.6.0; drop the arm64 line per D-16-03)

*Pattern extraction date: 2026-05-12*
*Phase: 16-windows-uat-release*
