---
phase: 04-run-documentation-persistence-deployment
plan: 03
subsystem: deployment
tags: [electron-builder, nsis, windows, packaging, cross-compile, native-modules, drizzle, better-sqlite3]

# Dependency graph
requires:
  - phase: 01-foundation
    provides: electron-builder.yml scaffold, asarUnpack rule for better-sqlite3, extraResources rule for drizzle/migrations, npmRebuild + electron-rebuild postinstall
  - phase: 04-run-documentation-persistence-deployment
    provides: 04-01 migration 0003 (runs/runSingleAnalytes/operators), 04-02 Document & Save form, 04-04 Finalized Run View, 04-05 Operators Manage section
provides:
  - Windows NSIS .exe installers built from macOS for both x64 and arm64 Windows targets
  - Static-verified native module unpacking (better_sqlite3.node lives outside app.asar on both arches)
  - Static-verified migration shipment (all four drizzle migrations 0000..0003 present in resources/drizzle/migrations on both arches)
  - electron-builder.yml delta locking the Windows arch matrix (arm64 default-only behavior on Apple Silicon hosts is now a non-issue)
affects: [Phase 4 release readiness, future v1 release tagging]

# Tech tracking
tech-stack:
  added: []  # No new dependencies; pure config delta + tooling exercise
  patterns:
    - "Explicit win.target.arch matrix on Apple Silicon hosts (the implicit-host-arch default produces arm64-only installers — easy to miss until someone tries to install on an Intel/AMD Windows PC)"
    - "${arch} in nsis.artifactName so the two arches don't collide on the same output filename"

key-files:
  created: []
  modified:
    - electron-builder.yml

key-decisions:
  - "win.target arch list set to [x64, arm64] explicitly (do not rely on implicit host-arch default; macOS arm64 hosts otherwise emit arm64-only installers)"
  - "${arch} added to nsis.artifactName to disambiguate per-arch output exe names"
  - "D-26 deferrals untouched: appId stays scaffolded com.electron.immunoplex-assay-calculator, no custom icon, no signing, publish.url stays placeholder https://example.com/auto-updates"
  - "Windows physical smoke test (14 steps) recorded as a pending HUMAN-UAT item rather than blocking plan closure — macOS dev host cannot exercise a Windows .exe (CLAUDE.md §Testing Windows-only)"

requirements-completed: [PERS-01, PERS-02, DOCM-01]  # Code-complete and packaged; runtime confirmation pending HUMAN-UAT

# Metrics
duration: ~25m (Tasks 1+2 in prior session; Task 3 deferred to HUMAN-UAT, plan closeout this session)
completed: 2026-04-22
---

# Phase 4 Plan 3: Windows NSIS Installer Summary

**Cross-compiled Windows NSIS installers for the full Phase 4 bundle (5-step wizard + Finalized View + Operators Manage + persistence) — both x64 and arm64 produced, statically verified, and pending physical Windows smoke test on the operator's workstation.**

## Performance

- **Duration:** ~25m total wall-clock across two sessions (Tasks 1+2 the first session; closeout the second)
- **Started:** 2026-04-22 (first session — Task 1 config audit + delta)
- **Completed:** 2026-04-22 (Task 2 build) + 2026-04-22 (this closeout)
- **Tasks:** 3 planned (2 implementation auto + 1 checkpoint:human-verify)
  - Task 1 — Config audit + arch fix: COMPLETE (commit 6162adc)
  - Task 2 — Build + static sanity check: COMPLETE (artifacts in dist/, see below)
  - Task 3 — Windows physical smoke test: **DEFERRED to HUMAN-UAT** (see Pending Verification)
- **Files modified:** 1 (electron-builder.yml)
- **Commits:** 1 implementation + 1 closeout docs

## Accomplishments

### Task 1: Config audit + arch fix

Audit of electron-builder.yml against the seven config-correctness checks:

