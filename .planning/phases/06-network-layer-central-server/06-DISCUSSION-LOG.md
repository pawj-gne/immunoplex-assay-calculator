# Phase 6: Network Layer & Central Server - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-04-24
**Phase:** 06-network-layer-central-server
**Areas discussed:** Conflict on sync-back, First-launch / no config, Offline indicator

---

## Conflict on Sync-Back

| Option | Description | Selected |
|--------|-------------|----------|
| Server wins | Skip the queued item if server already has that request number; notify operator | |
| Client wins | Offline machine's version overwrites server version | |
| Both kept | Append queued item as new row; operator resolves manually | ✓ |

**User's choice:** Both kept

**Follow-up — distinguishing conflicting rows in Past Runs:**

| Option | Description | Selected |
|--------|-------------|----------|
| Machine + timestamp | Each row shows which machine saved it and when | ✓ |
| Timestamp only | Just saved-at timestamp; simpler but less informative | |

**User's choice:** Machine + timestamp

---

## First-Launch / No Config

| Option | Description | Selected |
|--------|-------------|----------|
| Work locally | App starts with standalone local SQLite; fully functional; operator sets up config.json manually | ✓ |
| Prompt for setup | Setup screen on first launch asks server vs client and server URL | |
| Server-only until configured | App disables save/load until config.json exists | |

**User's choice:** Work locally (recommended default)

---

## Offline Indicator

| Option | Description | Selected |
|--------|-------------|----------|
| Persistent banner | Visible banner at top of app: "Working offline — saves stored locally"; disappears on reconnect | ✓ |
| Subtle status dot | Small colored indicator in nav | |
| Toast on detection only | One-time toast; no persistent indicator | |

**User's choice:** Persistent banner (recommended)

---

## Claude's Discretion

- Reconnection detection mechanism and interval
- HTTP server port selection
- HTTP server process hosting (inside Electron main vs. child process)
- Local DB filename
- Queue flush retry logic on partial failure

## Deferred Ideas

- Settings screen for config (user prefers config file)
- Server auto-discovery via mDNS/Bonjour (user prefers config file)
- Conflict resolution merge/pick UI (both-kept is sufficient for v1)
- Machine identity management UI
