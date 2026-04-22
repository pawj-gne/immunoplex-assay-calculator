---
phase: XX-YY-phase-slug
plan: NN
type: execute
wave: N
depends_on: ["XX-YY-MM"]
files_modified:
  - path/to/file.ts
autonomous: false

must_haves:
  truths:
    - "Observable fact that must be true after this plan ships"
  artifacts:
    - path: "path/to/file.ts"
      provides: "What this file provides"
      contains: "identifier_or_pattern"
  key_links:
    - from: "path/to/caller.ts"
      to: "path/to/callee.ts"
      via: "why they connect"
      pattern: "import_or_call_pattern"
---

## How to use

This template extends the single-context plan format with **subagent delegation** via the `Agent` tool. Pick a `<task type>` based on whether the work should burn main-context tokens or run in an isolated subagent.

**Delegation decision matrix:**

| Task | Type | Why |
|------|------|-----|
| "Where does X live? How is Y wired?" | `research` | Exploration produces lots of read noise; subagent returns a distilled answer. Main context stays clean. |
| "Does my approach fit the architecture before I code?" | `plan-check` | Architectural sanity-check on the plan itself. Catches contradictions with invariants/prior plans cheaply. |
| "Write this code / run these commands" | `auto` | Default. Main context executes when the action is concrete and scoped. |
| "Did the diff actually satisfy `must_haves.truths`?" | `checkpoint:verify` | **Independence matters.** A fresh subagent reading only the diff + truths catches self-justification bugs the author's context misses. |
| "Operator, please click through the app" | `checkpoint:human-verify` | Unchanged from existing pattern. |

**Context budget rationale:** Research and verification each easily consume 20-50k tokens of file reads. Delegating them keeps the main execution context under its useful working set and makes the verifier genuinely independent (different context = different confirmation bias).

**Brief subagents like a coworker on a Slack DM:** exact query, exact files to diff, exact acceptance criteria. Don't make them re-derive context.

---

<objective>
One paragraph: what this plan changes and why. End with the concrete output (files/behaviors).
</objective>

<execution_context>
@C:\Users\pawj\.claude/get-shit-done/workflows/execute-plan.md
@C:\Users\pawj\.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/PROJECT.md
@.planning/ROADMAP.md
@.planning/STATE.md
@.planning/phases/XX-YY-slug/XX-YY-CONTEXT.md
@.planning/phases/XX-YY-slug/XX-YY-RESEARCH.md

# Prior plan dependencies (summaries, not full plans)
@.planning/phases/XX-YY-slug/XX-YY-MM-SUMMARY.md
</context>

<tasks>

<task type="research">
  <name>Task 1: Locate current selection state machine</name>
  <files>read-only exploration</files>
  <action>
Delegate to Explore subagent via the Agent tool.

**Thoroughness:** medium

**Query:**
> Map how selection state flows from PlateGrid mouse events to plateStore. Return: (1) the hook/function that owns drag state, (2) the exact store action names it calls, (3) any intermediate adapters, (4) where hovered-vs-selected is disambiguated. Cite file paths and line ranges. Do not propose changes.

**Expected return:** A short written answer (under 40 lines) with file:line citations. Do NOT let the subagent dump file contents back into the response.
  </action>
  <verify>Subagent response cites concrete file paths + symbols for each question. If vague, re-run with thoroughness: thorough.</verify>
  <done>Selection data flow documented in the research response; main context has not read the source files directly.</done>
</task>

<task type="plan-check">
  <name>Task 2: Architectural sanity-check before coding</name>
  <files>this plan + phase CONTEXT.md</files>
  <action>
Delegate to Plan subagent via the Agent tool.

**Brief:**
> Read this plan (XX-YY-NN-PLAN.md) plus @.planning/phases/XX-YY-slug/XX-YY-CONTEXT.md and @.planning/phases/XX-YY-slug/XX-YY-RESEARCH.md. Identify: (1) any assumption in the `<action>` blocks that contradicts prior-plan invariants, (2) any `must_haves.truths` that the described tasks do not actually produce, (3) any file in `files_modified` with no corresponding task, (4) hidden dependencies not in `depends_on`. Return a numbered list of findings with severity (blocker/warn/nit). If clean, say "clean" and stop.

**Expected return:** Numbered findings list, under 30 lines.
  </action>
  <verify>Any "blocker" findings are addressed in the plan (edit the plan) before proceeding to auto tasks.</verify>
  <done>Plan-check returns "clean" or all blockers resolved.</done>
</task>

<task type="auto">
  <name>Task 3: Implement the change</name>
  <files>
    src/renderer/src/features/foo/Foo.tsx
    src/renderer/src/stores/fooStore.ts
  </files>
  <action>
Concrete implementation steps go here — code sketches, imports, state shape, exact prop wiring. Same style as existing plans. Main context executes.
  </action>
  <verify>Run `npx tsc --noEmit`. Run `npm run build`. Read modified files to confirm the edits landed as intended.</verify>
  <done>Build passes; diff matches intent.</done>
</task>

<task type="checkpoint:verify" gate="blocking">
  <name>Task 4: Independent verification of must_haves</name>
  <files>git diff + must_haves block</files>
  <action>
Delegate to a fresh **general-purpose subagent** via the Agent tool. This subagent has NOT seen the implementation discussion — that's the point.

**Brief:**
> You are verifying plan XX-YY-NN. Do not trust the author's claims. Run `git diff <base-sha>...HEAD -- <files_modified>` and read each changed file. For each entry in `must_haves.truths` below, decide PASS / FAIL / UNVERIFIABLE-STATICALLY and cite the file:line evidence. For each `must_haves.artifacts` entry, grep for `contains` in `path` and confirm. For each `must_haves.key_links` entry, grep for `pattern` in `from` and confirm it references `to`. Report as a table. Do not read unrelated files. Do not propose fixes.
>
> **truths to check:**
> - (paste the exact `must_haves.truths` list here)
>
> **artifacts to check:**
> - (paste the exact `must_haves.artifacts` list here)
>
> **key_links to check:**
> - (paste the exact `must_haves.key_links` list here)
>
> **base sha:** (paste the merge-base sha with the branch point)

**Expected return:** A PASS/FAIL table. Any FAIL is a blocker.
  </action>
  <verify>All rows PASS. UNVERIFIABLE-STATICALLY rows must be covered by the human-verify checkpoint that follows.</verify>
  <done>Independent verifier confirms must_haves or surfaces a concrete gap.</done>
</task>

<task type="checkpoint:human-verify" gate="blocking">
  <name>Task 5: Operator walk-through</name>
  <what-built>
1-6 bullet summary of user-visible changes.
  </what-built>
  <how-to-verify>
Launch the app: `npm run dev`

Numbered steps the operator clicks through. Include expected observable result for each step.
  </how-to-verify>
  <resume-signal>Type "approved" if all checks pass, or describe specific issues to fix.</resume-signal>
</task>

</tasks>

<verification>
1. `npx tsc --noEmit` - no type errors
2. `npm run build` - electron-vite build succeeds
3. Independent verifier (Task 4) returns all PASS
4. Human verification confirms end-to-end behavior
</verification>

<success_criteria>
- All `must_haves.truths` hold
- Phase-level success criteria this plan contributes to are met
- Build is green
</success_criteria>

<output>
After completion, create `.planning/phases/XX-YY-slug/XX-YY-NN-SUMMARY.md`
</output>
