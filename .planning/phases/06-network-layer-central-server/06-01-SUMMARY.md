---
phase: 06-network-layer-central-server
plan: 01
subsystem: infra
tags: [express, cors, drizzle, sqlite, electron, transport, ipc]

# Dependency graph
requires:
  - phase: 04-run-documentation-persistence-deployment
    provides: runs/operators schema, IPC handlers, repository pattern, app.getPath('userData') usage
provides:
  - express@4.22.1 + cors@2.8.6 in dependencies; @types/express@5.0.6 + @types/cors@2.8.19 in devDependencies
  - schema.ts offline_queue table + runs.machineName/runs.isOfflineSave columns + OfflineQueueItem/OfflineQueueInsert types
  - drizzle/migrations/0005_worried_mordo.sql (CREATE TABLE offline_queue + ALTER TABLE runs ADD machine_name + is_offline_save)
  - src/main/config/appConfig.ts — loadConfig() reading userData/config.json with safe-null fallback (D-03)
  - src/main/db/clientLocal.ts — separate immunoplex-local.db init for client-mode offline fallback (D-07)
  - src/main/transport/index.ts — RunTransport / OperatorTransport interfaces, initTransport factory, getRunTransport / getOperatorTransport accessors
  - src/main/transport/localTransport.ts — direct-repository implementation used in server + local-only modes (D-09)
  - src/main/server/expressServer.ts — startExpressServer() stub for Plan 06-02
  - src/main/index.ts — three-branch startup (local-only / server / client) with loadConfig as first whenReady action; createWindow() now returns BrowserWindow
  - src/shared/types/run.ts — RunRecord extended with machineName + isOfflineSave (transport-set; not in RunCreate/RunUpdate)
  - src/shared/constants/channels.ts — CONNECTION_STATUS IPC channel constant
  - Wave 0 test scaffolds — 5 appConfig tests + 4 migration 0005 tests, all green
affects: [06-02-express-server, 06-03-http-transport-offline-queue, 06-04-renderer-offline-banner-conflict-display, 06-05-windows-uat]

# Tech tracking
tech-stack:
  added: [express@4.22.1, cors@2.8.6, @types/express@5.0.6, @types/cors@2.8.19]
  patterns:
    - Lazy module require (require('./httpTransport')) to allow forward-reference to a Plan 06-03 module without breaking the build
    - Three-branch startup gated on loadConfig() return (null / isServer:true / isServer:false)
    - Module-level transport singletons swapped at startup via initTransport(mode)
    - Mirror-and-rename DB client pattern (clientLocal.ts replicates client.ts exactly with renamed exports + distinct db filename)

key-files:
  created:
    - src/main/config/appConfig.ts
    - src/main/db/clientLocal.ts
    - src/main/transport/index.ts
    - src/main/transport/localTransport.ts
    - src/main/server/expressServer.ts
    - drizzle/migrations/0005_worried_mordo.sql
    - drizzle/migrations/meta/0005_snapshot.json
    - src/main/config/__tests__/appConfig.test.ts
  modified:
    - src/main/db/schema.ts (offline_queue table + runs.machineName/runs.isOfflineSave + type exports)
    - src/main/index.ts (three-branch startup; createWindow returns BrowserWindow)
    - src/shared/types/run.ts (RunRecord + machineName + isOfflineSave)
    - src/shared/constants/channels.ts (CONNECTION_STATUS)
    - src/main/db/__tests__/migration.test.ts (4 new 0005 tests)
    - drizzle/migrations/meta/_journal.json (drizzle-kit appended 0005 entry)
    - package.json + package-lock.json (express + cors + types)