1. **asarUnpack covers better-sqlite3** — `node_modules/better-sqlite3/**` present in `asarUnpack` block (also includes `resources/**`). Confirmed (electron-builder.yml asarUnpack list).
2. **extraResources copies drizzle/migrations** — `from: drizzle/migrations` → `to: drizzle/migrations` rule present. The directory glob automatically covers the new `0003_*.sql` migration from Plan 04-01 (no per-file edit needed). Confirmed.
3. **npmRebuild: true** — present at top level of electron-builder.yml; better-sqlite3 will rebuild against packaged Electron's ABI during the build pass.
4. **publish placeholder untouched** — `publish.provider: generic` + `publish.url: https://example.com/auto-updates` left as scaffolded per D-26 (auto-updater deferred; not invoked at runtime).
5. **appId untouched** — `com.electron.immunoplex-assay-calculator` (scaffolded) per D-26.
6. **App icon untouched** — no custom `win.icon` set; default Electron icon per D-26.
7. **postinstall electron-rebuild** — `package.json` postinstall script runs `electron-rebuild` against the installed Electron version.

**One real config delta applied** (commit 6162adc, `chore(04-03):` prefix):

- Added explicit `win.target` block with `arch: [x64, arm64]` — without this, electron-builder's default behavior on an Apple Silicon macOS host is to build only for the host architecture (arm64), which would ship an arm64-only installer. Most lab Windows workstations are Intel/AMD x64, so the default would have produced an installer that silently refuses to run on the actual deployment target.
- Added `${arch}` to `nsis.artifactName` so the two per-arch installers don't collide on the same output filename.
- This delta is correctness-only (Rule 1: bug — silent wrong-arch ship) and was caught during Task 1's config audit before the build pass. No appId / icon / signing / publish changes.

### Task 2: Build + static sanity checks

`npm run build:win` produced three NSIS installers in `dist/`:

| File | Size | Target | Notes |
|------|------|--------|-------|
| `dist/immunoplex-assay-calculator-0.5.0-x64-setup.exe` | 87 MB | Intel/AMD Windows (x64) | **Recommended for typical lab workstations.** |
| `dist/immunoplex-assay-calculator-0.5.0-arm64-setup.exe` | 92 MB | ARM Windows (arm64) | For Surface-class / ARM Windows PCs only. |
| `dist/immunoplex-assay-calculator-0.5.0-setup.exe` | 179 MB | Universal multi-arch | electron-builder auto-emits a combined installer when multiple `win.target.arch` entries are set; both arch payloads embedded. |

Static sanity checks passed on both arches:

- `dist/win-unpacked/resources/app.asar.unpacked/node_modules/better-sqlite3/build/Release/better_sqlite3.node` — present (x64).
- `dist/win-arm64-unpacked/resources/app.asar.unpacked/node_modules/better-sqlite3/build/Release/better_sqlite3.node` — present (arm64).
- `dist/win-unpacked/resources/drizzle/migrations/` — contains all four migrations: `0000_perpetual_the_initiative.sql`, `0001_daffy_marten_broadcloak.sql`, `0002_rename_conc_columns.sql`, `0003_damp_prima.sql`.
- `dist/win-arm64-unpacked/resources/drizzle/migrations/` — same four migrations confirmed.
- `electron-rebuild` reported clean for both arches (no native-module ABI mismatches).

## Task Commits

1. **Task 1: electron-builder.yml arch matrix fix** — `6162adc` (chore) — pushed to `origin/dev/v1-01`.
2. **Task 2: build + static sanity check** — no commit (artifacts in `dist/` which is gitignored; the build is reproducible from current source via `npm run build:win`).
3. **Task 3: Windows smoke test** — DEFERRED, see Pending Verification.
4. **Closeout docs** — this SUMMARY + STATE/ROADMAP/REQUIREMENTS updates (forthcoming `docs(04-03):` commit).

## Decisions Made

