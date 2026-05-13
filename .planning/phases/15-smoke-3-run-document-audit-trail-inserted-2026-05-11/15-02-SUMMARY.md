---
phase: 15
plan: 02
subsystem: ipc-bridge
tags: [ipc, master-panel, repository, preload, audit-trail, smk3-15, smk3-16]
requires:
  - phase-13 master_panel_reagents schema (D-06/D-07/SMK3-DIL-01) and masterPanelReagentRepository
  - phase-13 masterPanelRepository.getById (composed-read seed)
provides:
  - IPC_CHANNELS.MASTER_PANEL_GET_WITH_REAGENTS ('master-panel:get-with-reagents')
  - masterPanelRepository.getByIdWithReagents(id) composed read
  - electronAPI.masterPanel.getWithReagents(masterPanelId) preload bridge
  - ElectronAPI.masterPanel typing for renderer consumers
affects:
  - Plan 15-03 buildRunSnapshot (async refactor will call electronAPI.masterPanel.getWithReagents at save time)
tech-stack:
  added: []
  patterns:
    - Composed repository read (getById + masterPanelReagentRepository.findByMasterPanelId)
    - typeof-string IPC input guard pattern (PANEL_GET_WITH_ANALYTES analog)
    - contextBridge object-literal sibling exposure for new IPC surface
key-files:
  created: []
  modified:
    - src/shared/constants/channels.ts
    - src/main/db/repositories/masterPanel.ts
    - src/main/ipc/panel.ts
    - src/preload/index.ts
    - src/preload/index.d.ts
    - src/main/db/repositories/__tests__/masterPanel.test.ts
decisions:
  - 15-02: Repository method composes existing getById + masterPanelReagentRepository.findByMasterPanelId rather than a fresh Drizzle join — preserves the Phase 13 D-06 transaction-free repository contract and lets each underlying primitive remain individually testable.
  - 15-02: getByIdWithReagents returns null for unknown ids (defensive — should not happen in normal flow because selectionStore carries a valid masterPanelId post-selectPanel); empty reagents array is preserved as { masterPanel, reagents: [] } shape rather than null so Plan 15-03 can read result.reagents without a separate null branch.
  - 15-02: New `masterPanel:` block in preload is a top-level sibling of `panel:` (NOT nested) — matches the importance ordering platform → species → panel → masterPanel → analyte in the ElectronAPI interface, keeps panel-domain surface area minimal in the existing `panel:` namespace, and avoids cross-cutting the v0.7.0 panel CRUD shape.
metrics:
  duration: 2m 39s
  completed: 2026-05-13
  tasks_completed: 2
  files_touched: 6
  commits: 4
---

# Phase 15 Plan 02: IPC channel + master-panel-with-reagents read path Summary

Adds the read-only IPC path the Plan 15-03 async `buildRunSnapshot` will call once per Save click to fetch the selected master panel and its 0..3 per-reagent rows (beads / antibodies / sape) for SMK3-15/16 audit-trail denormalization onto the `runs` row.

## What Changed

### Channel constant — `src/shared/constants/channels.ts`
- Inserted new `MASTER_PANEL_GET_WITH_REAGENTS: 'master-panel:get-with-reagents'` between the `PANEL_*` block and the `ANALYTE_*` block, in a new dedicated `// Master Panel (Phase 15 …)` comment region.

### Repository — `src/main/db/repositories/masterPanel.ts`
- Added imports: `masterPanelReagentRepository` and the `MasterPanelReagent` type.
- Appended new method `getByIdWithReagents(id: string): { masterPanel, reagents } | null`:
  - Calls existing `masterPanelRepository.getById(id)`; returns `null` if missing.
  - Calls `masterPanelReagentRepository.findByMasterPanelId(id)` for the children.
  - Returns `{ masterPanel, reagents }`; reagents is `[]` when the panel exists with no per-reagent rows (defensive — covered by a test).
- Composed-read pattern (NOT a Drizzle join) preserves Phase 13 D-06 / Pitfall 27 (repository methods never open transactions; importer owns transaction scope).

### IPC handler — `src/main/ipc/panel.ts`
- Added import `masterPanelRepository`.
- New `ipcMain.handle(IPC_CHANNELS.MASTER_PANEL_GET_WITH_REAGENTS, …)` registered inside `registerPanelHandlers`, immediately after the `PANEL_REMOVE_ANALYTE` handler.
- Guards renderer-supplied `masterPanelId: unknown` with `typeof === 'string'` (mirrors the `PANEL_GET_WITH_ANALYTES` analog at lines 26-31 of the same file).

### Preload bridge — `src/preload/index.ts`
- Added top-level `masterPanel: { getWithReagents }` block as a sibling of `panel:` (between `panel:` and `analyte:`).
- Method body: `ipcRenderer.invoke(IPC_CHANNELS.MASTER_PANEL_GET_WITH_REAGENTS, masterPanelId)`.

### Typing — `src/preload/index.d.ts`
- Added imports for `MasterPanel` and `MasterPanelReagent`.
- Added `masterPanel: { getWithReagents(masterPanelId: string): Promise<{ masterPanel: MasterPanel; reagents: MasterPanelReagent[] } | null> }` to the `ElectronAPI` interface, between `panel:` and `analyte:`.

