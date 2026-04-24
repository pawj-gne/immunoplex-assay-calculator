---
phase: 06-network-layer-central-server
plan: 04
subsystem: ui
tags: [zustand, react, tailwind, ipc, electron, accessibility]

# Dependency graph
requires:
  - phase: 06-network-layer-central-server
    provides: CONNECTION_STATUS IPC channel, RunRecord.machineName + RunRecord.isOfflineSave fields, transport interface stubs (Plan 06-01 wave 1)
provides:
  - src/renderer/src/stores/networkStore.ts — useNetworkStore Zustand store with optimistic online:true default + setOnline action
  - src/renderer/src/features/network/OfflineBanner.tsx — D-04 full-width yellow banner with verbatim copy, role=status, aria-live=polite
  - src/preload/index.ts — connection.onStatusChange entry on CONNECTION_STATUS push channel (ipcRenderer.on, NOT invoke)
  - src/preload/index.d.ts — ElectronAPI.connection type declaration for renderer typecheck
  - src/renderer/src/App.tsx — OfflineBanner rendered between </header> and <main> at full-width layout level; useEffect subscription to connection.onStatusChange wired to useNetworkStore.setOnline
  - src/renderer/src/features/run/components/RunList.tsx — Source column added (grid-cols-7 → grid-cols-8) with displayRunSource helper and offline-save styling
affects: [06-03-http-transport-offline-queue, 06-05-windows-uat]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "IPC push channel via ipcRenderer.on (vs invoke for request-response) for connection status events"
    - "Zustand store with optimistic default — avoids flash of offline banner on server/local-only machines that never receive a connection:status event"
    - "Inline IIFE in JSX for column-cell logic that needs both string + Tailwind-classed suffix (avoids extra component for a single use)"

key-files:
  created:
    - src/renderer/src/stores/networkStore.ts
    - src/renderer/src/features/network/OfflineBanner.tsx
  modified:
    - src/preload/index.ts (append connection.onStatusChange after operator block)
    - src/preload/index.d.ts (append connection type to ElectronAPI)
    - src/renderer/src/App.tsx (import OfflineBanner + useNetworkStore; insert <OfflineBanner /> between </header> and <main>; add useEffect subscribing to connection.onStatusChange)
    - src/renderer/src/features/run/components/RunList.tsx (grid-cols-7 → grid-cols-8; add displayRunSource helper; add Source column cell with offline-save styling)

key-decisions:
  - "Optimistic online:true default in networkStore avoids flash-of-offline-banner on server and local-only machines (which never receive a connection:status event). Reconnect poller pushes the real state within 5s on client machines."
  - "Inline IIFE in the Source column cell rather than a small SourceCell component — this is the only usage of displayRunSource and the JSX is short; introducing a component would add indirection without reuse benefit."
  - "displayRunSource returns { machineName, isOffline } object (not the previously-prototyped string concatenation) so the offline suffix can carry text-yellow-700 styling on its own <span>. UI-SPEC §Color requires the suffix in yellow-700; concatenated string would force the whole cell into one color."
  - "RunList has only ONE grid-cols-7 occurrence — the per-row grid that renders muted-label + foreground-value pairs inline (no separate header row above the list). Plan's read-carefully note about ALL occurrences was honored; only one updated, no header row exists."
  - "The plan's must_haves §truths line about a header row (\"Source column (8th column) showing machineName ... per UI-SPEC\") refers to the column position, not a separate header-row DOM element. Each row carries its own muted label per existing pattern."

patterns-established:
  - "Push-channel IPC bridge entry shape — connection.onStatusChange uses ipcRenderer.on returning void (no Promise). Future event-driven channels (e.g. file-watcher events, sync notifications) follow this same shape."
  - "Renderer-side connection state subscription pattern — App.tsx holds the single useEffect that wires window.electronAPI.connection.onStatusChange to useNetworkStore.getState().setOnline; downstream components (OfflineBanner, future RunList badges) subscribe to the store, not the IPC channel directly."