- **Win arch matrix made explicit:** electron-builder's "implicit host-arch" default on Apple Silicon macOS is a foot-gun for cross-compile-from-Mac-to-Windows workflows; we now lock it to `[x64, arm64]` so the artifact set is independent of which Mac runs the build.
- **D-26 deferrals honored verbatim:** appId, icon, code signing, and auto-updater URL were all explicitly NOT touched. The Windows SmartScreen "unrecognized publisher" click-through is the expected and accepted UX for v1 internal deployment.
- **Migration naming kept consistent with Plan 04-01:** Plan 04-03's text refers to the new migration as `0003_phase4_runs_and_operators.sql`, but Plan 04-01 explicitly chose to keep drizzle-kit's auto-generated name `0003_damp_prima.sql` to avoid hand-editing `_journal.json` (logged in 04-01 SUMMARY decisions). The 04-03 acceptance criteria use the glob `0003_*.sql`, which matches either name. Functionally equivalent. No rename attempted.
- **Plan version label drift noted (not corrected):** The plan's `<what-built>` text labels this as the "v0.6.0 (Phase 4 bundle)" but `package.json` version is still `0.5.0`. The artifact names reflect the actual `package.json` version (`...-0.5.0-x64-setup.exe`). A deliberate `v0.6.0` version bump + tag is a separate release-workflow concern and not in this plan's scope.
- **Smoke test recorded as HUMAN-UAT, not as plan failure:** Per CLAUDE.md §"Testing (Windows-only)" the dev cycle explicitly is "build .exe → install on Windows workstation → manual verification." A macOS dev host cannot exercise a Windows .exe; the operator will run the 14-step smoke test on their Windows PC asynchronously. The HUMAN-UAT record will be created by the orchestrator at phase verification time if needed.

## Deviations from Plan

**1. [Rule 1 - Bug] Implicit-host-arch default would have shipped an arm64-only installer to x64 lab PCs**

- **Found during:** Task 1 config audit (before any build).
- **Issue:** electron-builder.yml's `win.target` block was using the default ("nsis", implicit host arch). On an Apple Silicon macOS host that means arm64-only output — silently wrong arch for typical Intel/AMD lab Windows workstations.
- **Fix:** Added explicit `win.target` with `arch: [x64, arm64]` so the build emits both. Added `${arch}` to `nsis.artifactName` so the per-arch installers don't collide on the same filename.
- **Files modified:** `electron-builder.yml`
- **Commit:** `6162adc`
- **Why Rule 1 (not Rule 4):** Correctness fix to an existing config; no architectural change. The config now matches what the plan's `<must_haves.truths>` actually require ("operators install and launch on a physical Windows PC").

**2. [Plan-text vs reality] Plan refers to "v0.6.0" but build is v0.5.0**

- **Found during:** SUMMARY drafting.
- **Issue:** Plan's Task 3 `<what-built>` block says "Windows NSIS .exe installer for Immunoplex Assay Calculator v0.6.0 (Phase 4 bundle)" but `package.json` is still `0.5.0`.
- **Resolution:** No code change. Version-bump-and-tag is a separate release workflow (`.claude/release.md`) that the operator will run when ready to cut the actual v0.6.0 tag. This SUMMARY documents the artifact names as they actually are: `...-0.5.0-x64-setup.exe`. Surfacing this so the release workflow can decide whether to rebuild post-version-bump or just tag-and-ship the existing 0.5.0 artifacts as the Phase 4 cut.

## Gaps / Pending Verification

### HUMAN-UAT-04-03-01: Windows physical workstation smoke test (14 steps)

**Status:** Pending. Code-complete and packaged; runtime confirmation requires a Windows PC.

**Why deferred:** Per CLAUDE.md §"Workflows → Testing (Windows-only)", dev happens on macOS and runtime testing happens by building the `.exe` and installing it on a physical Windows workstation. A macOS dev host can pass the static `dist/win-unpacked/...` checks (which it has) but cannot launch a Windows `.exe` to exercise the wizard, save/load, edit-warning modal, operators CRUD, and restart-persistence behavior. This is a documented project pattern, not a methodology failure.

