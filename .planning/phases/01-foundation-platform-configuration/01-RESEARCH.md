# Phase 1: Foundation & Platform Configuration - Research

**Researched:** 2026-01-22
**Domain:** Electron desktop application scaffolding, SQLite persistence, IPC infrastructure, decimal arithmetic
**Confidence:** HIGH

## Summary

Phase 1 establishes the technical foundation for the Immunoplex Assay Calculator desktop application. The phase covers Electron + React + TypeScript project scaffolding using electron-vite, SQLite database setup with better-sqlite3 and Drizzle ORM for type-safe queries and migrations, IPC infrastructure for secure main-renderer communication, and decimal arithmetic integration to prevent floating-point errors in subsequent calculation phases.

The stack is well-documented with established patterns. Electron 40.x with electron-vite provides fast development with HMR, while better-sqlite3 offers synchronous SQLite access ideal for desktop apps. The critical foundation decisions include: enabling WAL mode for database performance, establishing typed IPC channels from day one, integrating decimal.js for all numeric operations involving volumes/concentrations, and creating the platform configuration data model with seed data for the four supported platforms (Milliplex, BioRad, ProCartaPlex, R&D).

This phase directly addresses CALC-07 (platform-specific stock concentrations) and lays groundwork for subsequent phases by establishing the data layer, IPC patterns, and decimal arithmetic that all features will use.

**Primary recommendation:** Use electron-vite's React TypeScript template, configure better-sqlite3 with WAL mode, establish typed IPC channels with Zod validation, and integrate decimal.js from the start for all volume/concentration data types.

## Standard Stack

The established libraries/tools for this domain:

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Electron | 40.x | Desktop shell | Bundles Node 24.x + Chromium 144; mature ecosystem for native module integration; extensive documentation |
| electron-vite | 2.x | Build tooling | Fast HMR; handles main/preload/renderer build separately; native ESM; simpler than webpack |
| React | 19.x | UI framework | Industry standard; excellent TypeScript support; hooks architecture for state management |
| TypeScript | 5.x | Type safety | First-class inference; catches errors at compile time; essential for scientific applications |
| Vite | 6.x | Bundler | Fast development builds; native ESM; integrates seamlessly with electron-vite |

### Database Layer
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| better-sqlite3 | 12.x | SQLite binding | Synchronous API (simpler for desktop); 10x faster than node-sqlite3; requires electron-rebuild |
| Drizzle ORM | 0.39.x | Type-safe queries | Lightweight; excellent TypeScript inference; SQL-like syntax; built-in migration support |
| drizzle-kit | latest | Migration CLI | Generates migration files; supports push for development; integrates with better-sqlite3 |

### State & Validation
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Zustand | 5.x | State management | Minimal boilerplate (3KB); hook-based; React 19 compatible via useSyncExternalStore |
| Zod | 3.x | Schema validation | TypeScript-first; compile + runtime validation sync; validates IPC inputs |

### Precision Arithmetic
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| decimal.js | 10.x | Arbitrary precision | Prevents floating-point errors; significant digits focus (scientific); trigonometric functions available |

### UI Foundation
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Tailwind CSS | 4.x | Styling | CSS-first configuration; utility classes; works with shadcn/ui |
| shadcn/ui | latest | Component library | Copy-paste components; Radix primitives; Tailwind-based; React 19 compatible |
| tw-animate-css | latest | Animations | Replaces tailwindcss-animate for Tailwind v4 compatibility |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| electron-vite | Electron Forge | Forge has broader template support but webpack-based (slower HMR); electron-vite is faster for Vite-native projects |
| better-sqlite3 | sql.js | sql.js runs in WASM (no native bindings) but ~10x slower; use if native compilation fails |
| Drizzle ORM | Prisma | Prisma is heavier, generates client, less suited for SQLite desktop; Drizzle is lighter with SQL-like DX |
| Zustand | Redux Toolkit | RTK is more structured but heavier; Zustand is simpler for medium-complexity desktop apps |
| decimal.js | bignumber.js | bignumber.js is smaller but focused on decimal places; decimal.js better for scientific significant digits |

