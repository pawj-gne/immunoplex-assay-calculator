import { migrate } from 'drizzle-orm/better-sqlite3/migrator'
import { getDatabase } from './client'
import path from 'path'
import { app } from 'electron'

export function runMigrations(): void {
  const db = getDatabase()

  // In production, migrations are bundled with the app
  // In development, __dirname is out/main/ after bundling, so go up 2 levels
  const migrationsFolder = app.isPackaged
    ? path.join(process.resourcesPath, 'drizzle', 'migrations')
    : path.join(__dirname, '../../drizzle/migrations')

  try {
    migrate(db, { migrationsFolder })
    console.log('Migrations completed successfully')
  } catch (error) {
    console.error('Migration failed:', error)
    throw error
  }
}