key-decisions:
  - "Pin express@4.22.1 (not v5) per RESEARCH anti-pattern — npm install initially pulled v5.2.1, downgraded explicitly"
  - "@types/express@5.0.6 used with express@4 — plan-specified, basic Request/Response typings stable across v4/v5"
  - "Lazy require for httpTransport in initTransport — file does not exist until Plan 06-03; wrapped in try/catch with degraded local fallback so build stays green and runtime is non-fatal"
  - "startReconnectPoller stub placed in transport/index.ts (not as separate file) so index.ts has a single import surface from transport"
  - "expressServer.ts created as no-op stub (not omitted) so index.ts startup branch wiring is in final shape now — Plan 06-02 only fills the body"
  - "afterEach restoreAllMocks + beforeEach re-establishment pattern in appConfig.test.ts — vi.fn() mockReturnValue resets on restore, so per-test re-establishment is required for stable mocks"
  - "DEFAULT false (literal) accepted in is_offline_save migration SQL — matches established Drizzle/SQLite pattern from migration 0003 (request_override_ad_hoc, operators.active); INSERT defaults still resolve to 0"
  - "Migration 0005 not manually applied to immunoplex.db on dev macOS — file did not exist; runMigrations() will apply it on first launch, which is the expected dev path"

patterns-established:
  - "Transport interface as the IPC-handler-to-data-layer seam: handlers call getRunTransport().X(), never repositories directly (Plan 06-02+ wires this end-to-end)"
  - "config.json absence = local-only mode (no prompts, no fallback prompts) — D-03 enforced in loadConfig() returning null on any read/parse failure"
  - "Distinct local DB filename (immunoplex-local.db) on client machines — prevents collision if a client is later promoted to server"

requirements-completed: [NET-01, NET-02, NET-05]

# Metrics
duration: 9min
completed: 2026-04-24
---

# Phase 6 Plan 01: Network Layer Foundation Summary

**Three-mode startup branching (local-only / server / client) with transport interface seam, offline_queue schema, and provenance columns ready for Plan 06-02 (Express) and Plan 06-03 (HTTP transport)**

## Performance

- **Duration:** ~9 min
- **Started:** 2026-04-24T21:46:50Z (approximate — STATE.md last_updated 21:46:27)
- **Completed:** 2026-04-24T21:55:57Z
- **Tasks:** 3
- **Files created:** 8 (5 source, 1 migration SQL, 1 migration snapshot, 1 test)
- **Files modified:** 7

## Accomplishments

- Migration 0005 generated and verified — `offline_queue` table + `runs.machineName` (nullable, for D-02 conflict display) + `runs.isOfflineSave` (NOT NULL boolean, defaults to false). Applies cleanly to in-memory test DB; will auto-apply to immunoplex.db on next app launch via existing runMigrations().
- Three-branch startup wired in `src/main/index.ts`: `loadConfig() === null` → local-only (D-03); `config.isServer === true` → central DB + Express; otherwise → client mode with `immunoplex-local.db` and HTTP transport. `createWindow()` now returns `BrowserWindow` so Plan 06-03's reconnect poller can hold a reference.
- Transport seam established: `RunTransport` and `OperatorTransport` interfaces in `src/main/transport/index.ts`, with `localTransport` (direct repository delegation) as the default. `initTransport('http', serverUrl)` lazily requires `httpTransport` (created by Plan 06-03) and falls back to local with a console warning if absent — keeps the build green during the wave.
- `RunRecord` extended with `machineName: string | null` and `isOfflineSave: boolean` in shared types (transport-set fields, not in `RunCreate` / `RunUpdate` — IPC contract unchanged).
- Wave 0 test scaffolds in place: 5 unit tests for `loadConfig()` covering ENOENT, malformed JSON, isServer parsing both ways, and path construction; 4 schema tests for migration 0005 covering offline_queue existence/columns, runs.machine_name nullability, runs.is_offline_save NOT NULL boolean default, and INSERT-time default values. All 23 tests pass.

## Task Commits

1. **Task 1: Install deps + extend schema + migration 0005 + RunRecord + channels** — `f28ab85` (feat)
2. **Task 2: appConfig + clientLocal + transport interface + 3-branch startup** — `0969757` (feat)
3. **Task 3: Wave 0 test scaffolds (appConfig + migration 0005)** — `1dcc9ec` (test)