**Installation:**
```bash
# Create project with electron-vite
npm create @quick-start/electron@latest immunoplex-calculator -- --template react-ts

# Core dependencies
npm install react react-dom
npm install zustand zod
npm install better-sqlite3 drizzle-orm decimal.js
npm install tailwindcss tw-animate-css

# Dev dependencies
npm install -D typescript @types/react @types/node
npm install -D drizzle-kit @types/better-sqlite3
npm install -D electron-rebuild

# Post-install: rebuild native modules for Electron
npx electron-rebuild -f -w better-sqlite3
```

## Architecture Patterns

### Recommended Project Structure
```
src/
├── main/                    # Electron main process
│   ├── index.ts             # Main entry point
│   ├── ipc/                 # IPC handlers
│   │   ├── index.ts         # Register all handlers
│   │   └── platform.ts      # Platform config handlers
│   ├── db/                  # Database layer
│   │   ├── client.ts        # Database connection
│   │   ├── schema.ts        # Drizzle schema definitions
│   │   └── migrate.ts       # Migration runner
│   └── services/            # Main process services
│
├── preload/                 # Preload scripts
│   └── index.ts             # contextBridge API exposure
│
├── renderer/                # React application
│   ├── App.tsx              # Root component
│   ├── components/          # Shared UI components
│   │   └── layout/          # App shell, navigation
│   ├── features/            # Feature-based organization
│   │   └── settings/        # Platform configuration feature
│   │       ├── components/  # Settings UI components
│   │       └── hooks/       # Settings state hooks
│   ├── lib/                 # Shared utilities
│   │   ├── decimal.ts       # Decimal.js wrapper utilities
│   │   └── ipc.ts           # IPC client utilities
│   ├── stores/              # Zustand stores
│   └── types/               # Renderer-specific types
│
├── shared/                  # Shared between processes
│   ├── types/               # Cross-process type definitions
│   │   ├── platform.ts      # Platform entity types
│   │   └── ipc.ts           # IPC message types
│   ├── constants/           # Shared constants
│   │   └── channels.ts      # IPC channel names
│   └── validation/          # Zod schemas (used both sides)
│       └── platform.ts      # Platform validation schemas
│
└── drizzle/                 # Migration files
    └── migrations/          # Generated SQL migrations
```

### Pattern 1: Typed IPC Channels
**What:** Define IPC channel names as constants with TypeScript types for request/response payloads. Main process handlers and renderer clients share the same type definitions.
**When to use:** All IPC communication between main and renderer processes.
**Example:**
```typescript
// src/shared/constants/channels.ts
export const IPC_CHANNELS = {
  PLATFORM_GET_ALL: 'platform:get-all',
  PLATFORM_GET_BY_ID: 'platform:get-by-id',
  PLATFORM_CREATE: 'platform:create',
  PLATFORM_UPDATE: 'platform:update',
  DB_HEALTH: 'db:health',
} as const;

// src/shared/types/ipc.ts
import { Platform, PlatformCreate } from './platform';

export interface IpcApi {
  'platform:get-all': { request: void; response: Platform[] };
  'platform:get-by-id': { request: string; response: Platform | null };
  'platform:create': { request: PlatformCreate; response: Platform };
  'platform:update': { request: Platform; response: Platform };
  'db:health': { request: void; response: { ok: boolean } };
}

// src/preload/index.ts
import { contextBridge, ipcRenderer } from 'electron';
import { IPC_CHANNELS } from '../shared/constants/channels';

contextBridge.exposeInMainWorld('electronAPI', {
  platform: {
    getAll: () => ipcRenderer.invoke(IPC_CHANNELS.PLATFORM_GET_ALL),
    getById: (id: string) => ipcRenderer.invoke(IPC_CHANNELS.PLATFORM_GET_BY_ID, id),
    create: (data: unknown) => ipcRenderer.invoke(IPC_CHANNELS.PLATFORM_CREATE, data),
    update: (data: unknown) => ipcRenderer.invoke(IPC_CHANNELS.PLATFORM_UPDATE, data),
  },
  db: {
    health: () => ipcRenderer.invoke(IPC_CHANNELS.DB_HEALTH),
  },
});

// src/main/ipc/platform.ts
import { ipcMain } from 'electron';
import { IPC_CHANNELS } from '../../shared/constants/channels';
import { platformCreateSchema } from '../../shared/validation/platform';
import { platformRepository } from '../db/repositories/platform';

export function registerPlatformHandlers() {
  ipcMain.handle(IPC_CHANNELS.PLATFORM_GET_ALL, async () => {
    return platformRepository.getAll();
  });

  ipcMain.handle(IPC_CHANNELS.PLATFORM_CREATE, async (_, data: unknown) => {
    const validated = platformCreateSchema.parse(data); // Zod validation
    return platformRepository.create(validated);
  });
}
```

