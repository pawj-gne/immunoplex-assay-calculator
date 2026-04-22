---
name: gsd-quickplan
description: Use when the user proposes ad-hoc work with phrases like "let's just quickly do X", "small fix", "quick tweak", or starts committing changes without an existing `.planning/phases/<phase>/<phase>-<NN>-PLAN.md` file. Offers to scaffold a minimal PLAN file so the work stays traceable without forcing the full GSD research + multi-task flow.
user-invocable: true
---

# GSD Quickplan

For ad-hoc work that does not justify the full GSD plan flow but still deserves a paper trail.

## When to Trigger

- User says "let's just quickly do X", "small tweak", "quick fix", "one-off"
- User starts asking for edits / committing without referencing an existing PLAN file
- Work is scoped to <~30 minutes and touches a small number of files

## Step 1: Prompt the User

Before writing code or committing, ask once:

> *"This looks ad-hoc — want me to scaffold a minimal PLAN file so it's traceable?"*

If **no**: drop it, proceed with the work normally. Do not re-ask this conversation.

If **yes**: continue to Step 2.

## Step 2: Pick a Path

Path: `.planning/phases/<phase>/<phase>-<NN>-PLAN.md`

- `<phase>` — the current active phase slug from `.planning/STATE.md` (ask user if unclear)
- `<NN>` — next available 2-digit plan number in that phase directory (run `ls .planning/phases/<phase>/`)

## Step 3: Write the Minimal PLAN

Keep it under 20 lines total. Use this exact shape:

```markdown
---
phase: <phase-slug>
plan: <NN>
type: quickplan
---

# Plan <NN>: <short title>

## Objective
<Two sentences max. What and why.>

## Files Modified
- <path>
- <path>

## Must-Haves
- truths:
  - <1-2 invariants that must hold after this change>

## Done When
<One line: observable condition that proves completion.>
```

## Rules

- **No research section** — this is deliberately lightweight
- **No multi-task breakdown** — the whole plan is the task
- **Under 20 lines total** including frontmatter
- **One truth, maybe two** — not a full must-haves tree
- **Skip SUMMARY** — quickplans don't need closeout. If the work grows, promote to a full plan and run the gsd-close-plan skill instead.

## Step 4: Proceed with the Work

After writing the quickplan, go do the work. Commit with a normal Conventional Commits message referencing the plan number if helpful (e.g., `fix(<phase>-<NN>): <summary>`).