requirements-completed: [NET-02, NET-03]

# Metrics
duration: 12min
completed: 2026-04-24
---

# Phase 6 Plan 04: Renderer Offline Banner & Conflict Display Summary

**Renderer-side network state plumbing — Zustand network store + D-04 OfflineBanner + connection IPC bridge in preload + RunList Source column for D-02 conflict display**

## Performance

- **Duration:** ~12 min (start to last task commit; setup overhead from initial worktree path discovery is excluded)
- **Started:** 2026-04-24 (Wave 2 parallel with Plan 06-03)
- **Completed:** 2026-04-24
- **Tasks:** 2
- **Files created:** 2
- **Files modified:** 4

## Accomplishments

- D-04 OfflineBanner shipped with the verbatim copy from 06-CONTEXT.md (`Working offline — saves stored locally`), role="status" + aria-live="polite" for assistive tech, and the full-width yellow palette (`bg-yellow-50 border-b border-yellow-200 text-yellow-800`) from 06-UI-SPEC.md. Placed between `</header>` and `<main>` so it spans the viewport (outside the `max-w-4xl mx-auto` wizard container) — impossible to overlook per D-04.
- networkStore (Zustand) with `online: true` optimistic default + `setOnline(online)` action. Server and local-only machines never receive a `connection:status` event; the optimistic default keeps the banner hidden in those modes without the renderer needing to know which mode is active.
- preload bridge connection entry uses `ipcRenderer.on` against the existing `CONNECTION_STATUS` channel (`connection:status`) shipped in Plan 06-01. This is a one-way push channel — calling `invoke` would have been wrong because there's no request side. TypeScript declaration in `src/preload/index.d.ts` updated so renderer code typechecks against `window.electronAPI.connection.onStatusChange`.
- App.tsx subscribes to the push: a single `useEffect(() => { window.electronAPI.connection.onStatusChange((online) => useNetworkStore.getState().setOnline(online)) }, [])`. Downstream components subscribe to the store, not the IPC channel — keeps the IPC seam in one place and lets future components reuse the connection state without re-subscribing.
- RunList Source column (D-02 conflict display): grid expanded from 7 to 8 columns; `displayRunSource(run)` helper extracts `{ machineName, isOffline }`; cell renders machine name for online saves and `machineName + " — offline save"` (suffix in `text-yellow-700` per UI-SPEC §Color, matching the OfflineBanner palette) for offline saves. Pre-Phase-6 rows (`machineName === null`) render an empty cell (no placeholder per UI-SPEC §Copywriting).

## Task Commits

Each task was committed atomically on the worktree branch `worktree-agent-af1521c9`:

1. **Task 1: networkStore + OfflineBanner + preload bridge + App.tsx wiring** — `5ce7ae9` (feat)
2. **Task 2: RunList Source column for D-02 conflict display** — `a378d9d` (feat)

The plan-metadata commit (this SUMMARY) is part of the orchestrator's parallel-merge workflow.

## Files Created/Modified

### Created

- `src/renderer/src/stores/networkStore.ts` — Zustand store; `useNetworkStore` exports `online: boolean` state and `setOnline(online: boolean)` action. Optimistic default `online: true`.
- `src/renderer/src/features/network/OfflineBanner.tsx` — D-04 banner component; reads `online` from `useNetworkStore`, returns `null` when online, renders the full-width yellow banner with role/aria attributes when offline. Verbatim D-04 copy.

### Modified