### Pattern 2: Decimal.js Wrapper for Volumes
**What:** Wrap decimal.js operations in domain-specific utility functions that handle microliters as the canonical unit and provide rounding at display time.
**When to use:** All volume and concentration calculations.
**Example:**
```typescript
// src/renderer/lib/decimal.ts
import Decimal from 'decimal.js';

// Configure decimal.js for scientific precision
Decimal.set({ precision: 20, rounding: Decimal.ROUND_HALF_UP });

// Volume operations - internal unit is microliters (uL)
export function createVolume(value: number | string, unit: 'uL' | 'mL' = 'uL'): Decimal {
  const decimal = new Decimal(value);
  return unit === 'mL' ? decimal.times(1000) : decimal;
}

export function volumeToDisplay(volumeUL: Decimal, unit: 'uL' | 'mL' = 'uL', decimals = 2): string {
  const converted = unit === 'mL' ? volumeUL.dividedBy(1000) : volumeUL;
  return converted.toFixed(decimals);
}

export function addVolumes(...volumes: Decimal[]): Decimal {
  return volumes.reduce((sum, v) => sum.plus(v), new Decimal(0));
}

// Concentration operations
export function createConcentration(value: number | string): Decimal {
  return new Decimal(value);
}

// C1V1 = C2V2 calculation
export function calculateVolume(
  stockConc: Decimal,
  finalConc: Decimal,
  finalVolume: Decimal
): Decimal {
  // V1 = (C2 * V2) / C1
  return finalConc.times(finalVolume).dividedBy(stockConc);
}
```

### Pattern 3: Repository Pattern for Database Access
**What:** Abstract data persistence behind repository interfaces. Repositories handle SQL via Drizzle; services use repositories without knowing storage details.
**When to use:** All database operations in main process.
**Example:**
```typescript
// src/main/db/schema.ts
import { sqliteTable, text, real, integer } from 'drizzle-orm/sqlite-core';

export const platforms = sqliteTable('platforms', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  description: text('description'),
  stockConcentration: real('stock_concentration').notNull(),
  createdAt: text('created_at').notNull(),
  updatedAt: text('updated_at').notNull(),
});

// src/main/db/repositories/platform.ts
import { eq } from 'drizzle-orm';
import { db } from '../client';
import { platforms } from '../schema';
import type { Platform, PlatformCreate } from '../../../shared/types/platform';

export const platformRepository = {
  getAll(): Platform[] {
    return db.select().from(platforms).all();
  },

  getById(id: string): Platform | null {
    const result = db.select().from(platforms).where(eq(platforms.id, id)).get();
    return result ?? null;
  },

  create(data: PlatformCreate): Platform {
    const now = new Date().toISOString();
    const id = crypto.randomUUID();
    const platform = { ...data, id, createdAt: now, updatedAt: now };
    db.insert(platforms).values(platform).run();
    return platform;
  },
};
```

### Anti-Patterns to Avoid
- **Exposing raw ipcRenderer:** Never expose `ipcRenderer.on` or `ipcRenderer.send` directly. Wrap specific channels in functions via contextBridge.
- **Floating-point for volumes:** Never use native JavaScript numbers for volume/concentration calculations. Always use decimal.js.
- **Database in renderer:** Never access SQLite from renderer process. All database operations go through IPC to main process.
- **Skipping Zod validation on IPC:** Always validate incoming IPC data with Zod schemas in the main process handler before processing.

