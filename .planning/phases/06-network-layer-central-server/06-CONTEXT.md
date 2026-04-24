# Phase 6: Network Layer & Central Server - Context

**Gathered:** 2026-04-24
**Status:** Ready for planning

<domain>
## Phase Boundary

One designated lab PC runs a lightweight HTTP server (Node/Express) that owns the central SQLite database. The other two machines switch their IPC-to-repository path to route all DB operations through HTTP to that server. A JSON config file on each machine declares `serverUrl` and `isServer`. When the server is unreachable, client machines fall back to a local SQLite with an `offline_queue` table; on reconnect the queue is automatically flushed to the server.

This phase does NOT include the audit trail (Phase 7) — that builds on top of the central DB once it exists.

</domain>

<decisions>
## Implementation Decisions

### Sync Conflict Resolution
- **D-01:** When a client machine's offline queue flushes and the server already has a run with the same request number (created on another machine while this one was offline), **both versions are kept** — the queued item is appended as a new row rather than skipped or overwritten. Operator resolves manually.
- **D-02:** In the Past Runs list, conflicting rows for the same request number are distinguished by **machine name + timestamp** on each row (e.g., "Machine A — offline save, 14:32" vs "Machine B — live save, 14:45"). The operator sees both and decides which to keep or delete.

### First-Launch / No-Config Behavior
- **D-03:** A machine with no `config.json` starts the app **fully functional in local-only mode** using a standalone SQLite DB. No prompts, no blocking. The operator manually creates `config.json` when ready to join the network. This makes fresh installs safe and self-contained.

### Offline Indicator
- **D-04:** When a client machine cannot reach the server and falls back to local, a **persistent banner at the top of the app** appears: "Working offline — saves stored locally". It disappears automatically when the server reconnects. This must be impossible to overlook — lab staff cannot mistake offline saves for synced records.

### Config File (pre-decided in conversation)
- **D-05:** Config file lives at `%APPDATA%\immunoplex-assay-calculator\config.json`. Fields: `serverUrl` (HTTP URL of the server machine, e.g. `http://192.168.1.10:3847`) and `isServer` (boolean — true on the designated server machine). Absence of the file → local-only mode (D-03).
- **D-06:** The server port is part of `serverUrl` in the config — no separate port field. Port selection is Claude's Discretion (pick a high, non-conflicting port).

### Offline Fallback & Sync-Back (pre-decided in conversation)
- **D-07:** Client machines maintain a local SQLite DB (`immunoplex-local.db` in `%APPDATA%`) used exclusively when the server is unreachable. An `offline_queue` table records saves that need to be flushed to the server.
- **D-08:** On reconnect, the offline queue is flushed to the server in **insertion order**. Each item is confirmed by the server before removal from the queue. The flush is automatic — no operator action required.
- **D-09:** The server machine's own saves go directly to the central SQLite (no HTTP hop). The server machine detects `isServer: true` in config and binds the HTTP server on startup.

### Claude's Discretion
- Reconnection detection: periodic background check (interval and timeout are implementation details — keep latency low enough that offline state is detected within ~10 seconds)
- HTTP server process hosting: run inside the Electron main process on the server machine (no separate child process or OS service — simpler lifecycle management)
- Local DB filename: distinct from the central DB name so they don't collide if a client machine is ever promoted to server
- Queue flush retry logic on partial failure: implementation detail

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Phase Definition
- `.planning/ROADMAP.md` §Phase 6 — Goals, success criteria, and dependency on Phase 4

### Current DB & IPC Architecture (the seam that changes)
- `src/main/db/client.ts` — Current DB init pattern; `initializeDatabase()` is where server/client mode diverges
- `src/main/index.ts` — App startup sequence; server machine will additionally bind Express here
- `src/main/ipc/run.ts` — Representative IPC handler pattern; all handlers follow this shape

### Run Persistence Decisions
- `.planning/phases/04-run-documentation-persistence-deployment/04-CONTEXT.md` — Run/operator schema decisions that the network layer must preserve

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `src/main/db/client.ts`: `initializeDatabase()`, `getDatabase()`, `getSqlite()` — the transport abstraction lives here; switching from local to HTTP is a matter of replacing `getDatabase()` on client machines with an HTTP client façade
- `src/main/ipc/` (all handlers): All IPC handlers call repositories through `getDatabase()` — they do not need to change if the repository layer stays the same interface
- `src/main/db/repositories/` (all repos): Repository methods call `getDatabase()` directly; the server keeps these unchanged; client machines need either HTTP-aware repos or a transport shim below `getDatabase()`

### Established Patterns
- WAL mode already enabled in `client.ts` — good for server machine's concurrent reads from 3 clients
- IPC boundary uses Zod validation (`runCreateSchema.parse(data)`) — this validation layer should stay on the client's Electron main process, not delegated to the server
- Repository pattern isolates DB access from IPC — clean seam for inserting a transport layer

### Integration Points
- `src/main/index.ts` `app.whenReady()` block: server machine adds HTTP server bind after `initializeDatabase()`
- `src/main/db/client.ts`: client machines replace/wrap `initializeDatabase()` with an HTTP client init
- New `offline_queue` table needs a Drizzle migration (migration 0005)
- Past Runs list UI needs machine + timestamp columns for conflict display (D-02)

</code_context>

<specifics>
## Specific Ideas

- Server URL example from conversation: `http://192.168.1.10:3847` (LAN IP + high port)
- Past Runs conflict display: machine name + timestamp visible on each row — "Machine A — offline save" vs "Machine B — live save"
- Offline banner text: "Working offline — saves stored locally"
- Config file location: `%APPDATA%\immunoplex-assay-calculator\config.json` (same userData dir as the DB)

</specifics>

<deferred>
## Deferred Ideas

- Settings screen for config (suggested as an option — user prefers config file for v1)
- Server auto-discovery via mDNS/Bonjour (suggested as an option — user prefers config file)
- Conflict resolution UI with merge/pick UI (deferred — "both kept" is sufficient for v1)
- Machine identity management UI (which machine is which) — Phase 7 concern via `machine_id` on audit log

</deferred>

---

*Phase: 06-network-layer-central-server*
*Context gathered: 2026-04-24*
