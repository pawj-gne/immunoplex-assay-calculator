import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    environment: 'node',
    globals: true,
    include: ['src/**/*.test.ts'],
    // better-sqlite3 is native; ensure per-test isolation for in-memory DBs
    pool: 'forks'
  }
})