## Files Created/Modified

### Created

- `src/main/config/appConfig.ts` — `loadConfig()` reads `userData/config.json`, returns `AppConfig | null` (null = local-only D-03)
- `src/main/db/clientLocal.ts` — `initializeLocalDatabase()` / `getLocalDatabase()` / `getLocalSqlite()` / `closeLocalDatabase()` for `immunoplex-local.db` (mirror of client.ts with renamed exports + distinct filename)
- `src/main/transport/index.ts` — `RunTransport` / `OperatorTransport` interfaces, module-level transport singletons, `initTransport(mode, serverUrl?)` factory, `getRunTransport()` / `getOperatorTransport()` accessors, `startReconnectPoller()` stub for Plan 06-03
- `src/main/transport/localTransport.ts` — wraps `runRepository` and `operatorRepository` under transport interface (used by server + local-only modes)
- `src/main/server/expressServer.ts` — `startExpressServer(serverUrl)` stub for Plan 06-02
- `drizzle/migrations/0005_worried_mordo.sql` — generated migration (CREATE TABLE offline_queue + ALTER TABLE runs ADD machine_name + is_offline_save)
- `drizzle/migrations/meta/0005_snapshot.json` — drizzle-kit snapshot (auto-generated)
- `src/main/config/__tests__/appConfig.test.ts` — 5 unit tests for loadConfig (NET-02)

### Modified

- `src/main/db/schema.ts` — added `offlineQueue` table + `machineName` / `isOfflineSave` columns on `runs` + `OfflineQueueItem` / `OfflineQueueInsert` type exports
- `src/main/index.ts` — three-branch startup with loadConfig first; createWindow now returns BrowserWindow; closeLocalDatabase added to window-all-closed cleanup
- `src/shared/types/run.ts` — `RunRecord` extended with `machineName` + `isOfflineSave`
- `src/shared/constants/channels.ts` — added `CONNECTION_STATUS: 'connection:status'`
- `src/main/db/__tests__/migration.test.ts` — 4 new tests under `describe('migration 0005 …')`
- `drizzle/migrations/meta/_journal.json` — drizzle-kit appended 0005 entry
- `package.json` + `package-lock.json` — express, cors, @types/express, @types/cors

## Decisions Made

- **Express v4 explicitly pinned**: Plan and RESEARCH (anti-pattern: "Using Express v5") require v4. Initial `npm install express` resolved to v5.2.1; immediately re-installed `express@4.22.1` and `cors@2.8.6` to match plan spec. Treated as Rule 3 (blocking — wrong dependency version violates documented anti-pattern).
- **@types/express@5.0.6 with express@4 retained**: Plan explicitly specifies `@types/express@5.0.6`. Basic Request/Response/Express typings are stable across the v4/v5 boundary for the patterns we use; kept as plan-specified. Typecheck passes against current code.
- **Lazy `require('./httpTransport')`** wrapped in try/catch in `transport/index.ts` `initTransport`: the file is created by Plan 06-03; wrapping prevents a runtime ReferenceError on client machines if Plan 06-03 hasn't landed when 06-01 ships, and keeps the build green now. Console.warn on fallback so the degradation is observable in logs.
- **`startReconnectPoller` stub added to `transport/index.ts`** (not a separate file): plan note allowed either approach. Keeping stubs co-located with the eventual real implementation simplifies index.ts imports (single `from './transport'` line for both `initTransport` and `startReconnectPoller`).
- **expressServer.ts stub created (not omitted)**: index.ts imports `startExpressServer` in the server-mode branch; without a stub the build would fail. Plan 06-02 only fills the function body.
- **`DEFAULT false` accepted in migration SQL**: Drizzle emits `integer DEFAULT false NOT NULL` (matches established pattern from migration 0003). SQLite stores the literal token but resolves to 0 at INSERT time. Migration 0005 test asserts `dflt_value` is either `'false'` or `'0'` to match either Drizzle output convention.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Pinned express to v4.22.1 (npm initially installed v5.2.1)**

