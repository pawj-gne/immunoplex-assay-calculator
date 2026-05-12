import { describe, it, expect } from 'vitest'
import { createTestDb, seedPlatformAndSpecies } from './testDb'

describe('client PRAGMA + FK enforcement (SC #4 / D-12)', () => {
  it('has foreign_keys = ON after createTestDb()', () => {
    const { sqlite } = createTestDb()
    const result = sqlite.pragma('foreign_keys', { simple: true })
    expect(result).toBe(1) // better-sqlite3 returns 1/0, not true/false
  })

  it('rejects DELETE of a platform referenced by a master_panel (onDelete: restrict)', () => {
    const { sqlite } = createTestDb()
    const { platformId, speciesId } = seedPlatformAndSpecies(sqlite)
    const now = new Date().toISOString()
    // Phase 13 D-10: master_panels lost beads/ab/sape_volume_per_well columns
    // and gained sape_name + description. Per-reagent volumes now live in
    // master_panel_reagents — not exercised here since this test verifies the
    // platform→master_panel FK restrict behavior only.
    sqlite
      .prepare(
        `INSERT INTO master_panels
         (id, name, platform_id, species_id, sape_name, description, vendor_singles_term, created_at, updated_at)
         VALUES (?, 'P1', ?, ?, NULL, NULL, NULL, ?, ?)`
      )
      .run(crypto.randomUUID(), platformId, speciesId, now, now)

    expect(() =>
      sqlite.prepare(`DELETE FROM platforms WHERE id = ?`).run(platformId)
    ).toThrow(/FOREIGN KEY constraint failed/)
  })

  // NOTE (wave-1 deviation — see 05-01-SUMMARY "Accepted Limitations #2"):
  // The two master_panel_id FK columns on analytes and premix_panels were added
  // via `ALTER TABLE ... ADD COLUMN ... REFERENCES master_panels(id)` (SQLite
  // syntax forbids ON DELETE clauses on added FK columns), so schema.ts's
  // declared `onDelete: 'set null'` did NOT emit into migration 0004. Runtime
  // behavior on these two FKs is NO ACTION — which in upward direction means
  // DELETE of a referenced master_panels row raises FK constraint failed (NOT
  // a cascading SET NULL). We assert that upward-enforcement behavior here.
  // The downward SET NULL cascade will be revisited in a v2.1+ table-rebuild
  // migration when master-panel delete UI ships. No code path in v2.0 deletes
  // master_panels rows, so this divergence is not operationally observable.
  it('rejects DELETE of a master_panel referenced by an analyte (runtime NO ACTION — upward FK enforcement)', () => {
    const { sqlite } = createTestDb()
    const { platformId, speciesId } = seedPlatformAndSpecies(sqlite)
    const now = new Date().toISOString()

    const masterId = crypto.randomUUID()
    // Phase 13 D-10: master_panels schema shifted (3 vol cols → sape_name + description).
    // analytes.master_panel_id FK is unchanged by 0007 — runtime NO ACTION upward
    // enforcement (per accepted-limitation comment above) still holds.
    sqlite
      .prepare(
        `INSERT INTO master_panels
         (id, name, platform_id, species_id, sape_name, description, vendor_singles_term, created_at, updated_at)
         VALUES (?, 'P1', ?, ?, NULL, NULL, NULL, ?, ?)`
      )
      .run(masterId, platformId, speciesId, now, now)

    const analyteId = crypto.randomUUID()
    sqlite
      .prepare(
        `INSERT INTO analytes
         (id, name, bead_region, premix_conc, single_conc, platform_id, species_id, master_panel_id, created_at, updated_at)
         VALUES (?, 'IL-6', 12, 50, 50, ?, ?, ?, ?, ?)`
      )
      .run(analyteId, platformId, speciesId, masterId, now, now)

    // Because the ADD COLUMN FK emitted as naked REFERENCES (NO ACTION, not
    // SET NULL), deleting a referenced master_panel raises FK constraint failed.
    expect(() =>
      sqlite.prepare(`DELETE FROM master_panels WHERE id = ?`).run(masterId)
    ).toThrow(/FOREIGN KEY constraint failed/)

    // Analyte row is untouched (FK violation aborted the DELETE).
    const row = sqlite
      .prepare(`SELECT master_panel_id FROM analytes WHERE id = ?`)
      .get(analyteId) as { master_panel_id: string | null } | undefined
    expect(row).toBeDefined()
    expect(row?.master_panel_id).toBe(masterId)
  })
})
