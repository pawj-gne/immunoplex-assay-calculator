---
phase: 6
slug: network-layer-central-server
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-04-24
---

# Phase 6 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest 2.1.9 |
| **Config file** | `vitest.config.ts` (root — installed in Phase 5) |
| **Quick run command** | `npm test` |
| **Full suite command** | `npm test` |
| **Estimated runtime** | ~30 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npm test`
- **After every plan wave:** Run `npm test`
- **Before `/gsd-verify-work`:** Full suite must be green + HUMAN-UAT-06 (Windows only)
- **Max feedback latency:** ~30 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 06-01-01 | 01 | 1 | NET-02 | — | loadConfig() returns null for missing file (D-03 safe default) | unit | `npm test -- --grep "loadConfig"` | ❌ Wave 0 | ⬜ pending |
| 06-01-02 | 01 | 1 | NET-02 | — | loadConfig() parses serverUrl + isServer correctly | unit | `npm test -- --grep "loadConfig"` | ❌ Wave 0 | ⬜ pending |
| 06-02-01 | 02 | 1 | NET-01 | — | Express app factory exposes /api/health, /api/runs, /api/operators routes | integration | `npm test -- --grep "express server"` | ❌ Wave 0 | ⬜ pending |
| 06-02-02 | 02 | 1 | NET-01 | — | POST /api/runs returns 200 on duplicate id (idempotency for queue flush) | integration | `npm test -- --grep "idempotency"` | ❌ Wave 0 | ⬜ pending |
| 06-03-01 | 03 | 2 | NET-03 | — | Offline: run save writes to offline_queue table, not central DB | unit | `npm test -- --grep "offline queue"` | ❌ Wave 0 | ⬜ pending |
| 06-03-02 | 03 | 2 | NET-04 | — | Queue flush sends rows in insertion order; removes confirmed rows | unit | `npm test -- --grep "flush"` | ❌ Wave 0 | ⬜ pending |
| 06-03-03 | 03 | 2 | NET-04 | — | 409 response from server removes item from queue (no retry) | unit | `npm test -- --grep "flush"` | ❌ Wave 0 | ⬜ pending |
| 06-04-01 | 04 | 2 | NET-05 | — | Server mode: run save calls repository directly (no fetch call) | unit | `npm test -- --grep "server mode"` | ❌ Wave 0 | ⬜ pending |
| 06-05-01 | TBD | 1 | NET-01 | — | Migration 0005: offline_queue table created; machineName + isOfflineSave on runs | unit | `npm test -- --grep "migration 0005"` | ❌ Wave 0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `src/main/config/__tests__/appConfig.test.ts` — loadConfig() unit tests (NET-02)
- [ ] `src/main/__tests__/expressServer.test.ts` — Express route integration tests (NET-01)
- [ ] `src/main/transport/__tests__/httpTransport.test.ts` — offline queue, flush, mode-switch tests (NET-03/04/05)
- [ ] `src/main/db/__tests__/migration.test.ts` extended — migration 0005: offline_queue + machineName + isOfflineSave columns (NET-01 schema)

Note: vitest infrastructure exists from Phase 5. No new framework install needed.

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Two machines see identical Past Runs list after sync | NET-01 | Requires two physical Windows lab PCs on same LAN | Install server + client .exe; create run on client; confirm it appears on server machine's Past Runs |
| "Working offline" banner appears when server unreachable | NET-03 | UI rendering requires Windows Electron runtime | Stop server process; confirm yellow banner appears within 10s on client machine |
| Offline saves flush automatically on reconnect | NET-04 | Requires two physical machines + network interruption simulation | Save run offline; restart server; confirm run appears on server within one poll interval (~5s) |
| Windows Firewall "Allow access" prompt on first server bind | — | Windows-only behavior | On server machine first launch: confirm Firewall dialog appears and "Allow access" is clicked |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 30s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