- **Found during:** Task 1 (Install dependencies)
- **Issue:** `npm install express` resolved to express@5.2.1 — but the plan, RESEARCH §Standard Stack, and RESEARCH anti-pattern "Using Express v5" all require v4.22.1 explicitly. Plan 06-02 will write Express v4-style synchronous error handling (try/catch in routes) which behaves differently under Express v5's automatic async error propagation.
- **Fix:** Ran `npm install express@4.22.1 cors@2.8.6` to pin both to plan-specified versions.
- **Files modified:** package.json, package-lock.json
- **Verification:** `grep '"express"' package.json` → `"express": "^4.22.1"`. Build green.
- **Committed in:** f28ab85 (Task 1)

**2. [Rule 1 - Bug] Fixed appConfig.test.ts mock-restoration bug**

- **Found during:** Task 3 (running new test suite)
- **Issue:** The plan's test scaffold used `vi.mock('electron', () => ({ app: { getPath: vi.fn().mockReturnValue('/fake/userData') } }))` followed by `afterEach(() => vi.restoreAllMocks())`. `restoreAllMocks` resets the `vi.fn()` to a no-op (returning undefined), so the second test onward got `app.getPath() === undefined` and `path.join` threw `TypeError: The "path" argument must be of type string. Received undefined` for 4 of the 5 tests.
- **Fix:** Removed `.mockReturnValue('/fake/userData')` from the module-scope `vi.mock` call and added `beforeEach(() => vi.mocked(app.getPath).mockReturnValue('/fake/userData'))` to re-establish the mock value before each test.
- **Files modified:** src/main/config/__tests__/appConfig.test.ts
- **Verification:** All 5 appConfig tests pass; full suite 23/23 green.
- **Committed in:** 1dcc9ec (Task 3) — fix was inline before the commit, not a follow-up.

**3. [Rule 2 - Missing Critical] Added 4th migration 0005 test (INSERT-time default verification)**

- **Found during:** Task 3 (writing migration 0005 tests)
- **Issue:** The plan's three migration 0005 tests verify column existence, nullability, and PRAGMA-reported default value. None verify that the default actually resolves correctly at INSERT time — and the plan asserts `dflt_value === '0'` while Drizzle emits `DEFAULT false`, which PRAGMA reports as the literal `'false'` string. Without an INSERT-time test, a regression that broke the boolean default could pass schema-shape tests.
- **Fix:** Added a 4th test that seeds platforms/species/operators FK parents, INSERTs a run row without explicitly setting machine_name or is_offline_save, then asserts `machine_name === null` and `is_offline_save === 0` after read-back. Also relaxed the PRAGMA default test to accept either `'false'` or `'0'` (both resolve to 0 in SQLite — matches established pattern from migration 0003 for `request_override_ad_hoc` and `operators.active`).
- **Files modified:** src/main/db/__tests__/migration.test.ts
- **Verification:** All 4 migration 0005 tests pass; INSERT-time test catches the actual semantic guarantee.
- **Committed in:** 1dcc9ec (Task 3)

---

**Total deviations:** 3 auto-fixed (1 blocking dependency version, 1 test bug, 1 missing critical test coverage)
**Impact on plan:** All three were necessary for correctness/build-green. No scope creep — all three are within Wave 0 scope.

## Issues Encountered

