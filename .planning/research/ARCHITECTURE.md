# Architecture Research

**Domain:** Laboratory Assay Calculator / Run Documentation System
**Researched:** 2026-01-22
**Confidence:** MEDIUM (patterns verified from multiple sources; specific implementation details will require validation during build)

## Standard Architecture

### System Overview

```
+-----------------------------------------------------------------------+
|                         PRESENTATION LAYER                             |
|  +---------------+  +---------------+  +---------------+              |
|  | Calculator    |  | Run Documen-  |  | History/      |              |
|  | Views         |  | tation Views  |  | Search Views  |              |
|  +-------+-------+  +-------+-------+  +-------+-------+              |
|          |                  |                  |                       |
+----------+------------------+------------------+-----------------------+
           |                  |                  |
+----------+------------------+------------------+-----------------------+
|                         VIEWMODEL LAYER                                |
|  +---------------+  +---------------+  +---------------+              |
|  | Calculation   |  | Run/Batch     |  | Search/       |              |
|  | ViewModels    |  | ViewModels    |  | Filter VMs    |              |
|  +-------+-------+  +-------+-------+  +-------+-------+              |
|          |                  |                  |                       |
+----------+------------------+------------------+-----------------------+
           |                  |                  |
+----------+------------------+------------------+-----------------------+
|                         SERVICE LAYER                                  |
|  +---------------+  +---------------+  +---------------+              |
|  | Calculation   |  | Run           |  | Search        |              |
|  | Engine        |  | Manager       |  | Service       |              |
|  +-------+-------+  +-------+-------+  +-------+-------+              |
|          |                  |                  |                       |
+----------+------------------+------------------+-----------------------+
           |                  |                  |
+----------+------------------+------------------+-----------------------+
|                         DATA LAYER                                     |
|  +---------------+  +---------------+  +---------------+              |
|  | Platform      |  | Run Records   |  | File Storage  |              |
|  | Config Store  |  | Store         |  | (Photos)      |              |
|  +---------------+  +---------------+  +---------------+              |
+-----------------------------------------------------------------------+
```

### Component Responsibilities

| Component | Responsibility | Typical Implementation |
|-----------|----------------|------------------------|
| **Calculator Views** | Display reagent calculator UI, volume inputs, dilution parameters | React components with controlled inputs |
| **Run Documentation Views** | Capture run metadata, lot numbers, plate layouts | Form-heavy components, plate grid visualization |
| **History/Search Views** | Browse and filter past runs, troubleshooting interface | Data table with filtering, detail views |
| **Calculation ViewModels** | Orchestrate calculation state, validate inputs, format outputs | Observable state containers with derived values |
| **Run/Batch ViewModels** | Manage run lifecycle, track save state, handle attachments | CRUD state machine, attachment queue management |
| **Search/Filter VMs** | Manage search criteria, pagination, result caching | Query builder pattern, debounced search |
| **Calculation Engine** | Pure calculation logic: dilutions, volumes, concentrations | Stateless functions, no side effects |
| **Run Manager** | Persist run records, manage audit trail, coordinate file storage | Transaction coordination, change tracking |
| **Search Service** | Index and query run history, full-text search | Query optimization, result ranking |
| **Platform Config Store** | Store platform-specific parameters (stock concentrations, analytes, bead regions) | Seeded reference data, user-editable |
| **Run Records Store** | Store individual run records with full metadata | Relational data with audit fields |
| **File Storage** | Store attached photos (plate images, documentation) | Local filesystem with database references |

## Recommended Project Structure