- `src/preload/index.ts` — appended `connection.onStatusChange` entry (uses `ipcRenderer.on` not `invoke`; `CONNECTION_STATUS` channel from `IPC_CHANNELS` already imported)
- `src/preload/index.d.ts` — appended `connection: { onStatusChange: (cb: (online: boolean) => void) => void }` to `ElectronAPI` for renderer typecheck
- `src/renderer/src/App.tsx` — added imports (`useNetworkStore`, `OfflineBanner`); inserted `<OfflineBanner />` between `</header>` and `<main>` at the layout level (outside `max-w-4xl` wizard container); added a new `useEffect` subscribing to `connection.onStatusChange` that calls `useNetworkStore.getState().setOnline(online)`
- `src/renderer/src/features/run/components/RunList.tsx` — `grid-cols-7` → `grid-cols-8` (single occurrence — RunList renders muted-label + foreground-value pairs inline per row, no separate header row above the list); added `displayRunSource(run): { machineName, isOffline }` helper; added Source column 8th cell with offline-save styling

## Decisions Made

- **Optimistic `online: true` default** — server and local-only machines never receive a `connection:status` event; the optimistic default keeps the OfflineBanner hidden by default, avoiding a flash-of-offline-banner on app startup before the reconnect poller's first health check completes (~5s on client machines).
- **Inline IIFE in the Source column cell** rather than extracting a `SourceCell` subcomponent — this is the only call site of `displayRunSource`, the JSX body is short, and an IIFE keeps the rendering colocated with its column position. A component would add indirection without reuse benefit.
- **`displayRunSource` returns `{ machineName, isOffline }` (not a pre-concatenated string)** — UI-SPEC §Color requires the offline-save suffix in `text-yellow-700` while the machine name stays in `text-[var(--color-foreground)]`. A concatenated string would force the whole cell into one color or require parsing the string back apart in the JSX. The object shape lets the JSX wrap just the suffix in a `<span className="text-yellow-700">`.
- **RunList has ONE grid-cols-7 occurrence**, not two — the plan noted "ALL occurrences (header + data rows)" but RunList does not render a separate header row above the data list. Each row carries its own muted-label + foreground-value pairs inline (`<div className="text-[var(--color-muted)]">Request #</div>` co-located with the value). Only the per-row grid container needed updating.
- **Single useEffect for connection subscription** in App.tsx (not in OfflineBanner directly) — keeps the IPC seam in one place. Downstream components (OfflineBanner now, possibly future status badges) subscribe to the Zustand store, not the IPC channel. Future re-subscriptions won't multiply listener registrations.

## Deviations from Plan

None — plan executed exactly as written. Both tasks landed on the first attempt; no Rule 1/2/3 fixes needed; no Rule 4 architectural decisions surfaced.

The plan's note about "ALL occurrences of grid-cols-7" was honored as written — verified by grepping; the file contains only one occurrence (per-row grid), and after the change `grep grid-cols-7` returns nothing. This is not a deviation, just a clarification: the plan's defensive language anticipated a possible second occurrence that doesn't exist in the current RunList structure.

## Issues Encountered

- **Worktree-vs-main-repo path confusion at startup:** The agent's CWD was the worktree (`/Users/pawj/Lab_Dev/immunoplex-assay-calculator/.claude/worktrees/agent-af1521c9`), but the orchestrator-supplied paths in the prompt context (e.g., `.planning/phases/06-network-layer-central-server/06-04-PLAN.md`) were ambiguous between the main repo and the worktree. The first Task 1 attempt mistakenly Read/Wrote files at `/Users/pawj/Lab_Dev/immunoplex-assay-calculator/...` (main repo root, not the worktree subpath). On detecting that the commit had landed on `dev/v1-01` (main repo's branch) instead of `worktree-agent-af1521c9`, the agent: (a) restored the `dev/v1-01` ref in the main repo via `git update-ref` to the original `dbb7406`, (b) used `git checkout HEAD --` on the specific files modified to restore them in the main repo's working tree, (c) redid Task 1 in the actual worktree directory at `.claude/worktrees/agent-af1521c9/...`. The unreferenced commit `16042f0` from the first attempt remains in the git object database (orphaned, no ref) and will be garbage-collected normally. No data lost; main repo's `dev/v1-01` is unchanged from its original state. Worktree branch `worktree-agent-af1521c9` carries the correct commits (5ce7ae9, a378d9d). The destructive_git_prohibition's `git reset --hard` ban (outside the worktree_branch_check window) was respected throughout — no `git clean`, `git rm`, or blanket `git checkout -- .` was used.
- **Worktree's node_modules empty:** the worktree was scaffolded without `npm install`. Tests and typecheck were run using the main repo's binaries (`/Users/pawj/Lab_Dev/immunoplex-assay-calculator/node_modules/.bin/vitest`, `.../tsc`). Vitest auto-detected the worktree CWD and ran against worktree files. All 30 tests pass; both typecheck configs (node + web) pass clean.

