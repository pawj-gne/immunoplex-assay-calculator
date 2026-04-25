import { sqliteTable, text, real, integer, uniqueIndex } from 'drizzle-orm/sqlite-core'

export const platforms = sqliteTable('platforms', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  description: text('description'),
  stockConcentration: real('stock_concentration').notNull(),
  createdAt: text('created_at').notNull(),
  updatedAt: text('updated_at').notNull()
})

export const species = sqliteTable('species', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  platformId: text('platform_id')
    .notNull()
    .references(() => platforms.id),
  createdAt: text('created_at').notNull(),
  updatedAt: text('updated_at').notNull()
})

// Phase 5 (v2.0 D-09): Master panel — anchors reagent volumes and vendor singles term
// per (platform, species) pair. Composite UNIQUE on (platform_id, species_id).
export const masterPanels = sqliteTable(
  'master_panels',
  {
    id: text('id').primaryKey(),
    name: text('name').notNull(),
    platformId: text('platform_id')
      .notNull()
      .references(() => platforms.id, { onDelete: 'restrict' }),
    speciesId: text('species_id')
      .notNull()
      .references(() => species.id, { onDelete: 'restrict' }),
    beadsVolumePerWell: real('beads_volume_per_well').notNull(),
    abVolumePerWell: real('ab_volume_per_well').notNull(),
    sapeVolumePerWell: real('sape_volume_per_well').notNull(),
    vendorSinglesTerm: text('vendor_singles_term'),
    createdAt: text('created_at').notNull(),
    updatedAt: text('updated_at').notNull()
  },
  (t) => ({
    platformSpeciesUniq: uniqueIndex('master_panels_platform_species_uniq').on(
      t.platformId,
      t.speciesId
    )
  })
)

// `premixPanels` holds both master panels (parentPanelId = null) and their
// child sub-panels (parentPanelId set). Sub-panels carry the concentration
// applied to all their analytes via `subPanelConc`; master panels keep the
// default `subPanelConc = 1` and act as containers.
export const premixPanels = sqliteTable('premix_panels', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  description: text('description'),
  platformId: text('platform_id')
    .notNull()
    .references(() => platforms.id),
  speciesId: text('species_id')
    .notNull()
    .references(() => species.id),
  masterPanelId: text('master_panel_id').references(() => masterPanels.id, {
    onDelete: 'set null'
  }),
  parentPanelId: text('parent_panel_id'),
  subPanelConc: real('sub_panel_conc').notNull().default(1),
  createdAt: text('created_at').notNull(),
  updatedAt: text('updated_at').notNull()
})

export const analytes = sqliteTable('analytes', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  beadRegion: integer('bead_region').notNull(),
  premixConc: real('premix_conc').notNull(),
  singleConc: real('single_conc').notNull(),
  platformId: text('platform_id')
    .notNull()
    .references(() => platforms.id),
  speciesId: text('species_id')
    .notNull()
    .references(() => species.id),
  masterPanelId: text('master_panel_id').references(() => masterPanels.id, {
    onDelete: 'set null'
  }),
  createdAt: text('created_at').notNull(),
  updatedAt: text('updated_at').notNull()
})

export const panelAnalytes = sqliteTable('panel_analytes', {
  id: text('id').primaryKey(),
  panelId: text('panel_id')
    .notNull()
    .references(() => premixPanels.id),
  analyteId: text('analyte_id')
    .notNull()
    .references(() => analytes.id),
  createdAt: text('created_at').notNull()
})

// Phase 4: Operators (lab roster) — D-20
export const operators = sqliteTable('operators', {
  id: text('id').primaryKey(),
  name: text('name').notNull().unique(),
  active: integer('active', { mode: 'boolean' }).notNull().default(true),
  createdAt: text('created_at').notNull(),
  updatedAt: text('updated_at').notNull()
})