**Test artifact to use:** `dist/immunoplex-assay-calculator-0.5.0-x64-setup.exe` (87 MB) — the recommended installer for typical Intel/AMD lab workstations. The arm64 variant is available if the target PC happens to be ARM Windows.

**Test plan to execute** (verbatim from Plan 04-03 Task 3 `<how-to-verify>`):

1. Transfer the installer (USB / network share / GitHub release artifact) to the Windows workstation.
2. Install — double-click installer, click through NSIS defaults, accept SmartScreen "unrecognized publisher" click-through (expected per D-26), confirm desktop + Start Menu shortcuts created.
3. Launch from shortcut — main UI within ~5 s. Flash-and-die = native-module failure (capture error and stop).
4. Wizard step 1 (Platform & Species): pick a platform + species; Next enables.
5. Wizard step 2 (Analytes): pick a premix panel OR toggle ≥1 single analyte; sidebar updates.
6. Wizard step 3 (Calculations): enter sample count (e.g. 40); plate grid auto-fills; itemized volumes display.
7. Wizard step 4 (Document & Save): fill all fields per CONTEXT.md (Request 9421, your name, Operator from dropdown, today's date, Sample Type Supernatant, Dilution Factor 5, Hamilton 1, Run Plate Position 1, Standard Position 1, Trough Position 1, Comments "smoke test run"); click Save; expect auto-nav to step 5 with no toast.
8. Wizard step 5 (Finalized Run View): expect metadata header showing Request 09421 (5-digit padded) + platform/species/panel; PrepSheet + ReagentChecklist + BeadRegionList sections; plate grid(s) read-only; plate label "Request 09421 — Plate 1 of N"; click Print → Windows print dialog appears; cancel.
9. Edit-warning modal: click Back; expect modal "This run is saved. Going back to edit will modify the saved record. Continue?" with "Keep viewing" (primary) and "Edit anyway" (destructive); click "Edit anyway" → step 4.
10. Edit + re-save (UPDATE not INSERT): change Comments to "edited after save"; Save; navigate to step 5; back to step 4 via warning; expand RunList; expect EXACTLY ONE row for Request 09421 (proves UPDATE).
11. Full close (Alt+F4 or X); confirm process exits.
12. Relaunch; navigate to step 4 → expand Past Runs; expect Request 09421 still present with edited comment; click Load; expect dirty-check modal only if form has unsaved changes; load completes; wizard populates with stored state; plate grid matches saved layout exactly (D-02 round-trip).
13. Operators Manage CRUD: top-nav Manage → Operators section → add "TestUser", rename one seeded name, soft-delete (or hide) another; return to wizard step 4; operator dropdown reflects all changes; relaunch app → operator changes persist.
14. "Start New Run" on Finalized View: click; all stores reset; wizard returns to step 1; operator dropdown + RunList still populated (app-wide state).

**On failure:** capture (a) which step, (b) exact error text or screenshot, (c) whether app crashed; do NOT attempt fixes from the Windows side; regroup on macOS.

**On success:** record approval (Github comment / phase-verifier sign-off); requirements PERS-01, PERS-02, DOCM-01 transition from "code-complete-and-packaged" to "runtime-confirmed."

## Requirements Traceability (this plan)

| Requirement | Status after 04-03 | Notes |
|-------------|---------------------|-------|
| PERS-01 (saves run records to local storage) | Code-complete + packaged; runtime pending | Requires HUMAN-UAT step 7 (Save) + step 10 (UPDATE) + step 12 (restart-persistence). |
| PERS-02 (loads previously saved run records) | Code-complete + packaged; runtime pending | Requires HUMAN-UAT step 12 (Load round-trip). |
| DOCM-01 (captures full run metadata) | Code-complete + packaged; runtime pending | Form fields exercised in HUMAN-UAT step 7. |

**D-25 (functional-only build):** Satisfied — both x64 and arm64 NSIS installers produced and statically verified. Operator can install + launch with no dev tools.

**D-26 (deferred polish: appId / icon / signing / auto-updater):** All four explicitly untouched per plan instruction. Windows SmartScreen click-through expected and accepted. Auto-updater not invoked at runtime (placeholder publish URL only).

## Files Modified

- `electron-builder.yml` — added explicit `win.target` block with `arch: [x64, arm64]`; added `${arch}` to `nsis.artifactName` (commit 6162adc).

## Issues Encountered

- **Apple Silicon implicit-host-arch default produces arm64-only installers** — caught at Task 1 config audit, fixed before the build pass (no wasted build cycles). Fix locked into electron-builder.yml so future cross-compiles from any Mac architecture produce the full target matrix.
- **No Wine setup was needed** — `npm run build:win` from macOS produced both arches without the Wine prompt that sometimes shows up for code-signing tools. Plan was prepared for that case (Task 2 step 1 had a STOP-and-ask gate); did not trigger.

## User Setup Required

**For the operator running the smoke test:**

1. Choose the right installer for the target Windows PC:
   - **Most lab workstations:** `dist/immunoplex-assay-calculator-0.5.0-x64-setup.exe` (87 MB, Intel/AMD).
   - **ARM Windows / Surface ARM:** `dist/immunoplex-assay-calculator-0.5.0-arm64-setup.exe` (92 MB).
   - **Unsure / want one installer that just works:** `dist/immunoplex-assay-calculator-0.5.0-setup.exe` (179 MB universal — both arch payloads embedded).
2. Transfer to the Windows PC via your usual mechanism (per CONTEXT.md D-27, distribution mechanism is out of scope).
3. Run the 14-step smoke test (verbatim list above).
4. Report back with either "approved" or the verbatim failure details.

## Next Phase Readiness

- All Phase 4 implementation work is complete on `dev/v1-01` and packaged for Windows distribution.
- Phase verification can proceed; the verifier may surface the HUMAN-UAT smoke test as a phase-level gap requiring sign-off before the v1 release tag is cut.
- Once HUMAN-UAT-04-03-01 returns "approved," the v0.6.0 release workflow (`.claude/release.md`) can run version-bump + tag + GitHub release with the dist/ artifacts attached.
- If smoke test surfaces a real defect, regroup on macOS — likely follow-on plan in a future phase or a 04-06 hotfix plan.

## Self-Check: PASSED

Verified:
- `[ -f electron-builder.yml ]` — FOUND (modified by commit 6162adc)
- `[ -f .planning/phases/04-run-documentation-persistence-deployment/04-03-SUMMARY.md ]` — FOUND (this file)
- `git log --oneline | grep 6162adc` — FOUND (`chore(04-03): target x64 + arm64 explicitly for Windows NSIS build`)
- `[ -f dist/immunoplex-assay-calculator-0.5.0-x64-setup.exe ]` — FOUND (87 MB)
- `[ -f dist/immunoplex-assay-calculator-0.5.0-arm64-setup.exe ]` — FOUND (92 MB)
- `[ -f dist/immunoplex-assay-calculator-0.5.0-setup.exe ]` — FOUND (179 MB universal)
- `dist/win-unpacked/resources/app.asar.unpacked/node_modules/better-sqlite3/build/Release/better_sqlite3.node` — FOUND
- `dist/win-arm64-unpacked/resources/app.asar.unpacked/node_modules/better-sqlite3/build/Release/better_sqlite3.node` — FOUND
- `dist/win-unpacked/resources/drizzle/migrations/0003_damp_prima.sql` — FOUND
- `dist/win-arm64-unpacked/resources/drizzle/migrations/0003_damp_prima.sql` — FOUND
- All four migrations (0000..0003) present in both `win-unpacked` and `win-arm64-unpacked` resources

**Pending (intentional, not a self-check failure):** HUMAN-UAT-04-03-01 Windows physical workstation smoke test — requires a Windows PC, cannot be self-checked from macOS. Documented in §Gaps / Pending Verification above.

---
*Phase: 04-run-documentation-persistence-deployment*
*Completed (plan closeout): 2026-04-22*
*Pending HUMAN-UAT runtime confirmation on Windows workstation*
