# Phase 6: Network Layer & Central Server - Research

**Researched:** 2026-04-24
**Domain:** Node/Express HTTP server embedded in Electron main process, offline SQLite fallback, queue-flush sync
**Confidence:** HIGH

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

- **D-01:** Conflict on offline queue flush: both versions kept — queued item appended as new row, not skipped or overwritten. Operator resolves manually.
- **D-02:** Conflicting rows for the same request number displayed with machine name + timestamp per row. Both visible in Past Runs list.
- **D-03:** Machine with no `config.json` starts fully functional in local-only mode. No prompts. Operator creates config.json manually when ready to join network.
- **D-04:** When client cannot reach server, persistent banner at top of app: "Working offline — saves stored locally". Disappears automatically on reconnect. Must be impossible to overlook.
- **D-05:** Config file at `%APPDATA%\immunoplex-assay-calculator\config.json`. Fields: `serverUrl` (string) and `isServer` (boolean). Absence = local-only mode.
- **D-06:** Port is embedded in `serverUrl` (e.g. `http://192.168.1.10:3847`). No separate port field.
- **D-07:** Client machines maintain `immunoplex-local.db` in `%APPDATA%` used exclusively when server is unreachable. `offline_queue` table records unflushed saves.
- **D-08:** On reconnect, offline queue flushed in insertion order. Each item confirmed by server before removal. Flush is automatic.
- **D-09:** Server machine's saves go directly to central SQLite (no HTTP hop). Server machine detects `isServer: true` in config and binds HTTP server on startup.

### Claude's Discretion

- Reconnection detection: periodic background check — detect offline state within ~10 seconds.
- HTTP server process: run inside the Electron main process on the server machine (no separate child process).
- Local DB filename: `immunoplex-local.db` (distinct from `immunoplex.db` on server to prevent collision if client is promoted).
- Queue flush retry logic on partial failure: implementation detail.

### Deferred Ideas (OUT OF SCOPE)

- Settings screen for config file management
- Server auto-discovery via mDNS/Bonjour
- Conflict resolution UI with merge/pick
- Machine identity management UI
</user_constraints>

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| NET-01 | Express HTTP server on server machine exposes REST endpoints for runs CRUD + operators CRUD; two machines confirm identical Past Runs list | Express 4.22.1, repository pattern unchanged, REST route design documented below |
| NET-02 | Config file `config.json` at userData path; server machine Electron starts HTTP server; client machines skip local DB and use HTTP client | Config loading via `fs.readFileSync` at startup; `app.getPath('userData')` path verified |
| NET-03 | When server unreachable, client falls back to local SQLite; writes to `offline_queue`; "Working offline" banner appears; no silent failures | offline_queue schema, reconnect polling, IPC error propagation pattern documented |
| NET-04 | On reconnect, offline queue flushed in insertion order; each item confirmed before removal; duplicate-detection prevents double-posting | Idempotency via client-generated UUID; flush algorithm documented |
| NET-05 | Server machine's saves go directly to central DB (no HTTP hop); server machine works normally regardless of client connectivity | Transport switch architecture; server mode = direct repository call |
</phase_requirements>

---

## Summary

Phase 6 adds a three-mode transport layer into the Electron main process. The mode is determined at startup by reading `config.json` from `app.getPath('userData')`:

- **Local-only** (no config.json): existing behaviour unchanged — `initializeDatabase()` on `immunoplex.db`, all IPC handlers call repositories directly.
- **Server mode** (`isServer: true`): same as local-only PLUS bind an Express HTTP server on startup. The server owns `immunoplex.db` and serves its REST API to client machines.
- **Client mode** (`isServer: false`, `serverUrl` set): initialise `immunoplex-local.db` for offline fallback, skip central DB init, replace run/operator IPC handler calls with HTTP client calls. Start a background reconnect poller.

The cleanest seam for the transport switch is to introduce a thin **transport interface** that the run and operator IPC handlers call instead of calling repositories directly. On server/local-only mode the transport delegates to the existing repositories. On client mode it delegates to the HTTP client (falling back to the local DB + queue on network error). The IPC handlers themselves do not change; only their internal delegate changes at startup.

The offline queue uses a new `offline_queue` SQLite table on the client's local DB. Rows hold the full JSON payload plus a client-assigned run ID (UUID generated client-side before the HTTP call, guaranteeing idempotency on flush).

