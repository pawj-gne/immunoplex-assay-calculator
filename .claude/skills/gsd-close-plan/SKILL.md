---
name: gsd-close-plan
description: Use when the final task of a GSD plan (`.planning/phases/<phase>/<phase>-<NN>-PLAN.md`) has just been committed, when the user says "close this plan", "wrap up the plan", "finalize the phase plan", or when all task checkboxes in a PLAN file are checked. Generates the matching `<phase>-<NN>-SUMMARY.md` and updates `.planning/STATE.md` (current position, metrics, decisions log). Always confirms with the user before writing.
user-invocable: true
---

# GSD Plan Closeout

Run this after the last task of a GSD plan has been committed. It produces the SUMMARY artifact and syncs `.planning/STATE.md` so the phase is traceable.

## Preconditions

Before writing anything, verify:
1. A PLAN file exists at `.planning/phases/<phase>/<phase>-<NN>-PLAN.md`
2. All task commits for the plan are pushed (check `git log --oneline` since the plan started)
3. No uncommitted changes tied to the plan remain (`git status`)

If any precondition fails, STOP and report to the user.

## Step 1: Gather Context

Run in parallel:
- Read the PLAN file at `.planning/phases/<phase>/<phase>-<NN>-PLAN.md`
- Read `.planning/STATE.md`
- Read the reference template `.planning/phases/03.3-analyte-selection-redesign/03.3-04-SUMMARY.md`
- `git log --oneline` for the commits that belong to this plan (scope by plan start timestamp or task commit messages)
- `git diff <plan-start>..HEAD --stat` to enumerate files touched

## Step 2: Draft the SUMMARY

Target path: `.planning/phases/<phase>/<phase>-<NN>-SUMMARY.md`

### Frontmatter (YAML)

```yaml
---
phase: <phase-slug>
plan: <NN>
subsystem: <ui | store | calc | infra | docs | ...>
tags: [<short, lowercase tags>]

# Dependency graph
requires:
  - phase: <phase-NN>
    provides: <what that upstream plan delivered that this plan consumed>
provides:
  - <capability or artifact this plan delivers downstream>
affects: [<downstream-phase-NN>, ...]

# Tech tracking
tech-stack:
  added: []           # new deps/libs introduced
  patterns:
    - "<pattern established or reinforced>"

key-files:
  created:
    - <absolute-from-repo-root path>
  modified:
    - <absolute-from-repo-root path>

key-decisions:
  - "<decision + one-line rationale>"

patterns-established:
  - "<reusable pattern other plans should know about>"

# Metrics
duration: <e.g., 6min | 2h15m>
completed: <YYYY-MM-DD>
---
```

### Markdown Body (in this order)

1. **Title line** — `# Phase <phase> Plan <NN>: <short name> Summary` plus a 1-line italicized description.
2. **Performance** — Duration, Started, Completed, Tasks count, Files modified count.
3. **Accomplishments** — bulleted list of what shipped.
4. **Task Commits** — numbered list, each: `**Task N: <title>** - \`<sha>\` (<type>)`.
5. **Files Created/Modified** — bulleted `path - one-line purpose`.
6. **Decisions Made** — bold lead-in + explanation per decision.
7. **Deviations from Plan** — group by Auto-fixed vs Escalated. For each: Found during, Issue, Fix, Files modified, Verification, Committed in. End with `**Total deviations:** N` + impact line.
8. **Issues Encountered** — or `None`.
9. **User Setup Required** — or `None - no external service configuration required.`
10. **Next Phase Readiness** — bullets explaining what downstream plans can now assume.
11. **Footer** — italicized `*Phase: <slug>*` and `*Completed: <date>*`.

Match the tone and structure of `.planning/phases/03.3-analyte-selection-redesign/03.3-04-SUMMARY.md` exactly.

## Step 3: Update `.planning/STATE.md`

Apply three edits:

1. **Current position** — advance the pointer to the next plan (or mark the phase complete if this was the final plan of the phase).
2. **Metrics table** — append a row for this plan: phase, plan number, duration, tasks, files modified, completed date.
3. **Decisions log** — append any `key-decisions` entries that are cross-plan relevant (skip purely local ones).

## Step 4: Confirm Before Writing

Before calling Write/Edit on any file:
- Present the drafted SUMMARY frontmatter + section headers (not full body) to the user
- Present the three proposed STATE.md edits as a diff summary
- Ask: *"Write SUMMARY and update STATE.md as shown?"*
- Only proceed on explicit yes

## Step 5: Write + Commit

After approval:
1. Write `<phase>-<NN>-SUMMARY.md`
2. Edit `.planning/STATE.md`
3. Stage both files and commit using the commit skill: `docs: close <phase> plan <NN> — add SUMMARY and update STATE`
4. Push

## Rules

- NEVER invent task commits — only list commits that actually exist in `git log`
- NEVER skip the user confirmation in Step 4
- If the PLAN file is missing, STOP and tell the user to run the quickplan skill or create a plan first
- Preserve exact frontmatter key order from the reference template