- **Worktree path resolution / read-before-edit hook noise:** `Read` on `/Users/pawj/Lab_Dev/immunoplex-assay-calculator/<path>` followed by `Edit` on `/Users/pawj/Lab_Dev/immunoplex-assay-calculator/.claude/worktrees/agent-a13e7a4c/<path>` triggered a "READ-BEFORE-EDIT REMINDER" hook even though both paths resolve to the same worktree files. The edits succeeded each time the hook fired; treated as advisory, not a failure. Re-reading the worktree path explicitly silenced subsequent reminders for that file.
- **`npm install` peer-dependency warnings:** Pre-existing eslint version conflict (eslint@9 vs `@typescript-eslint/eslint-plugin@7` requiring eslint@^8.56.0). Warnings only — install completes, all tests pass, no behavioral effect. Out of scope for this plan; logged here for awareness, not deferred (was already present before this plan).

## User Setup Required

None — no external service configuration required. Phase 6 v1 has no auth/secrets per RESEARCH §Security Domain (internal LAN, no V2 Authentication). Future server deployment will need a Windows Firewall "Allow access" click on first Express bind, but that's a Plan 06-05 (UAT) concern.

## Known Stubs

Two stubs intentionally created per the plan, both with explicit owner-plans documented in code comments:

| Stub | File | Owner Plan | Notes |
|------|------|-----------|-------|
| `startExpressServer(_serverUrl)` no-op body | `src/main/server/expressServer.ts` | Plan 06-02 | index.ts startup imports this and calls it in the server-mode branch; Plan 06-02 fills the body with `createExpressApp() + listen(port, '0.0.0.0')`. Until then, `isServer:true` machines start with no HTTP server bound (degraded server mode). |
| `startReconnectPoller(_mainWindow)` no-op body in transport/index.ts | `src/main/transport/index.ts` | Plan 06-03 | index.ts calls this only when `config.isServer === false`; Plan 06-03 implements the setInterval health-check + IPC push. Until then, client-mode machines never detect connection state changes. |
| `initTransport('http', serverUrl)` lazy `require('./httpTransport')` with try/catch fallback | `src/main/transport/index.ts` | Plan 06-03 | If Plan 06-03 hasn't landed when 06-01 ships standalone, client-mode initTransport logs a warning and falls back to localTransport (degraded local-only on a client machine). Plan 06-03 creates `httpTransport.ts` which the lazy require resolves at runtime. |

These stubs are intentional Wave 1 → Wave 2 hand-offs documented in the plan's `<action>` block. None affect Plan 06-01's success criteria — all three are post-startup behaviors gated on plans not yet executed.

## Next Phase Readiness

- Plan 06-02 ready: schema + transport interface + index.ts server-mode branch all in place. 06-02 fills `expressServer.ts` body with `createExpressApp()` + `listen(port, '0.0.0.0')` and adds Express integration tests (in-process supertest or direct fetch).
- Plan 06-03 ready: `RunTransport` / `OperatorTransport` interfaces are the contract httpTransport must satisfy. `offline_queue` table + `runs.machineName` + `runs.isOfflineSave` columns exist for the offline path. `initTransport('http', serverUrl)` lazy require already wired — just creating `src/main/transport/httpTransport.ts` with the right exports lights up the client-mode path automatically.
- Plan 06-04 ready: `CONNECTION_STATUS` channel constant exists for the eventual `mainWindow.webContents.send('connection:status', ...)` call. `RunRecord.machineName` + `RunRecord.isOfflineSave` ready for D-02 Past Runs conflict display.
- No blockers. No concerns.

## Self-Check: PASSED

- `src/main/config/appConfig.ts` — FOUND
- `src/main/db/clientLocal.ts` — FOUND
- `src/main/transport/index.ts` — FOUND
- `src/main/transport/localTransport.ts` — FOUND
- `src/main/server/expressServer.ts` — FOUND
- `drizzle/migrations/0005_worried_mordo.sql` — FOUND
- `src/main/config/__tests__/appConfig.test.ts` — FOUND
- Commit `f28ab85` — FOUND in git log
- Commit `0969757` — FOUND in git log
- Commit `1dcc9ec` — FOUND in git log
- npm test → 23/23 passing

---
*Phase: 06-network-layer-central-server*
*Completed: 2026-04-24*
