# Phase 13 — Deferred Items

Out-of-scope discoveries during Phase 13 execution that are logged here rather
than auto-fixed. Per the GSD executor scope-boundary rule: only fix issues
DIRECTLY caused by the current plan's changes. Pre-existing failures in
unrelated areas land here.

## Discovered during Plan 13-06 (audit gate)

### 1. ESLint v9 missing config file — pre-existing environment debt

- **Source command:** `npm run lint`
- **Failure:** `ESLint couldn't find an eslint.config.(js|mjs|cjs) file.`
  ESLint v9.0+ requires the new flat-config format. The repo has no
  `eslint.config.js`, `eslint.config.mjs`, `eslint.config.cjs`, or legacy
  `.eslintrc.*` file. `npm run lint` has never run cleanly in this repo
  state — verified via `git log --all --diff-filter=A` (no config file
  has ever been added) and by checking the base commit `2755b87`
  package.json (`"eslint": "^9.18.0"` was installed but no config shipped).
- **Scope:** The lint script was wired up in package.json but the config
  file was never authored. This is environment configuration debt that
  predates Phase 13 by an unknown number of phases.
- **Impact on Phase 13:** Plan 13-06 `<verify>` lists
  `npm run lint 2>&1 | tail -5` with "Expected: exit 0" — that
  expectation cannot be satisfied without authoring a new flat-config
  file. Authoring a project-wide ESLint flat-config (with the right
  React/TS plugin presets matching the existing codebase patterns) is
  out-of-scope for the Phase 13 audit gate.
- **Plan 13-06 verification posture:** `npm run typecheck` (the real
  type-correctness gate) DOES exit 0. The test suite (216/216 across all
  17 test files) is green. The lint configuration debt is recorded here
  for a future tooling-debt cleanup plan.
- **Resolution path:** Future plan should author `eslint.config.mjs`
  with typescript-eslint + react + react-hooks plugin presets matching
  the current Electron-Vite app shape. Suggested as a tooling-debt
  cleanup item separate from the v2.0 feature roadmap.

### 2. Phantom referenced file `runStore.test.ts` in Plan 13-06 verification

- **Source command:** `npm test -- runStore.test.ts`
- **Failure:** `No test files found, exiting with code 1`
- **Scope:** Plan 13-06 references `src/renderer/src/lib/__tests__/runStore.test.ts`
  as the "Phase 12 SMK3-16 invariant regression check" — but no such file
  exists in the repo (confirmed via `find src -name "*.test.ts" | grep -i run`).
  The renderer-side runStore has no dedicated test file at any commit in
  this branch's history.
- **Equivalent coverage:** Per the 13-05 SUMMARY (Decisions Made section):
  "The integration-level Phase 12 ↔ Phase 13 boundary is already verified
  by importer.test.ts T-11; this step is the renderer-side regression
  check." The substantive Phase 12 SMK3-16 invariant — that historical
  runs survive a wholesale-replace import with NULL FKs on panel_id +
  analyte_id and all snapshot-frozen columns intact — IS verified by
  `importer.test.ts T-11` which is part of the green full-suite run.
- **Plan 13-06 verification posture:** T-11 ran green inside the full
  suite (`importer.test.ts (11 tests)`) AND was re-run in isolation via
  `npx vitest run src/main/import/__tests__/importer.test.ts -t SMK3-16`
  with 1 passed, 10 filtered. The plan's aspirational separate renderer
  test file would have provided belt-and-suspenders coverage but its
  absence does not weaken the cross-phase invariant guarantee.
- **Resolution path:** If/when the renderer-side runStore acquires a
  dedicated test suite (likely Phase 14 or Phase 15 calculator wiring),
  the SMK3-16 invariant should be re-asserted at the renderer layer as
  belt-and-suspenders coverage. Not a Phase 13 audit-gate blocker.