```
src/
+-- main/                    # Electron/Tauri main process
|   +-- index.ts             # Main process entry point
|   +-- ipc/                 # IPC handlers (main <-> renderer)
|   +-- services/            # Main process services
|   |   +-- database.ts      # SQLite connection management
|   |   +-- file-storage.ts  # Photo/file management
|   |   +-- export.ts        # PDF/report generation
|   +-- migrations/          # Database schema migrations
|
+-- renderer/                # UI (React application)
|   +-- App.tsx              # Root component, routing
|   +-- components/          # Shared UI components
|   |   +-- forms/           # Reusable form components
|   |   +-- plate/           # Plate visualization components
|   |   +-- layout/          # App shell, navigation
|   |
|   +-- features/            # Feature-based organization
|   |   +-- calculator/      # Reagent calculator feature
|   |   |   +-- components/  # Calculator-specific UI
|   |   |   +-- hooks/       # Calculator state hooks
|   |   |   +-- types.ts     # Calculator types
|   |   |
|   |   +-- run-docs/        # Run documentation feature
|   |   |   +-- components/  # Run form, plate mapper
|   |   |   +-- hooks/       # Run state management
|   |   |   +-- types.ts     # Run record types
|   |   |
|   |   +-- history/         # Run history feature
|   |   |   +-- components/  # Search UI, result table
|   |   |   +-- hooks/       # Search state
|   |   |   +-- types.ts     # Search/filter types
|   |   |
|   |   +-- settings/        # Platform configuration
|   |       +-- components/  # Settings forms
|   |       +-- hooks/       # Settings state
|   |
|   +-- lib/                 # Shared utilities
|   |   +-- calculations/    # Pure calculation functions
|   |   +-- validation/      # Input validation
|   |   +-- formatting/      # Display formatting
|   |
|   +-- types/               # Shared TypeScript types
|   +-- hooks/               # Global hooks (IPC, storage)
|
+-- shared/                  # Shared between main and renderer
    +-- types/               # Cross-process type definitions
    +-- constants/           # Shared constants
    +-- ipc-channels.ts      # IPC channel definitions
```

### Structure Rationale

- **main/ vs renderer/:** Clean separation required by Electron/Tauri. Main process handles filesystem, database; renderer handles UI. Communication via IPC.
- **features/:** Feature-based organization groups related components, hooks, and types. Easier to understand boundaries, easier to delete/refactor features.
- **lib/calculations/:** Pure functions with no dependencies on UI or storage. Testable in isolation, reusable across features.
- **shared/:** TypeScript types that both processes need. IPC channel names as constants prevent typos.

## Architectural Patterns

### Pattern 1: MVVM with Observable State

**What:** Model-View-ViewModel pattern where ViewModels expose observable state that Views bind to. ViewModels contain presentation logic but delegate business logic to services.

**When to use:** All UI features. Particularly important for the calculator where input changes should immediately reflect in output previews.

**Trade-offs:**
- PRO: Clear separation of concerns, testable logic
- PRO: Reactive updates without manual DOM manipulation
- CON: More boilerplate than direct state mutation
- CON: Can over-engineer simple CRUD screens

**Example (React with hooks as ViewModel):**
```typescript
// hooks/useReagentCalculator.ts
export function useReagentCalculator(platformConfig: PlatformConfig) {
  const [inputs, setInputs] = useState<CalculatorInputs>(defaultInputs);

  // Derived state (computed on every render)
  const results = useMemo(() =>
    calculateReagentVolumes(inputs, platformConfig),
    [inputs, platformConfig]
  );

  const validationErrors = useMemo(() =>
    validateCalculatorInputs(inputs, platformConfig),
    [inputs, platformConfig]
  );

  const isValid = validationErrors.length === 0;

  return {
    inputs,
    setInputs,
    results,
    validationErrors,
    isValid,
  };
}
```

### Pattern 2: IPC Message Passing

**What:** Main process and renderer process communicate through strongly-typed message channels. Renderer sends requests, main process performs privileged operations (file I/O, database), returns results.

**When to use:** Any operation requiring filesystem access, database queries, or system-level features.

**Trade-offs:**
- PRO: Security (renderer has no direct filesystem access)
- PRO: Type safety with shared channel definitions
- CON: Async overhead for simple operations
- CON: More complex than direct function calls

**Example:**
```typescript
// shared/ipc-channels.ts
export const IPC_CHANNELS = {
  RUN_SAVE: 'run:save',
  RUN_GET: 'run:get',
  RUN_SEARCH: 'run:search',
  PHOTO_SAVE: 'photo:save',
  PHOTO_GET: 'photo:get',
} as const;

// main/ipc/run-handlers.ts
ipcMain.handle(IPC_CHANNELS.RUN_SAVE, async (event, run: RunRecord) => {
  return await runRepository.save(run);
});

// renderer/hooks/useRunSave.ts
export function useRunSave() {
  const save = async (run: RunRecord) => {
    return await ipcRenderer.invoke(IPC_CHANNELS.RUN_SAVE, run);
  };
  return { save };
}
```

### Pattern 3: Repository Pattern for Data Access

**What:** Abstract data storage behind repository interfaces. Repositories handle persistence details; services use repositories without knowing storage implementation.