**Primary recommendation:** Use Express 4.x (not 5.x) with `express.json()` middleware. Node's built-in `fetch` (available in Electron 33's Node 20.18.0, experimental-but-default) is sufficient for HTTP client calls — no additional library needed. No `externalizeDepsPlugin` config changes needed; adding `express` and `cors` to `dependencies` is enough for electron-vite + electron-builder to handle them correctly.

---

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Config file reading | Electron Main | — | `fs.readFileSync` at app startup before `whenReady`; not accessible from renderer |
| HTTP server (Express) | Electron Main | — | D-09: runs in same process as main; no child process |
| Transport mode switch | Electron Main | — | IPC handlers are in main process; transport delegate resolved at startup |
| Run/Operator CRUD (server machine) | Electron Main → Repository | — | No change from Phase 4 pattern |
| Run/Operator CRUD (client machine, online) | Electron Main → HTTP Client → Server | — | HTTP call replaces direct repository call |
| Run/Operator CRUD (client machine, offline) | Electron Main → Local DB + Queue | — | Falls back to `immunoplex-local.db`; queues write |
| Offline queue flush | Electron Main (background) | — | Background interval after reconnect detected |
| Offline indicator (banner) | Renderer (Zustand store) | Electron Main (IPC push) | Main process detects offline state, pushes to renderer via IPC |
| Reconnect polling | Electron Main | — | `setInterval` in main; renderer observes via store |
| Past Runs conflict display (D-02) | Renderer | — | `machineName` + `isOfflineSave` columns on `runs` table |

---

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| express | 4.22.1 | HTTP server for central DB API | Battle-tested, minimal API, v4 is stable; v5 adds async error handling but is newer/less proven |
| cors | 2.8.6 | CORS middleware for Express | Required since Electron renderer's security context makes cross-origin fetch a concern |
| Node.js built-in `fetch` | built-in (Node 20.18.0 in Electron 33) | HTTP client on client machines | Available globally in Node 20, no extra dependency |

[VERIFIED: npm registry] express@4.22.1 — `npm view express version`
[VERIFIED: npm registry] cors@2.8.6 — `npm view cors version`
[VERIFIED: electronjs.org] Electron 33 bundles Node 20.18.0 — https://www.electronjs.org/blog/electron-33-0

### Supporting (TypeScript types)

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| @types/express | 5.0.6 | TypeScript types for Express | Always, as devDependency |
| @types/cors | 2.8.19 | TypeScript types for cors middleware | Always, as devDependency |

[VERIFIED: npm registry] @types/express@5.0.6, @types/cors@2.8.19

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| express | fastify, koa, raw `http.createServer` | Express is already known by the codebase context; fastify would be lighter but adds learning surface for a 3-machine LAN app; raw `http` avoids a dependency but makes routing verbose |
| built-in fetch | node-fetch@2, axios | node-fetch v2 is CJS-compatible but adds a dependency; axios adds features (interceptors) not needed here; built-in fetch is zero-cost |
| Express v4 | Express v5 | v5 natively handles async errors without try/catch wrapper, but is still newer; v4 is the production-safe choice for a lab app with low update cadence |

**Installation (new dependencies):**
```bash
npm install express cors
npm install --save-dev @types/express @types/cors
```

**Version verification:** [VERIFIED: npm registry - 2026-04-24]
- `npm view express version` → `4.22.1`
- `npm view cors version` → `2.8.6`
- `npm view @types/express version` → `5.0.6`
- `npm view @types/cors version` → `2.8.19`

---

## Architecture Patterns

### System Architecture Diagram

```
Startup: app.whenReady()
    │
    ▼
loadConfig()  ← fs.readFileSync(userData/config.json)
    │
    ├── [No config] ──► local-only mode
    │                   initializeDatabase('immunoplex.db')
    │                   registerIpcHandlers() [existing, unchanged]
    │
    ├── [isServer: true] ──► server mode
    │                         initializeDatabase('immunoplex.db')
    │                         startExpressServer(port from serverUrl)
    │                         registerIpcHandlers() [uses direct transport]
    │
    └── [isServer: false] ──► client mode
                              initializeLocalDatabase('immunoplex-local.db')
                              startReconnectPoller(serverUrl)
                              registerIpcHandlers() [uses HTTP transport]

IPC handler call path (client mode):
Renderer --IPC--> Main IPC handler
                      │
                      ├── [online] ──► fetch(serverUrl/api/runs) ──► Express server
                      │                                                   │
                      │                                               runRepository
                      │                                               (central DB)
                      └── [offline] ──► localRunRepository
                                        + offline_queue INSERT

Reconnect poller (client mode, background):
setInterval(5000ms) ──► fetch(serverUrl/api/health, timeout:2000ms)
    │
    ├── [200 OK] ──► isOnline = true
    │                if (wasOffline) flushOfflineQueue()
    │                push 'connection:status' IPC event to renderer
    │
    └── [error/timeout] ──► isOnline = false
                            push 'connection:status' IPC event to renderer

Offline queue flush:
for each row in offline_queue ORDER BY id ASC:
    try:
        response = fetch(POST serverUrl/api/runs, row.payload)
        if 200: DELETE from offline_queue WHERE id = row.id
        if 409 (run.id already exists): DELETE from offline_queue (idempotent skip)
    catch: break (retry on next reconnect cycle)
```