## User Setup Required

None — no external service configuration required. Renderer-only plan; no auth, no env vars, no secrets. Phase 6 v1 has no auth per RESEARCH §Security Domain.

## Known Stubs

None introduced by this plan.

The renderer's OfflineBanner depends on `mainWindow.webContents.send('connection:status', ...)` calls from Plan 06-03's `httpTransport.ts` reconnect poller. Until Plan 06-03 lands, the banner will never appear (optimistic default `online: true` holds). This is expected Wave 2 → Wave 2 hand-off behavior between Plans 06-03 and 06-04 running in parallel; both must merge for the offline indicator to function end-to-end. The `RunRecord.machineName` and `RunRecord.isOfflineSave` fields populating the RunList Source column are similarly written by Plan 06-03's `httpTransport.create()`/offline-queue path; pre-Phase-6 rows show empty Source cells until Plan 06-03 starts setting these fields.

## Threat Flags

None — no new security-relevant surface introduced beyond what the plan's `<threat_model>` already enumerates (T-06-13 IPC tampering, T-06-14 hostname disclosure, T-06-15 XSS via React text-children rendering — all carried through unchanged). React escapes `run.machineName` as text children automatically (T-06-15 mitigated as planned).

## Next Phase Readiness

- **Plan 06-03 ready:** OfflineBanner mounts on app load and listens for `connection:status` push events. When 06-03's `httpTransport.startReconnectPoller` fires `mainWindow.webContents.send(CONNECTION_STATUS, { online: false })`, the renderer pipeline (preload bridge → useEffect → networkStore.setOnline → OfflineBanner re-render) is end-to-end functional. No additional renderer work needed for 06-03 to light up.
- **Plan 06-05 (Windows UAT) ready:** Visual UAT items can include verifying (a) the offline banner appears within ~5s of disconnecting from the network on a client machine, (b) the Source column displays the correct hostname for each saved run, and (c) the offline-save suffix is visually distinct (yellow-700) from online saves. UI-SPEC §Color and §Copywriting now have shipped renderer to verify against.
- **No blockers.** No concerns.

## Self-Check: PASSED

- `src/renderer/src/stores/networkStore.ts` — FOUND
- `src/renderer/src/features/network/OfflineBanner.tsx` — FOUND
- Modified `src/preload/index.ts` — connection.onStatusChange present (greppable)
- Modified `src/preload/index.d.ts` — connection type present (greppable)
- Modified `src/renderer/src/App.tsx` — OfflineBanner + useNetworkStore + onStatusChange all present (greppable)
- Modified `src/renderer/src/features/run/components/RunList.tsx` — grid-cols-8 + displayRunSource + text-yellow-700 all present; no grid-cols-7 remaining
- Commit `5ce7ae9` (Task 1) — FOUND in `git -C <worktree> log`
- Commit `a378d9d` (Task 2) — FOUND in `git -C <worktree> log`
- `npm test` (via worktree-aware vitest) — 30/30 passing
- `tsc --noEmit -p tsconfig.web.json` — clean
- `tsc --noEmit -p tsconfig.node.json` — clean

---
*Phase: 06-network-layer-central-server*
*Completed: 2026-04-24*
