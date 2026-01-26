import { getDatabase } from './client'
import { platforms } from './schema'

const PLATFORM_SEED_DATA = [
  {
    id: 'milliplex',
    name: 'Milliplex',
    description: 'Millipore Milliplex MAP immunoassay platform',
    stockConcentration: 25, // 25x stock
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  },
  {
    id: 'biorad',
    name: 'BioRad',
    description: 'Bio-Rad Bio-Plex immunoassay platform',
    stockConcentration: 20, // 20x stock
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  },
  {
    id: 'procartaplex',
    name: 'ProCartaPlex',
    description: 'Thermo Fisher ProCartaPlex immunoassay platform',
    stockConcentration: 25, // 25x stock
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  },
  {
    id: 'rndsystems',
    name: 'R&D Systems',
    description: 'R&D Systems Luminex immunoassay platform',
    stockConcentration: 20, // 20x stock
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  }
]

export function seedPlatforms(): void {
  const db = getDatabase()
  const existing = db.select().from(platforms).all()

  if (existing.length === 0) {
    console.log('Seeding platforms...')
    db.insert(platforms).values(PLATFORM_SEED_DATA).run()
    console.log('Seeded', PLATFORM_SEED_DATA.length, 'platforms')
  } else {
    console.log('Platforms already seeded, skipping')
  }
}
