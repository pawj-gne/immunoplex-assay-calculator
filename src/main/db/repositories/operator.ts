import { eq, asc } from 'drizzle-orm'
import { getDatabase } from '../client'
import { operators } from '../schema'
import type { Operator, OperatorCreate, OperatorUpdate } from '../../../shared/types/operator'

export const operatorRepository = {
  getAll(opts: { includeInactive?: boolean } = {}): Operator[] {
    const db = getDatabase()
    const rows = db.select().from(operators).orderBy(asc(operators.name)).all()
    return opts.includeInactive ? rows : rows.filter((r) => r.active)
  },

  getById(id: string): Operator | null {
    const db = getDatabase()
    const result = db.select().from(operators).where(eq(operators.id, id)).get()
    return result ?? null
  },

  create(data: OperatorCreate): Operator {
    const db = getDatabase()
    const now = new Date().toISOString()
    const id = crypto.randomUUID()
    db.insert(operators)
      .values({
        id,
        name: data.name,
        active: data.active ?? true,
        createdAt: now,
        updatedAt: now
      })
      .run()
    const created = operatorRepository.getById(id)
    if (!created) throw new Error(`Failed to create operator: ${id}`)
    return created
  },

  update(id: string, data: OperatorUpdate): Operator | null {
    const db = getDatabase()
    const existing = operatorRepository.getById(id)
    if (!existing) return null
    const now = new Date().toISOString()
    db.update(operators)
      .set({
        name: data.name ?? existing.name,
        active: data.active ?? existing.active,
        updatedAt: now
      })
      .where(eq(operators.id, id))
      .run()
    return operatorRepository.getById(id)
  },

  softDelete(id: string): Operator | null {
    return operatorRepository.update(id, { active: false })
  }
}