### Recommended Project Structure

```
src/main/
├── config/
│   └── appConfig.ts          # loadConfig(), AppConfig type, mode detection
├── db/
│   ├── client.ts             # existing (server/local-only uses this unchanged)
│   ├── clientLocal.ts        # client-mode local DB init (immunoplex-local.db)
│   ├── migrate.ts            # existing
│   ├── schema.ts             # add offline_queue table, machineName+isOfflineSave on runs
│   ├── repositories/
│   │   └── offlineQueue.ts   # offline_queue CRUD
│   └── ...                   # existing repositories unchanged
├── ipc/
│   ├── run.ts                # existing, now calls transport.run instead of repo
│   ├── operator.ts           # existing, now calls transport.operator instead of repo
│   └── ...                   # other handlers unchanged
├── server/
│   └── expressServer.ts      # Express app factory, route definitions
└── transport/
    ├── index.ts              # transport mode selector (factory)
    ├── localTransport.ts     # delegates to repositories
    └── httpTransport.ts      # delegates to fetch calls; offline fallback
```

### Pattern 1: Transport Interface

**What:** A typed interface that both the local (repository) and HTTP implementations satisfy. IPC handlers call `transport.run.getAll()` rather than `runRepository.getAll()`.

**When to use:** Any time the IPC handler needs run or operator data.

```typescript
// Source: CONTEXT.md §Reusable Assets — "transport abstraction lives here"
// src/main/transport/index.ts

export interface RunTransport {
  getAll(): Promise<RunRecord[]>
  getById(id: string): Promise<RunRecord | null>
  create(data: RunCreate): Promise<RunRecord>
  update(id: string, data: RunUpdate): Promise<RunRecord | null>
  delete(id: string): Promise<void>
}

export interface OperatorTransport {
  getAll(opts: { includeInactive: boolean }): Promise<Operator[]>
  create(data: OperatorCreate): Promise<Operator>
  update(id: string, data: OperatorUpdate): Promise<Operator | null>
  softDelete(id: string): Promise<void>
}
```

### Pattern 2: Config File Loading

**What:** Synchronous read of `config.json` from `app.getPath('userData')` at startup. Returns a typed config or `null` for local-only mode.

**When to use:** Called once at the top of `app.whenReady()`, before `initializeDatabase()`.

```typescript
// Source: [VERIFIED via existing client.ts path pattern]
// src/main/config/appConfig.ts
import fs from 'fs'
import path from 'path'
import { app } from 'electron'

export interface AppConfig {
  serverUrl: string
  isServer: boolean
}

export function loadConfig(): AppConfig | null {
  const configPath = path.join(app.getPath('userData'), 'config.json')
  try {
    const raw = fs.readFileSync(configPath, 'utf-8')
    return JSON.parse(raw) as AppConfig
  } catch {
    return null  // file missing or malformed → local-only mode (D-03)
  }
}
```

### Pattern 3: Express Server Factory

**What:** Express app created as a plain factory function, bound to a port derived from `serverUrl`. Exposes `/api/health`, `/api/runs/*`, `/api/operators/*`.