// Phase 4: Runs — one record per lab request on one platform/species/panel
export const runs = sqliteTable('runs', {
  id: text('id').primaryKey(),
  // Request identity
  requestNumber: integer('request_number'), // nullable; must be non-null when requestOverrideAdHoc=false
  requestOverrideAdHoc: integer('request_override_ad_hoc', { mode: 'boolean' })
    .notNull()
    .default(false),
  // Who / when
  userName: text('user_name').notNull(),
  operatorId: text('operator_id')
    .notNull()
    .references(() => operators.id),
  runDate: text('run_date').notNull(), // ISO date string e.g. "2026-04-22"
  // Assay shape
  sampleType: text('sample_type').notNull(), // enum: 'Supernatant'|'Lysate'|'Lavage'|'Plasma'|'Serum'
  dilutionFactor: real('dilution_factor').notNull(),
  sampleCount: integer('sample_count').notNull(),
  replicateMode: text('replicate_mode').notNull(), // 'singles' | 'duplicates'
  requestType: text('request_type').notNull(), // 'premix' | 'premix_singles' | 'custom' — immutable after create
  platformId: text('platform_id')
    .notNull()
    .references(() => platforms.id), // immutable after create
  speciesId: text('species_id')
    .notNull()
    .references(() => species.id), // immutable after create
  panelId: text('panel_id').references(() => premixPanels.id), // nullable for custom
  volumePerWell: real('volume_per_well').notNull(),
  deadVolume: real('dead_volume').notNull(),
  // Positions (D-16: integers with fixed ranges, NOT free text)
  hamilton: integer('hamilton').notNull(), // 1-5
  runPlatePosition: integer('run_plate_position').notNull(), // 1-4
  standardPosition: integer('standard_position').notNull(), // 1-2
  troughPosition: integer('trough_position').notNull(), // 1-2
  // Free text + derived
  comments: text('comments'), // nullable, unbounded length per D-Discretion
  plex: integer('plex').notNull(), // auto-derived at save time = analyteIds.length
  plateCount: integer('plate_count').notNull(), // auto-derived = plateStore.getPlateCount()
  platesJson: text('plates_json').notNull(), // JSON.stringify(Record<plateNumber, string[]>); D-02/D-18 round-trip
  createdAt: text('created_at').notNull(),
  updatedAt: text('updated_at').notNull(),
  // Phase 6: machine provenance for D-02 conflict display
  machineName: text('machine_name'), // os.hostname() at save time; null for pre-Phase-6 rows
  isOfflineSave: integer('is_offline_save', { mode: 'boolean' }).notNull().default(false)
})

// Phase 4: Single analytes selected for a given run (D-19)
export const runSingleAnalytes = sqliteTable('run_single_analytes', {
  id: text('id').primaryKey(),
  runId: text('run_id')
    .notNull()
    .references(() => runs.id),
  analyteId: text('analyte_id')
    .notNull()
    .references(() => analytes.id),
  createdAt: text('created_at').notNull()
})

// Phase 6: offline queue for client-mode saves when server is unreachable (D-07)
export const offlineQueue = sqliteTable('offline_queue', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  runId: text('run_id').notNull(), // client-generated UUID; idempotency key on flush
  operation: text('operation').notNull(), // 'create' | 'update' | 'delete'
  payload: text('payload').notNull(), // JSON.stringify of RunCreate | { id, ...RunUpdate } | { id }
  queuedAt: text('queued_at').notNull()
})

// Type inference helpers
export type Platform = typeof platforms.$inferSelect
export type NewPlatform = typeof platforms.$inferInsert

export type Species = typeof species.$inferSelect
export type NewSpecies = typeof species.$inferInsert

export type PremixPanel = typeof premixPanels.$inferSelect
export type NewPremixPanel = typeof premixPanels.$inferInsert

export type MasterPanel = typeof masterPanels.$inferSelect
export type NewMasterPanel = typeof masterPanels.$inferInsert

export type Analyte = typeof analytes.$inferSelect
export type NewAnalyte = typeof analytes.$inferInsert

export type PanelAnalyte = typeof panelAnalytes.$inferSelect
export type NewPanelAnalyte = typeof panelAnalytes.$inferInsert

export type Operator = typeof operators.$inferSelect
export type OperatorInsert = typeof operators.$inferInsert

export type Run = typeof runs.$inferSelect
export type RunInsert = typeof runs.$inferInsert

export type RunSingleAnalyte = typeof runSingleAnalytes.$inferSelect
export type RunSingleAnalyteInsert = typeof runSingleAnalytes.$inferInsert

export type OfflineQueueItem = typeof offlineQueue.$inferSelect
export type OfflineQueueInsert = typeof offlineQueue.$inferInsert
