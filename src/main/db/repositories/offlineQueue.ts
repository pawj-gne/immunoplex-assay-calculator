import { asc, eq } from 'drizzle-orm'
import { getLocalDatabase } from '../clientLocal'
import { offlineQueue } from '../schema'
import type { OfflineQueueItem, OfflineQueueInsert } from '../schema'

// Phase 6 Plan 03 (D-07, NET-03/04): offline queue CRUD on the client-side
// local DB (immunoplex-local.db). Rows hold the full JSON payload plus a
// client-generated runId — used by httpTransport on the offline path
// (enqueue) and on reconnect flush (getAll → POST → dequeue).
//
// Always reads/writes via getLocalDatabase() — the client-mode local DB.
// Never use this against the central immunoplex.db; the offline_queue
// table is created on local DB during client-mode startup migrations.
export const offlineQueueRepository = {
  /**
   * Returns all queued items in INSERTION ORDER (id ASC) — flush must
   * preserve original ordering per D-08 / NET-04.
   */
  getAll(): OfflineQueueItem[] {
    const db = getLocalDatabase()
    return db.select().from(offlineQueue).orderBy(asc(offlineQueue.id)).all()
  },

  /**
   * Inserts a new queued item with queuedAt = now (ISO string). Returns the
   * inserted row (with autoincrement id) so the caller can reference it.
   */
  enqueue(data: Omit<OfflineQueueInsert, 'id' | 'queuedAt'>): OfflineQueueItem {
    const db = getLocalDatabase()
    const queuedAt = new Date().toISOString()
    db.insert(offlineQueue).values({ ...data, queuedAt }).run()
    // SQLite autoincrement — last row by id is the just-inserted one.
    const all = db.select().from(offlineQueue).orderBy(asc(offlineQueue.id)).all()
    const last = all.at(-1)
    if (!last) throw new Error('offlineQueueRepository.enqueue: no row returned after insert')
    return last
  },

  /**
   * Removes a single item by id — called only AFTER the server confirms
   * (200 success or 200-on-duplicate) per D-08.
   */
  dequeue(id: number): void {
    const db = getLocalDatabase()
    db.delete(offlineQueue).where(eq(offlineQueue.id, id)).run()
  },

  /**
   * TEST-ONLY: clears the entire queue. Production code never bulk-deletes —
   * dequeue is per-item, gated on server confirmation.
   */
  clear(): void {
    const db = getLocalDatabase()
    db.delete(offlineQueue).run()
  }
}