```typescript
// Source: [CITED: expressjs.com/en/guide/routing.html]
// src/main/server/expressServer.ts
import express from 'express'
import cors from 'cors'
import { runRepository } from '../db/repositories/run'
import { operatorRepository } from '../db/repositories/operator'

export function createExpressApp() {
  const app = express()
  app.use(express.json())
  app.use(cors())

  app.get('/api/health', (_req, res) => res.json({ ok: true }))

  // Runs
  app.get('/api/runs', (_req, res) => {
    try { res.json(runRepository.getAll()) }
    catch (e) { res.status(500).json({ error: String(e) }) }
  })
  app.post('/api/runs', (req, res) => {
    try {
      const run = runRepository.create(req.body as RunCreate)
      res.status(201).json(run)
    } catch (e: unknown) {
      // SQLite UNIQUE violation on id → 409 (idempotency for queue flush)
      if (String(e).includes('UNIQUE constraint')) res.status(409).json({ error: 'duplicate' })
      else res.status(500).json({ error: String(e) })
    }
  })
  // ... PUT /api/runs/:id, DELETE /api/runs/:id, GET /api/runs/:id
  // ... GET/POST/PUT/DELETE /api/operators (same pattern)

  return app
}

export function startExpressServer(serverUrl: string): void {
  const port = parseInt(new URL(serverUrl).port, 10)
  const expressApp = createExpressApp()
  expressApp.listen(port, '0.0.0.0', () => {
    console.log(`Central server listening on port ${port}`)
  })
}
```

### Pattern 4: Offline Queue Schema

