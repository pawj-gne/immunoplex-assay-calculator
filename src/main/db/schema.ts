import { sqliteTable, text, real } from 'drizzle-orm/sqlite-core'

export const platforms = sqliteTable('platforms', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  description: text('description'),
  stockConcentration: real('stock_concentration').notNull(),
  createdAt: text('created_at').notNull(),
  updatedAt: text('updated_at').notNull()
})

// Type inference helpers
export type Platform = typeof platforms.$inferSelect
export type NewPlatform = typeof platforms.$inferInsert