**When to use:** All data persistence. Essential for run records, platform configs, and file references.

**Trade-offs:**
- PRO: Can swap storage implementation (SQLite -> different DB)
- PRO: Centralizes query logic
- PRO: Easy to add audit trail in one place
- CON: Extra abstraction layer

**Example:**
```typescript
// types/repositories.ts
interface RunRepository {
  save(run: RunRecord): Promise<RunRecord>;
  getById(id: string): Promise<RunRecord | null>;
  search(criteria: SearchCriteria): Promise<SearchResult<RunRecord>>;
  getByDateRange(start: Date, end: Date): Promise<RunRecord[]>;
}

// main/repositories/sqlite-run-repository.ts
export class SqliteRunRepository implements RunRepository {
  constructor(private db: Database) {}

  async save(run: RunRecord): Promise<RunRecord> {
    // Insert with audit fields
    const now = new Date().toISOString();
    const record = {
      ...run,
      id: run.id || generateId(),
      created_at: run.created_at || now,
      updated_at: now,
    };
    await this.db.run(
      `INSERT OR REPLACE INTO runs (...) VALUES (...)`,
      [...]
    );
    return record;
  }
}
```

### Pattern 4: Domain Events for Audit Trail

**What:** Record business-significant events as immutable audit records. Every change to a run record creates an audit event capturing who, what, when.

**When to use:** All run record modifications. Required for troubleshooting and regulatory compliance.

**Trade-offs:**
- PRO: Full history of all changes
- PRO: Can reconstruct state at any point in time
- CON: More storage
- CON: Queries become more complex if auditing affects reads

**Example:**
```typescript
// types/audit.ts
interface AuditEvent {
  id: string;
  entity_type: 'run' | 'platform_config';
  entity_id: string;
  action: 'created' | 'updated' | 'deleted';
  changes: Record<string, { old: any; new: any }>;
  user: string;       // Could be machine name or user ID
  timestamp: string;  // ISO 8601
  reason?: string;    // Optional reason for change
}

// main/services/audit-service.ts
export class AuditService {
  async recordChange<T extends { id: string }>(
    entityType: string,
    oldValue: T | null,
    newValue: T,
    reason?: string
  ) {
    const changes = computeDiff(oldValue, newValue);
    if (Object.keys(changes).length === 0) return;

    await this.auditRepository.save({
      id: generateId(),
      entity_type: entityType,
      entity_id: newValue.id,
      action: oldValue ? 'updated' : 'created',
      changes,
      user: await this.getCurrentUser(),
      timestamp: new Date().toISOString(),
      reason,
    });
  }
}
```

## Data Flow

### Calculator Flow

```
User Input (sample count, volumes, concentrations)
    |
    v
[Input Validation] --> Validation Errors --> UI Feedback
    |
    | (if valid)
    v
[Calculation Engine] --> Calculate volumes, dilutions, concentrations
    |
    v
[Results Formatting] --> Format for display (units, decimals)
    |
    v
[Results View] --> Display prep recipe, volumes table
    |
    | (user action: "Save to Run")
    v
[Run Creation] --> Pre-populate run record with calculation results
```

### Run Documentation Flow

```
[New Run / Load Existing]
    |
    v
[Run Form State] <-- Platform Config (analytes, bead regions)
    |
    +-- Metadata Entry (date, operator, platform)
    +-- Lot Number Entry (reagents, standards, controls)
    +-- Plate Layout Editor --> [Plate Mapper Component]
    +-- Photo Upload --> [IPC: File Save] --> Local Filesystem
    |
    v
[Save Run]
    |
    +-- [IPC: Run Save] --> [Run Repository] --> SQLite
    +-- [Audit Service] --> Record changes --> Audit Table
    |
    v
[Confirmation] --> Run saved, available in history
```

### Search/History Flow

```
[Search UI]
    |
    +-- Date Range Filter
    +-- Platform Filter
    +-- Keyword Search (lot numbers, notes)
    |
    v
[Debounced Search Query]
    |
    v
[IPC: Run Search] --> [Search Service] --> SQLite Query
    |
    v
[Search Results] --> Paginated list
    |
    | (user selects run)
    v
[IPC: Run Get] --> [Run Repository] --> Full record + photo paths
    |
    v
[Run Detail View] --> Display all metadata, plate layout, photos
```

### Key Data Flows