**What:** New `offline_queue` table on the client-side local DB. Stores the full run payload as JSON plus a client-generated `runId` (the UUID that will be used as the run's ID on the server).

```typescript
// src/main/db/schema.ts additions
export const offlineQueue = sqliteTable('offline_queue', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  runId: text('run_id').notNull(),        // client-generated UUID; used for idempotency
  operation: text('operation').notNull(), // 'create' | 'update' | 'delete'
  payload: text('payload').notNull(),     // JSON.stringify(RunCreate | { id, ...RunUpdate } | { id })
  queuedAt: text('queued_at').notNull()
})
```

### Pattern 5: Reconnect Poller

**What:** `setInterval` running in the Electron main process on client machines. Sends a `GET /api/health` with a short timeout. On state change, pushes an IPC event to all renderer windows.

```typescript
// src/main/transport/httpTransport.ts
let isOnline = false

export function startReconnectPoller(serverUrl: string, mainWindow: BrowserWindow): void {
  setInterval(async () => {
    const wasOnline = isOnline
    try {
      const ctrl = new AbortController()
      const timeout = setTimeout(() => ctrl.abort(), 2000)
      const res = await fetch(`${serverUrl}/api/health`, { signal: ctrl.signal })
      clearTimeout(timeout)
      isOnline = res.ok
    } catch {
      isOnline = false
    }
    if (isOnline !== wasOnline) {
      mainWindow.webContents.send('connection:status', { online: isOnline })
      if (isOnline) void flushOfflineQueue(serverUrl)
    }
  }, 5000)
}
```

### Pattern 6: Schema Additions to `runs` table

The `runs` table needs two new nullable columns to support D-02 (machine name display) and conflict visibility:

```typescript
// src/main/db/schema.ts — add to existing `runs` table
machineName: text('machine_name'),         // os.hostname() at save time; null for pre-Phase-6 rows
isOfflineSave: integer('is_offline_save', { mode: 'boolean' }).notNull().default(false)
```

These are added via migration 0005 (`ALTER TABLE runs ADD ...`). Pre-Phase-6 runs will have `machineName = NULL` and `isOfflineSave = false` — both display cleanly as-is.

### Pattern 7: IPC Push for Offline State

The renderer needs to know connection status. The main process uses `webContents.send` (already a known pattern in Electron) to push status changes:

```typescript
// Renderer side: listen in App.tsx useEffect
useEffect(() => {
  window.electronAPI.connection.onStatusChange((online: boolean) => {
    useNetworkStore.getState().setOnline(online)
  })
}, [])
```

New preload bridge entry:
```typescript
connection: {
  onStatusChange: (cb: (online: boolean) => void) =>
    ipcRenderer.on('connection:status', (_event, { online }) => cb(online))
}
```

### Anti-Patterns to Avoid

- **Putting transport logic in repositories:** The repository pattern is clean; repositories always hit the local DB via Drizzle. The transport shim sits ABOVE repositories (in IPC handlers or a transport layer), not inside them. Repositories are never HTTP-aware.
- **Calling `initializeDatabase()` on a client machine:** Client machines call `initializeLocalDatabase()` instead. The central DB path (`immunoplex.db`) must never be opened on a client machine.
- **Starting Express server before DB is ready:** `startExpressServer()` must come after `runMigrations()` to avoid serving requests against an uninitialized schema.
- **Binding only to `localhost` on the server:** Express must bind to `'0.0.0.0'` (all interfaces), not `'localhost'` or `'127.0.0.1'`, to be reachable from other LAN machines.
- **Using Express v5:** v5 is current but recent. Express v4.22.1 is stable, well-understood, and the right choice for a lab app.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| HTTP server routing and middleware | Custom `http.createServer` with regex routing | `express` | Express handles JSON parsing, routing, and error middleware cleanly; raw Node HTTP is verbose for 9+ endpoints |
| CORS handling | Manual `Access-Control-Allow-Origin` headers | `cors` middleware | Edge cases with preflight OPTIONS, multiple origins; cors handles all of it in one line |
| HTTP client with timeout | Custom `Promise.race` + `fetch` wrapper | Built-in `fetch` with `AbortController` + `setTimeout` | Native in Node 20; `AbortController` is the standard timeout pattern |
| Idempotency on queue flush | Custom "have I sent this?" tracking state | Client-generated UUID as `run.id` + server 409 on duplicate | UUID is generated before the HTTP call; server checks `WHERE id = ?` on insert; 409 = already exists; no external state needed |

**Key insight:** The whole transport switch is ~150 lines of new code in `main/transport/` — don't over-engineer it. The repositories are untouched; only the IPC handlers change their delegate.

---

## Common Pitfalls

### Pitfall 1: Windows Firewall Prompt on First Server Bind
**What goes wrong:** When the Express server binds to `0.0.0.0:3847` for the first time, Windows Defender Firewall pops a dialog asking to allow or block the app. If a lab technician clicks "Block", client machines cannot connect.
**Why it happens:** Windows blocks new inbound rules by default.
**How to avoid:** Document this in deployment notes. The plan should include a step reminding whoever sets up the server machine that they must click "Allow access" when the Firewall dialog appears.
**Warning signs:** Client machines show "Working offline" banner immediately even when the server is running.

### Pitfall 2: `app.getPath('userData')` Not Available Before `app.whenReady()`
**What goes wrong:** Calling `loadConfig()` synchronously before `app.whenReady()` fires will throw "App is not ready".
**Why it happens:** Electron's `app.getPath()` requires the app to be ready.
**How to avoid:** Call `loadConfig()` as the FIRST action inside `app.whenReady().then(async () => { ... })`, not in module scope.
**Warning signs:** `Error: app.getPath() called before app is ready`

### Pitfall 3: Migration Runs on Client-Mode Local DB vs Central DB
**What goes wrong:** Client machines open `immunoplex-local.db`. If `runMigrations()` is called unconditionally, it runs against whatever DB is currently open. On client machines, this would try to migrate the local DB using the central DB's migration files — which is correct for `offline_queue` and `runs.machineName` columns, but can cause confusion.
**Why it happens:** `runMigrations()` calls `getDatabase()`, which returns whatever was last initialized.
**How to avoid:** Migration 0005 must be applied to BOTH DBs. On the server machine it runs against `immunoplex.db`. On client machines, call `runMigrations()` against the local DB after `initializeLocalDatabase()`. The migration SQL is additive (ALTER TABLE + CREATE TABLE) and is safe to apply to both.
**Warning signs:** `table offline_queue has no column named ...` errors on client machines.

### Pitfall 4: Race Between Reconnect Flush and Manual Save
**What goes wrong:** User saves a run at exactly the moment the reconnect flush starts. The flush is in the middle of POSTing queued items, and the new save also tries to POST to the server. If the new save fails (server temporarily busy) and goes into the queue, it may be processed out of order.
**Why it happens:** No mutex around the flush operation.
**How to avoid:** Keep a simple `isFlushing` flag. While `isFlushing = true`, new offline saves go to the queue normally (the flush will pick them up at the end of the current cycle). Do not attempt to POST new saves during an active flush.
**Warning signs:** Duplicate runs appearing in Past Runs list.

### Pitfall 5: Port 3847 Conflicts with MSFW-Control on Domain-Joined Windows Machines
**What goes wrong:** Port 3847 is registered for `msfw-control` (Microsoft Firewall Control). On a domain-joined machine running ISA Server or Forefront TMG, this port may be in use.
**Why it happens:** CONTEXT.md uses `3847` as an example in `serverUrl`. The config file the lab uses will contain this port.
**How to avoid:** The port is in the config file — easily changed. Document that if `3847` is already bound (check with `netstat -an | findstr 3847`), choose a different port in the config. The suggested alternative is `47891` (dynamic range, no known registrations).
**Warning signs:** `EADDRINUSE: address already in use :::3847` in Electron console.

### Pitfall 6: `electron-vite` Bundling of `express` — `externalizeDepsPlugin` Scope
**What goes wrong:** Adding `express` to `devDependencies` instead of `dependencies` causes electron-builder to exclude it from the packaged app. The app works in dev but crashes when installed.
**Why it happens:** electron-builder excludes `devDependencies` by default. electron-vite externalizes `dependencies` (does not bundle them) so they must be present at runtime.
**How to avoid:** `express` and `cors` go in `dependencies` (not `devDependencies`). `@types/express` and `@types/cors` go in `devDependencies`.
**Warning signs:** `Cannot find module 'express'` crash only in packaged `.exe`, not in dev.

### Pitfall 7: `better-sqlite3` Is Synchronous — Express Route Handlers Block
**What goes wrong:** Express route handlers that call `runRepository.getAll()` block the Node.js event loop while SQLite queries run. With 3 machines, this is not a performance problem (WAL mode handles concurrent reads), but unhandled exceptions from synchronous calls will crash the route handler.
**Why it happens:** `better-sqlite3` is synchronous by design. Express expects async-or-sync handlers but requires explicit error catching.
**How to avoid:** Wrap all repository calls in `try/catch` in every route handler. For Express v4, async route handlers that throw will silently hang unless wrapped. Use synchronous try/catch (repositories are sync anyway).
**Warning signs:** Route hangs indefinitely on unhandled exception.

---

## Code Examples

### Config Loading at Startup

```typescript
// Source: pattern derived from existing client.ts app.getPath('userData') usage [VERIFIED: codebase]
// src/main/index.ts (modified app.whenReady block)
app.whenReady().then(() => {
  const config = loadConfig()                    // null = local-only
  
  if (config === null) {
    // D-03: local-only mode
    initializeDatabase()
    runMigrations()
    seedAll()
  } else if (config.isServer) {
    // D-09: server mode — central DB + Express
    initializeDatabase()
    runMigrations()
    seedAll()
    startExpressServer(config.serverUrl)
  } else {
    // client mode — local fallback DB only
    initializeLocalDatabase()
    runMigrations()  // applies migration 0005 to local DB (offline_queue + new columns)
    startReconnectPoller(config.serverUrl, mainWindow)
    initHttpTransport(config.serverUrl)
  }
  
  registerIpcHandlers()
  createWindow()
})
```

### Express Route with Idempotency (for queue flush)

```typescript
// Source: Express docs pattern + SQLite UNIQUE constraint behaviour [VERIFIED via schema.ts]
app.post('/api/runs', (req, res) => {
  try {
    const parsed = runCreateSchema.parse(req.body)
    const run = runRepository.create(parsed)
    res.status(201).json(run)
  } catch (e: unknown) {
    const msg = String(e)
    if (msg.includes('UNIQUE constraint failed: runs.id')) {
      // Idempotency: run ID already exists on the server (flushed twice)
      // Return the existing run rather than an error so the client can remove it from queue
      const existing = runRepository.getById((req.body as RunCreate & { id: string }).id)
      res.status(200).json(existing)
    } else {
      res.status(500).json({ error: msg })
    }
  }
})
```

### Offline Banner Component

```tsx
// Source: error pattern from OperatorsSection.tsx [VERIFIED: codebase]
// Matches D-04: persistent banner, impossible to overlook
// src/renderer/src/features/network/OfflineBanner.tsx
export function OfflineBanner(): JSX.Element | null {
  const online = useNetworkStore((s) => s.online)
  if (online) return null
  return (
    <div className="w-full bg-yellow-50 border-b border-yellow-200 px-6 py-2 text-sm font-medium text-yellow-800">
      Working offline — saves stored locally
    </div>
  )
}
// Placed in App.tsx between <header> and <main> so it spans full width above content
```

### Past Runs Conflict Display (D-02)

```tsx
// Source: RunList.tsx existing pattern [VERIFIED: codebase]
// Add machine/offline columns alongside existing request number display
function displayRunSource(run: RunRecord): string {
  if (!run.machineName) return ''  // pre-Phase-6 row
  if (run.isOfflineSave) return `${run.machineName} — offline save`
  return run.machineName
}
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `externalizeDepsPlugin` (electron-vite) | `build.externalizeDeps` | electron-vite v5 | Project uses v2.3.0 — still use `externalizeDepsPlugin`; no config changes needed, just add express/cors to `dependencies` |
| `node-fetch` for HTTP in Node.js | Built-in `fetch` | Node 18+ (experimental), Node 21+ (stable) | Electron 33 bundles Node 20.18.0; built-in fetch available without flags |
| Separate server process | Server in Electron main process | D-09 decision | Simpler lifecycle; no IPC between Electron and a separate server process |

**Not deprecated but worth noting:**
- `better-sqlite3` synchronous API: still standard, still the right choice; WAL mode handles 3 concurrent clients cleanly. [VERIFIED: existing codebase Phase 4]

---

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | Port 3847 is safe for use on a non-domain-joined lab Windows PC | Common Pitfalls §Pitfall 5 | MSFW-Control process binds 3847 on this machine → server fails to start; mitigation: use config file to change port |
| A2 | `os.hostname()` on Windows returns the human-readable computer name (e.g. `LAB-PC-01`) | Pattern §6 | Returns a different format; minor — display may look different but won't break functionality |
| A3 | Three lab machines are on the same LAN subnet with no routing barriers | Architecture diagram | If firewalls or VLANs separate machines, HTTP reach may require additional network config; out of scope for this phase |
| A4 | Electron 33 / Node 20.18.0 built-in fetch `AbortController` + timeout pattern works without flags | Standard Stack | If `--experimental-fetch` is required in Electron's Node runtime context (unlikely), fall back to `node-fetch@2.7.0` (CJS) |

---

## Open Questions

1. **Which IPC channels should be routed to the server beyond runs and operators?**
   - What we know: ROADMAP SC-1 explicitly says "runs CRUD, operators CRUD". Panels, analytes, platforms, species are "management" data (imported per-machine).
   - What's unclear: Does the user expect panel/analyte data to also be centralized (one import on the server propagates to all machines)?
   - Recommendation: Phase 6 scope is runs + operators only, per SC-1. Panel data stays local per machine. If centralization of panel data is needed, it's a Phase 6+ concern.

2. **machine_name on the server machine's own saves**
   - What we know: D-09 says server machine saves go directly to central DB (no HTTP hop).
   - What's unclear: Should `machineName` on those rows be set to `os.hostname()` of the server machine, or left null?
   - Recommendation: Set `machineName` to `os.hostname()` for ALL saves (server and client alike) so D-02 conflict display always shows source. Null only for pre-Phase-6 rows.

---

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js | Runtime | ✓ | v24.9.0 (dev); v20.18.0 (bundled in Electron 33) | — |
| npm | Package install | ✓ | 11.6.0 | — |
| express (to install) | Server machine Express HTTP server | not yet | — | — |
| cors (to install) | Express CORS middleware | not yet | — | — |
| Windows workstation (3 lab PCs) | End-to-end NET-01 verification | not available on dev machine | — | Cannot verify NET-01 SC-1 ("two machines see identical Past Runs list") on macOS; Windows UAT required |

**Missing dependencies with no fallback (blocking):**
- Windows lab PCs for end-to-end NET-01 verification — this is expected per CLAUDE.md §Testing. Plan must include `npm run build:win` + HUMAN-UAT task.

**Missing dependencies with fallback:**
- None.

---

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | vitest 2.1.9 |
| Config file | `vitest.config.ts` (root) |
| Quick run command | `npm test` |
| Full suite command | `npm test` |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| NET-01 | Express server binds, exposes REST endpoints for runs + operators | integration (in-process) | `npm test -- --grep "express server"` | ❌ Wave 0 |
| NET-01 | Two machines see identical Past Runs list | smoke / manual | HUMAN-UAT (Windows only) | manual |
| NET-02 | `loadConfig()` returns correct mode from config.json variants | unit | `npm test -- --grep "loadConfig"` | ❌ Wave 0 |
| NET-02 | Config absence → local-only mode | unit | included in loadConfig tests | ❌ Wave 0 |
| NET-03 | Offline queue INSERT on server unreachable | unit | `npm test -- --grep "offline queue"` | ❌ Wave 0 |
| NET-03 | "Working offline" banner visible in renderer | manual | HUMAN-UAT (Windows only) | manual |
| NET-04 | Queue flush sends rows in insertion order | unit | `npm test -- --grep "flush"` | ❌ Wave 0 |
| NET-04 | Duplicate-detection: 200/409 response removes item from queue | unit | included in flush tests | ❌ Wave 0 |
| NET-05 | Server machine saves go direct (no HTTP hop) | unit / integration | `npm test -- --grep "server mode"` | ❌ Wave 0 |

### Sampling Rate
- **Per task commit:** `npm test` (full suite, <30s with vitest forks pool)
- **Per wave merge:** `npm test`
- **Phase gate:** Full suite green + HUMAN-UAT-06-XX (Windows) before `/gsd-verify-work`

### Wave 0 Gaps
- [ ] `src/main/config/__tests__/appConfig.test.ts` — covers NET-02 (loadConfig unit tests)
- [ ] `src/main/__tests__/expressServer.test.ts` — covers NET-01 (Express routes in-process, supertest or direct fetch)
- [ ] `src/main/transport/__tests__/httpTransport.test.ts` — covers NET-03/04/05 (offline queue, flush logic, mode switch)
- [ ] `src/main/db/__tests__/migration.test.ts` extended — covers migration 0005 (offline_queue + new runs columns)

Note: `supertest` (for in-process Express testing) may be needed if route tests use HTTP. Alternative: test routes by calling the Express app directly without binding to a port.

---

## Security Domain

> `security_enforcement` not set in `.planning/config.json` → treated as enabled.

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | no | Internal LAN only, no user auth on HTTP API |
| V3 Session Management | no | Stateless HTTP; no sessions |
| V4 Access Control | low | Network-level only — server binds to LAN IP; not exposed to internet |
| V5 Input Validation | yes | Existing `runCreateSchema.parse()` (Zod) reused on Express POST routes |
| V6 Cryptography | no | No sensitive data requiring encryption; internal LAN transport |

### Known Threat Patterns for This Stack

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Malformed JSON POST body | Tampering | `express.json()` rejects malformed JSON with 400; Zod schema validation rejects invalid shapes |
| Unauthorized write from non-lab machine on same LAN | Elevation of Privilege | No auth in v1 — acceptable for a closed lab LAN. Document as known risk. If network is shared, add a shared secret header (X-Api-Key) in v2. |
| Port scan reveals Express server | Information Disclosure | Acceptable for internal LAN. Not exposed to internet per deployment context. |
| Large payload DoS | Denial of Service | Add `express.json({ limit: '1mb' })` to cap body size (run payloads are < 10KB) |

**Risk acceptance:** The HTTP API has no authentication in Phase 6. This is intentional for v1 (small team, closed lab LAN). The plan should include a comment noting this is a known v1 limitation.

---

## Sources

### Primary (HIGH confidence)
- `src/main/db/client.ts` — existing DB init pattern; `app.getPath('userData')` usage confirmed [VERIFIED: codebase]
- `src/main/ipc/run.ts`, `operator.ts` — IPC handler shapes; these call repositories directly [VERIFIED: codebase]
- `src/main/db/schema.ts` — current schema; `runs` table has no `machineName` column [VERIFIED: codebase]
- `electron.vite.config.ts` — `externalizeDepsPlugin({ include: ['electron'] })` [VERIFIED: codebase]
- `electron-builder.yml` — `asarUnpack` only needed for `better-sqlite3` (native); express is pure JS [VERIFIED: codebase]
- `package.json` — express/cors not yet in dependencies [VERIFIED: codebase]
- `/expressjs/express` (Context7) — Express routing, JSON middleware, error handler patterns [VERIFIED: Context7]
- `electron-vite` docs `/alex8088/electron-vite-docs` — `dependencies` are auto-externalized; no config change needed for express [VERIFIED: Context7]
- npm registry — express@4.22.1, cors@2.8.6, @types/express@5.0.6, @types/cors@2.8.19 [VERIFIED: npm view]
- electronjs.org blog — Electron 33 bundles Node 20.18.0 [CITED: https://www.electronjs.org/blog/electron-33-0]

### Secondary (MEDIUM confidence)
- Node.js 20 built-in `fetch` available by default (no flag) — confirmed experimentally in dev Node 24 and via web search cross-reference [VERIFIED: local test + WebSearch]
- Port 3847 registered for MSFW-Control — `/etc/services` on macOS; may differ on Windows lab PCs [VERIFIED: /etc/services grep]

### Tertiary (LOW confidence)
- None.

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — versions verified via npm registry; electron-vite bundling behavior verified via Context7 docs
- Architecture: HIGH — grounded in existing codebase patterns (`client.ts`, `ipc/run.ts`, `schema.ts`); no speculative components
- Pitfalls: HIGH for code pitfalls (VERIFIED in codebase); MEDIUM for Windows Firewall / port conflict (cannot test on Windows dev machine)

**Research date:** 2026-04-24
**Valid until:** 2026-05-24 (Express v4 is stable; no fast-moving dependencies)