## Don't Hand-Roll

Problems that look simple but have existing solutions:

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Decimal arithmetic | Custom rounding logic | decimal.js | Floating-point errors compound silently; decimal.js handles precision correctly |
| Database migrations | Manual SQL scripts | Drizzle Kit | Migration ordering, rollback, and type safety are complex to get right |
| IPC type safety | Manual type assertions | Zod schemas in shared/ | Runtime validation prevents malformed data from corrupting state |
| Native module compilation | Manual node-gyp | electron-rebuild | Electron version matching is tricky; electron-rebuild handles it |
| Form validation | Manual if/else checks | Zod + React Hook Form | Consistent validation rules between runtime and types |
| State persistence | localStorage wrapper | Zustand persist middleware | Handles serialization, rehydration, and storage abstraction |

**Key insight:** Desktop app foundations have many subtle requirements (native modules, process isolation, precision arithmetic) where established libraries prevent hard-to-debug issues later.

## Common Pitfalls

### Pitfall 1: Native Module Compilation Mismatch
**What goes wrong:** better-sqlite3 is compiled against system Node.js but Electron bundles a different Node version. App crashes with "NODE_MODULE_VERSION mismatch" error.
**Why it happens:** Electron bundles its own Node.js (v24.x in Electron 40). Native modules must be compiled against this version, not the system Node.
**How to avoid:** Run `npx electron-rebuild -f -w better-sqlite3` after every npm install. Add rebuild to postinstall script.
**Warning signs:** Error message containing "NODE_MODULE_VERSION" or "cannot find module 'better-sqlite3'".

### Pitfall 2: Preload Script Security Leak
**What goes wrong:** Exposing raw ipcRenderer or Node APIs to renderer allows malicious scripts to execute arbitrary code via IPC.
**Why it happens:** Developers expose entire modules for convenience rather than wrapping specific operations.
**How to avoid:** Only expose high-level, parameterized functions via contextBridge. Validate all inputs with Zod in main process handlers. Keep contextIsolation: true (default since Electron 12).
**Warning signs:** Preload script has `ipcRenderer.on` or `ipcRenderer.send` exposed; preload exposes require or fs.

### Pitfall 3: Floating-Point Accumulation in Volumes
**What goes wrong:** Volume calculations produce subtly wrong results (e.g., 10.1 + 10.2 = 20.299999999999997). Errors compound in subsequent phases.
**Why it happens:** JavaScript numbers are IEEE 754 floating-point, which cannot exactly represent many decimal fractions.
**How to avoid:** Use decimal.js for ALL volume/concentration values from Phase 1. Store volumes as Decimal instances, not numbers. Round only at display time.
**Warning signs:** Volumes ending in .9999 or .0001; sums not matching expected totals.

### Pitfall 4: Database Locked on Long Operations
**What goes wrong:** SQLite "database is locked" errors during file save or bulk operations. App becomes unresponsive.
**Why it happens:** SQLite default journal mode blocks readers during writes. Desktop apps need concurrent read/write.
**How to avoid:** Enable WAL mode: `db.pragma("journal_mode = WAL")` immediately after opening database.
**Warning signs:** "SQLITE_BUSY" errors; UI freezes during database operations.

### Pitfall 5: Missing Type Definitions for Window API
**What goes wrong:** TypeScript errors when accessing window.electronAPI because the global Window type doesn't include it.
**Why it happens:** contextBridge.exposeInMainWorld adds properties to window but TypeScript doesn't know about them.
**How to avoid:** Create declaration file: `src/renderer/types/electron.d.ts` with Window interface extension.
**Warning signs:** TypeScript errors like "Property 'electronAPI' does not exist on type 'Window'".

## Code Examples

Verified patterns from official sources and best practices:

### Database Connection with WAL Mode
```typescript
// src/main/db/client.ts
import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import { app } from 'electron';
import path from 'path';
import * as schema from './schema';

const dbPath = path.join(app.getPath('userData'), 'immunoplex.db');
const sqlite = new Database(dbPath);

// Enable WAL mode for concurrent read/write performance
sqlite.pragma('journal_mode = WAL');

export const db = drizzle(sqlite, { schema });
export { sqlite };
```

### Migration Runner
```typescript
// src/main/db/migrate.ts
import { migrate } from 'drizzle-orm/better-sqlite3/migrator';
import { db } from './client';
import path from 'path';

export function runMigrations() {
  const migrationsFolder = path.join(__dirname, '../../drizzle/migrations');
  migrate(db, { migrationsFolder });
}
```

### Window Type Declaration
```typescript
// src/renderer/types/electron.d.ts
import type { Platform, PlatformCreate } from '../../shared/types/platform';

export interface ElectronAPI {
  platform: {
    getAll: () => Promise<Platform[]>;
    getById: (id: string) => Promise<Platform | null>;
    create: (data: PlatformCreate) => Promise<Platform>;
    update: (data: Platform) => Promise<Platform>;
  };
  db: {
    health: () => Promise<{ ok: boolean }>;
  };
}

declare global {
  interface Window {
    electronAPI: ElectronAPI;
  }
}
```

### Platform Data Model with Zod Schema
```typescript
// src/shared/types/platform.ts
import { z } from 'zod';
import Decimal from 'decimal.js';

export const platformCreateSchema = z.object({
  name: z.string().min(1).max(100),
  description: z.string().optional(),
  stockConcentration: z.number().positive(), // Stored as number, converted to Decimal in app
});

export type PlatformCreate = z.infer<typeof platformCreateSchema>;

export interface Platform {
  id: string;
  name: string;
  description: string | null;
  stockConcentration: number;
  createdAt: string;
  updatedAt: string;
}

// Application-layer type with Decimal for calculations
export interface PlatformWithDecimal extends Omit<Platform, 'stockConcentration'> {
  stockConcentration: Decimal;
}
```

### Zustand Store for Platform Selection
```typescript
// src/renderer/stores/platformStore.ts
import { create } from 'zustand';
import type { Platform } from '../../shared/types/platform';

interface PlatformState {
  platforms: Platform[];
  selectedPlatformId: string | null;
  isLoading: boolean;
  error: string | null;

  // Actions
  loadPlatforms: () => Promise<void>;
  selectPlatform: (id: string) => void;
  getSelectedPlatform: () => Platform | null;
}

export const usePlatformStore = create<PlatformState>((set, get) => ({
  platforms: [],
  selectedPlatformId: null,
  isLoading: false,
  error: null,

  loadPlatforms: async () => {
    set({ isLoading: true, error: null });
    try {
      const platforms = await window.electronAPI.platform.getAll();
      set({ platforms, isLoading: false });
    } catch (err) {
      set({ error: String(err), isLoading: false });
    }
  },

  selectPlatform: (id: string) => {
    set({ selectedPlatformId: id });
  },

  getSelectedPlatform: () => {
    const { platforms, selectedPlatformId } = get();
    return platforms.find(p => p.id === selectedPlatformId) ?? null;
  },
}));
```