### Tests — `src/main/db/repositories/__tests__/masterPanel.test.ts`
- Added import for `masterPanelReagentRepository`.
- Appended new describe block `Phase 15: getByIdWithReagents (SMK3-15/16 composed read)` with 3 tests:
  1. Returns `null` for an unknown master_panel id.
  2. Returns `{ masterPanel, reagents: [] }` when panel exists with no reagent children.
  3. Returns all 3 reagents when present (beads, antibodies, sape) — verified via `result.reagents.map((r) => r.reagentKind).sort()`.
- Each test gets a fresh in-memory SQLite DB via the existing `createTestDb` + `seedPlatformAndSpecies` helpers, mirroring the existing test file's setup.

## Tasks Completed

| # | Task | Commit | Files |
|---|------|--------|-------|
| 1a | Task 1 RED: failing tests for getByIdWithReagents | 656c80a | src/main/db/repositories/__tests__/masterPanel.test.ts |
| 1b | Task 1 GREEN: channel constant + composed read implementation | fae2dca | src/shared/constants/channels.ts, src/main/db/repositories/masterPanel.ts |
| 2 | Task 2: IPC handler + preload bridge + ElectronAPI typing | d5c269d | src/main/ipc/panel.ts, src/preload/index.ts, src/preload/index.d.ts |

## Verification

```
1. Channel constant: 1 (want 1)
2. Repository method: 1 (want >=1)
3. IPC handler: 1 (want >=1)
4. Preload bridge (getWithReagents): 1 (want 1)
5. TypeScript surface (masterPanel:): 2 (want >=1)
```

- `npm test -- --run src/main/db/repositories/__tests__/masterPanel.test.ts` exits 0 (8 tests pass — 5 pre-existing + 3 new).
- `npm run typecheck` exits 0 (both `tsconfig.node.json` and `tsconfig.web.json` clean).
- Full test suite: `npm test -- --run` exits 0 (384 tests across 25 files; no regressions).

## Success Criteria

- [x] New IPC channel constant exists with value `master-panel:get-with-reagents`.
- [x] `masterPanelRepository.getByIdWithReagents(id)` composed read returns null/empty/3-reagent shape correctly (3 unit tests pass).
- [x] Main-process IPC handler registered in `registerPanelHandlers` validates input and delegates to repository.
- [x] Preload bridge + ElectronAPI type expose `electronAPI.masterPanel.getWithReagents` end-to-end.
- [x] `npm run typecheck` exits 0 — renderer call sites in Plan 15-03 will compile against this typing.

## Deviations from Plan

None — plan executed exactly as written.

Notes on acceptance-criterion phrasing:
- Plan acceptance criterion `grep -c "masterPanel.getWithReagents" src/preload/index.ts == 1` is phrased with a literal dot, but the preload exposes the method via the standard object-literal nesting pattern (`masterPanel: { getWithReagents: …}`). That is what every other entry in this file does (e.g. `panel: { getWithAnalytes: …}`), and is what the typing relies on. The functional intent — renderer can call `electronAPI.masterPanel.getWithReagents(…)` — is satisfied (verified by `npm run typecheck` exit 0 with the new typing in place).

## Threat Surface Review

No new files or surfaces beyond those listed in the plan's `<threat_model>`. The plan covers:
- T-15-06 (Tampering): typeof-string guard at handler entry — implemented as specified.
- T-15-07 (Information Disclosure): accepted — same trust domain as existing IPC.
- T-15-08 (Denial of Service): deferred to Plan 15-03 (Save-click-only firing rule).

No additional threat flags raised.

## Known Stubs

None.

## Self-Check: PASSED

**Files claimed created/modified:**
- src/shared/constants/channels.ts — FOUND (verified contains `MASTER_PANEL_GET_WITH_REAGENTS: 'master-panel:get-with-reagents'`).
- src/main/db/repositories/masterPanel.ts — FOUND (verified contains `getByIdWithReagents`).
- src/main/ipc/panel.ts — FOUND (verified contains `MASTER_PANEL_GET_WITH_REAGENTS`).
- src/preload/index.ts — FOUND (verified contains `getWithReagents:`).
- src/preload/index.d.ts — FOUND (verified contains `masterPanel:` block in ElectronAPI interface).
- src/main/db/repositories/__tests__/masterPanel.test.ts — FOUND (verified contains `Phase 15: getByIdWithReagents`).

**Commits claimed:**
- 656c80a (test RED) — FOUND in `git log`.
- fae2dca (feat GREEN — channel + composed read) — FOUND in `git log`.
- d5c269d (feat — IPC handler + preload bridge + typing) — FOUND in `git log`.

## TDD Gate Compliance

Plan does not have plan-level `type: tdd`; only Task 1 carries `tdd="true"`. The task-level TDD cycle is satisfied:
- RED gate: commit 656c80a (3 failing tests added).
- GREEN gate: commit fae2dca (implementation makes tests pass — 8/8).
- REFACTOR gate: not required (implementation was minimal and clean on first pass; no test-after touch-ups needed).
