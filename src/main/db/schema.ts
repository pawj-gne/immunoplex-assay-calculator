import { sqliteTable, text, real, integer } from 'drizzle-orm/sqlite-core'

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

// Type inference helpers
export type Platform = typeof platforms.$inferSelect
export type NewPlatform = typeof platforms.$inferInsert

export type Species = typeof species.$inferSelect
export type NewSpecies = typeof species.$inferInsert

export type PremixPanel = typeof premixPanels.$inferSelect
export type NewPremixPanel = typeof premixPanels.$inferInsert

export type Analyte = typeof analytes.$inferSelect
export type NewAnalyte = typeof analytes.$inferInsert

export type PanelAnalyte = typeof panelAnalytes.$inferSelect
export type NewPanelAnalyte = typeof panelAnalytes.$inferInsert