1. **Calculator to Run:** Calculation results flow into run documentation as pre-filled values. User completes remaining metadata and saves.

2. **Photo Upload:** Photos captured on mobile/camera transfer to PC. User selects file, file copied to app-managed storage directory, database stores reference path.

3. **Run to History:** Saved runs immediately searchable. Audit trail captures all modifications for troubleshooting timeline reconstruction.

## Data Model

### Core Entities

```
+-------------------+       +-------------------+       +-------------------+
| Platform          |       | Run               |       | PlateWell         |
+-------------------+       +-------------------+       +-------------------+
| id                |<---+  | id                |<---+  | id                |
| name              |    |  | platform_id (FK)  |----+  | run_id (FK)       |----+
| description       |    |  | run_date          |       | position (A1-H12) |    |
| stock_conc        |    |  | operator          |       | sample_id         |    |
| analytes (JSON)   |    |  | notes             |       | sample_type       |    |
| bead_regions      |    |  | calculation_params|       | dilution_factor   |    |
| created_at        |    |  | created_at        |       +-------------------+    |
| updated_at        |    |  | updated_at        |                                |
+-------------------+    |  +-------------------+                                |
                         |          |                                            |
                         |          v                                            |
+-------------------+    |  +-------------------+       +-------------------+    |
| AuditEvent        |    |  | RunLotNumber      |       | RunPhoto          |    |
+-------------------+    |  +-------------------+       +-------------------+    |
| id                |    |  | id                |       | id                |    |
| entity_type       |    |  | run_id (FK)       |----+  | run_id (FK)       |----+
| entity_id         |----+  | reagent_type      |       | file_path         |
| action            |       | lot_number        |       | description       |
| changes (JSON)    |       | expiration_date   |       | captured_at       |
| user              |       +-------------------+       +-------------------+
| timestamp         |
| reason            |
+-------------------+
```

### Well Position Representation

**Recommendation:** Use alphanumeric well addresses (A1, B2, H12) as the canonical representation.

```typescript
// types/plate.ts
type WellRow = 'A' | 'B' | 'C' | 'D' | 'E' | 'F' | 'G' | 'H';
type WellColumn = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12;
type WellPosition = `${WellRow}${WellColumn}`; // "A1", "B2", etc.

interface WellData {
  position: WellPosition;
  sampleId?: string;
  sampleType: 'standard' | 'control' | 'unknown' | 'blank';
  dilutionFactor?: number;
  notes?: string;
}

// Utility functions for grid operations
function wellToIndex(position: WellPosition): { row: number; col: number };
function indexToWell(row: number, col: number): WellPosition;
```

## Scaling Considerations

| Scale | Architecture Adjustments |
|-------|--------------------------|
| Single user, local | SQLite is sufficient. File storage in app data directory. No sync needed. |
| Single lab, multi-workstation | Shared network folder for database + photos. File locking considerations. May need to switch to server-based database (PostgreSQL). |
| Multi-lab, enterprise | Full LIMS system needed. This architecture is for single-lab use. |

### Scaling Priorities

1. **First bottleneck:** Photo storage. Large image files will fill local drives. Mitigation: Configurable storage location, image compression, archival strategy.

2. **Second bottleneck:** Search performance on large run history. Mitigation: Add indexes, implement pagination, consider full-text search (SQLite FTS5).

## Anti-Patterns

### Anti-Pattern 1: Calculation Logic in UI Components

**What people do:** Put dilution formulas and volume calculations directly in React components.

**Why it's wrong:**
- Impossible to unit test without rendering components
- Duplicated logic if same calculation needed elsewhere
- Mixed concerns make components hard to understand

**Do this instead:** Extract all calculations to pure functions in `lib/calculations/`. Components call these functions and display results.

### Anti-Pattern 2: Storing Photos in Database

**What people do:** Store photo binary data as BLOBs in SQLite.

**Why it's wrong:**
- Dramatically increases database size
- Slows all database operations (backups, queries)
- Cannot easily view/manage photos outside app

**Do this instead:** Store photos on filesystem, store file paths in database. Use consistent naming convention with run ID.

### Anti-Pattern 3: Mutable Run Records Without Audit

**What people do:** Allow editing run records without tracking changes.

**Why it's wrong:**
- Cannot reconstruct what happened during troubleshooting
- No accountability for changes
- Regulatory compliance issues in lab environments