### Seed Data for Platforms
```typescript
// src/main/db/seed.ts
import { db } from './client';
import { platforms } from './schema';

const PLATFORM_SEED_DATA = [
  {
    id: 'milliplex',
    name: 'Milliplex',
    description: 'Millipore Milliplex MAP immunoassay platform',
    stockConcentration: 25, // 25x stock
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'biorad',
    name: 'BioRad',
    description: 'Bio-Rad Bio-Plex immunoassay platform',
    stockConcentration: 20, // 20x stock
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'procartaplex',
    name: 'ProCartaPlex',
    description: 'Thermo Fisher ProCartaPlex immunoassay platform',
    stockConcentration: 25, // 25x stock
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'rndsystems',
    name: 'R&D Systems',
    description: 'R&D Systems Luminex immunoassay platform',
    stockConcentration: 20, // 20x stock
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
];

export function seedPlatforms() {
  const existing = db.select().from(platforms).all();
  if (existing.length === 0) {
    db.insert(platforms).values(PLATFORM_SEED_DATA).run();
  }
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| webpack for Electron | Vite via electron-vite | 2024 | 10x faster HMR; simpler configuration |
| tailwind.config.js | CSS-first @theme in globals.css | Tailwind 4.0 (2025) | No config file needed; cleaner setup |
| tailwindcss-animate | tw-animate-css | shadcn/ui Tailwind v4 update | Compatibility with Tailwind 4 |
| node-sqlite3 (async) | better-sqlite3 (sync) | Established best practice | 10x performance; simpler API for desktop |
| forwardRef in React | Direct ref on components | React 19 | Less boilerplate; shadcn/ui updated |

**Deprecated/outdated:**
- **Create React App (CRA):** No longer maintained; use Vite
- **tailwindcss-animate:** Deprecated for Tailwind v4; use tw-animate-css
- **tailwind.config.js:** Tailwind 4 uses CSS-first configuration
- **forwardRef:** React 19 handles refs without wrapper

## Open Questions

Things that couldn't be fully resolved:

1. **Exact stock concentrations for each platform**
   - What we know: Platforms have different default stock concentrations (20x, 25x typical)
   - What's unclear: Actual values vary by kit within each platform
   - Recommendation: Seed with representative defaults; allow admin to edit per kit in later phases

2. **Bead region data in platform configuration**
   - What we know: Phase 2 needs bead region validation per platform
   - What's unclear: Whether to include bead region schema in Phase 1 data model
   - Recommendation: Keep Phase 1 data model minimal (id, name, description, stockConcentration). Add bead regions in Phase 2 when that feature is built.

3. **User data storage location on Windows**
   - What we know: Electron's app.getPath('userData') returns appropriate location
   - What's unclear: Whether lab IT policies restrict this location
   - Recommendation: Use app.getPath('userData') as default; document for IT review

## Sources

### Primary (HIGH confidence)
- [electron-vite Official Guide](https://electron-vite.org/guide/) - Project structure, configuration, CLI commands
- [Electron Context Isolation](https://www.electronjs.org/docs/latest/tutorial/context-isolation) - Security patterns for preload scripts
- [Electron IPC Tutorial](https://www.electronjs.org/docs/latest/tutorial/ipc) - Inter-process communication patterns
- [Drizzle ORM SQLite Guide](https://orm.drizzle.team/docs/get-started-sqlite) - better-sqlite3 integration, migrations
- [better-sqlite3 GitHub](https://github.com/WiseLibs/better-sqlite3) - WAL mode, performance patterns
- [decimal.js API](https://mikemcl.github.io/decimal.js/) - Precision configuration, arithmetic methods
- [shadcn/ui Tailwind v4](https://ui.shadcn.com/docs/tailwind-v4) - Updated installation for Tailwind 4

### Secondary (MEDIUM confidence)
- [Zustand GitHub](https://github.com/pmndrs/zustand) - React 19 compatibility, persist middleware
- [electron-vite-react Boilerplate](https://github.com/electron-vite/electron-vite-react) - Project structure reference
- [Electron Security Best Practices](https://www.electronjs.org/docs/latest/tutorial/security) - contextBridge, input validation
- [State Management 2026 Patterns](https://www.nucamp.co/blog/state-management-in-2026-redux-context-api-and-modern-patterns) - Zustand adoption trends

### Tertiary (LOW confidence)
- Platform stock concentration values - Need validation with actual kit documentation
- Windows enterprise IT policies for userData location - May need adjustment per deployment

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - All libraries verified via official documentation; versions confirmed current
- Architecture: HIGH - Patterns verified from Electron official docs, electron-vite templates, and established practices
- Pitfalls: HIGH - Native module issues and IPC security are well-documented; floating-point pitfall from project research

**Research date:** 2026-01-22
**Valid until:** 60 days (stack is stable; no major breaking changes expected)