**Do this instead:** Every modification creates an audit event. Consider immutable run records with amendment records for corrections.

### Anti-Pattern 4: Tight Coupling Between Calculator and Run Documentation

**What people do:** Calculator component directly creates and saves run records.

**Why it's wrong:**
- Calculator becomes dependent on run storage
- Cannot use calculator standalone
- Harder to test calculator logic

**Do this instead:** Calculator outputs calculation results. Separate action/flow transfers results to run documentation. Run documentation saves to storage.

## Integration Points

### External Services

| Service | Integration Pattern | Notes |
|---------|---------------------|-------|
| Camera/Mobile Photo | File system drop / manual copy | User transfers photos to PC, selects in app |
| Network File Share | Configurable storage paths | If sharing across workstations |
| PDF Generation | Main process service | Generate prep recipes, run reports |
| Excel Export | Main process service | Export run history, search results |

### Internal Boundaries

| Boundary | Communication | Notes |
|----------|---------------|-------|
| Main Process <-> Renderer | IPC (invoke/handle) | Typed channels, async operations |
| Calculator Feature <-> Run Docs Feature | Props/events through parent | Calculator results passed to run form |
| UI Components <-> Data Layer | Custom hooks | Hooks encapsulate IPC calls, provide loading/error states |
| Calculation Engine <-> Everything | Function calls | Pure functions, no side effects, synchronous |

## Build Order Implications

Based on the architecture, the recommended build order (dependencies flow top to bottom):

1. **Phase 1: Foundation**
   - Project scaffolding (Electron/Tauri + React + TypeScript)
   - Database setup (SQLite, migrations)
   - IPC infrastructure (channel definitions, handlers)
   - Basic shell UI (navigation, layout)

2. **Phase 2: Platform Configuration**
   - Platform/assay definition data model
   - CRUD UI for platform parameters
   - Seed data for common platforms
   - *Rationale:* Calculator needs platform config to function

3. **Phase 3: Calculator Core**
   - Calculation engine (pure functions)
   - Calculator UI with platform selection
   - Validation and error handling
   - *Rationale:* Core value proposition; independent of storage

4. **Phase 4: Run Documentation**
   - Run record data model + repository
   - Run form UI with plate mapper
   - Photo upload and storage
   - Audit trail implementation
   - *Rationale:* Depends on platform config; can use calculator results

5. **Phase 5: History and Search**
   - Search service and indexes
   - Search UI with filters
   - Run detail view
   - Export functionality
   - *Rationale:* Needs existing runs to search

## Sources

- [LIMS Architecture - Wikipedia](https://en.wikipedia.org/wiki/Laboratory_information_management_system) - LIMS architecture types (thick-client, thin-client, web-based)
- [USGS MERLIN LIMS Architecture](https://www.usgs.gov/labs/m3-research-laboratory/laboratory-information-management-system-lims) - Three-tier architecture example (PostgreSQL, Django REST, Vue.js)
- [LabKey Luminex Calculations](https://www.labkey.org/Documentation/wiki-page.view?name=luminexCalculations) - Luminex calculation pipeline architecture
- [Microsoft Calculator Architecture](https://github.com/Microsoft/calculator/blob/main/docs/ApplicationArchitecture.md) - MVVM pattern, calculator engine layering
- [Electron Database Options](https://rxdb.info/electron-database.html) - SQLite recommended for Electron; IPC patterns
- [LogRocket Advanced Electron Architecture](https://blog.logrocket.com/advanced-electron-js-architecture/) - Main/renderer separation, IPC best practices
- [Offline-First Design Patterns](https://medium.com/offline-camp/offline-first-design-patterns-engineering-1c66821137d3) - Local-first data patterns
- [Wellmap File Format](https://bmcresnotes.biomedcentral.com/articles/10.1186/s13104-021-05573-0) - Microplate well mapping data structure
- [NEB Plate-Map Tool](https://github.com/nebiolabs/plate-map) - Well-addressed data structure example
- [Audit Trail Requirements for Labs](https://www.technologynetworks.com/informatics/articles/audit-trail-requirements-for-a-digitalized-regulated-laboratory-401729) - Laboratory audit trail design requirements
- [Tauri vs Electron 2026](https://www.gethopp.app/blog/tauri-vs-electron) - Framework comparison for desktop apps

---
*Architecture research for: Immunoplex Assay Calculator*
*Researched: 2026-01-22*
