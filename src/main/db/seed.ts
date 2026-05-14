import { getDatabase } from './client'
import { platforms, species, premixPanels, analytes, panelAnalytes, operators } from './schema'

// Phase 4 — D-20: 9-name operator roster seeded on first launch
const OPERATOR_SEED_NAMES = [
  'Joven',
  'Terence',
  'Jon',
  'George',
  'Cole',
  'James',
  'Alice',
  'Kevin',
  'CK'
] as const

const PLATFORM_SEED_DATA = [
  {
    id: 'milliplex',
    name: 'Millipore',
    description: 'Millipore Milliplex MAP immunoassay platform',
    stockConcentration: 25, // 25x stock
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  },
  {
    id: 'biorad',
    name: 'Bio-Rad',
    description: 'Bio-Rad Bio-Plex immunoassay platform',
    stockConcentration: 20, // 20x stock
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  },
  {
    id: 'procartaplex',
    name: 'Thermofisher',
    description: 'Thermo Fisher ProCartaPlex immunoassay platform',
    stockConcentration: 25, // 25x stock
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  },
]

const SPECIES_SEED_DATA = [
  // Milliplex species
  {
    id: 'milliplex-mouse',
    name: 'Mouse',
    platformId: 'milliplex',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  },
  {
    id: 'milliplex-human',
    name: 'Human',
    platformId: 'milliplex',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  },
  {
    id: 'milliplex-rat',
    name: 'Rat',
    platformId: 'milliplex',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  },
  // BioRad species
  {
    id: 'biorad-mouse',
    name: 'Mouse',
    platformId: 'biorad',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  },
  {
    id: 'biorad-human',
    name: 'Human',
    platformId: 'biorad',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  },
  {
    id: 'biorad-rat',
    name: 'Rat',
    platformId: 'biorad',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  },
  // ProCartaPlex species
  {
    id: 'procartaplex-mouse',
    name: 'Mouse',
    platformId: 'procartaplex',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  },
  {
    id: 'procartaplex-human',
    name: 'Human',
    platformId: 'procartaplex',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  },
  {
    id: 'procartaplex-rat',
    name: 'Rat',
    platformId: 'procartaplex',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  },
]

// Sample analytes for Milliplex Mouse (10 analytes for testing)
const ANALYTE_SEED_DATA = [
  {
    id: 'milliplex-mouse-il1a',
    name: 'IL-1a',
    beadRegion: 32,
    premixConc: 20,
    singleConc: 25,
    platformId: 'milliplex',
    speciesId: 'milliplex-mouse',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  },
  {
    id: 'milliplex-mouse-il1b',
    name: 'IL-1b',
    beadRegion: 47,
    premixConc: 20,
    singleConc: 25,
    platformId: 'milliplex',
    speciesId: 'milliplex-mouse',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  },
  {
    id: 'milliplex-mouse-il2',
    name: 'IL-2',
    beadRegion: 58,
    premixConc: 15,
    singleConc: 20,
    platformId: 'milliplex',
    speciesId: 'milliplex-mouse',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  },
  {
    id: 'milliplex-mouse-il6',
    name: 'IL-6',
    beadRegion: 19,
    premixConc: 25,
    singleConc: 25,
    platformId: 'milliplex',
    speciesId: 'milliplex-mouse',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  },
  {
    id: 'milliplex-mouse-il17',
    name: 'IL-17',
    beadRegion: 47,
    premixConc: 20,
    singleConc: 25,
    platformId: 'milliplex',
    speciesId: 'milliplex-mouse',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  },
  {
    id: 'milliplex-mouse-gmcsf',
    name: 'GM-CSF',
    beadRegion: 22,
    premixConc: 15,
    singleConc: 20,
    platformId: 'milliplex',
    speciesId: 'milliplex-mouse',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  },
  {
    id: 'milliplex-mouse-tnfa',
    name: 'TNF-a',
    beadRegion: 75,
    premixConc: 20,
    singleConc: 25,
    platformId: 'milliplex',
    speciesId: 'milliplex-mouse',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  },
  {
    id: 'milliplex-mouse-ifng',
    name: 'IFN-g',
    beadRegion: 33,
    premixConc: 20,
    singleConc: 25,
    platformId: 'milliplex',
    speciesId: 'milliplex-mouse',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  },
  {
    id: 'milliplex-mouse-il4',
    name: 'IL-4',
    beadRegion: 53,
    premixConc: 20,
    singleConc: 25,
    platformId: 'milliplex',
    speciesId: 'milliplex-mouse',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  },
  {
    id: 'milliplex-mouse-il10',
    name: 'IL-10',
    beadRegion: 18,
    premixConc: 20,
    singleConc: 25,
    platformId: 'milliplex',
    speciesId: 'milliplex-mouse',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  }
]

// Sample premix panels for Milliplex Mouse
const PANEL_SEED_DATA = [
  {
    id: 'milliplex-mouse-panel-i',
    name: 'Milliplex Mouse Premix Panel I 32-Plex',
    description: 'Comprehensive 32-plex cytokine panel for mouse samples',
    platformId: 'milliplex',
    speciesId: 'milliplex-mouse',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  },
  {
    id: 'milliplex-mouse-panel-ii',
    name: 'Milliplex Mouse Premix Panel II 23-Plex',
    description: '23-plex cytokine panel for mouse samples',
    platformId: 'milliplex',
    speciesId: 'milliplex-mouse',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  }
]

// Panel analyte assignments (first panel gets first 7 analytes)
const PANEL_ANALYTE_SEED_DATA = [
  // Panel I contains: IL-1a, IL-1b, IL-2, IL-6, IL-17, GM-CSF, TNF-a
  {
    id: 'pa-panel-i-il1a',
    panelId: 'milliplex-mouse-panel-i',
    analyteId: 'milliplex-mouse-il1a',
    createdAt: new Date().toISOString()
  },
  {
    id: 'pa-panel-i-il1b',
    panelId: 'milliplex-mouse-panel-i',
    analyteId: 'milliplex-mouse-il1b',
    createdAt: new Date().toISOString()
  },
  {
    id: 'pa-panel-i-il2',
    panelId: 'milliplex-mouse-panel-i',
    analyteId: 'milliplex-mouse-il2',
    createdAt: new Date().toISOString()
  },
  {
    id: 'pa-panel-i-il6',
    panelId: 'milliplex-mouse-panel-i',
    analyteId: 'milliplex-mouse-il6',
    createdAt: new Date().toISOString()
  },
  {
    id: 'pa-panel-i-il17',
    panelId: 'milliplex-mouse-panel-i',
    analyteId: 'milliplex-mouse-il17',
    createdAt: new Date().toISOString()
  },
  {
    id: 'pa-panel-i-gmcsf',
    panelId: 'milliplex-mouse-panel-i',
    analyteId: 'milliplex-mouse-gmcsf',
    createdAt: new Date().toISOString()
  },
  {
    id: 'pa-panel-i-tnfa',
    panelId: 'milliplex-mouse-panel-i',
    analyteId: 'milliplex-mouse-tnfa',
    createdAt: new Date().toISOString()
  },
  // Panel II contains: IFN-g, IL-4, IL-10
  {
    id: 'pa-panel-ii-ifng',
    panelId: 'milliplex-mouse-panel-ii',
    analyteId: 'milliplex-mouse-ifng',
    createdAt: new Date().toISOString()
  },
  {
    id: 'pa-panel-ii-il4',
    panelId: 'milliplex-mouse-panel-ii',
    analyteId: 'milliplex-mouse-il4',
    createdAt: new Date().toISOString()
  },
  {
    id: 'pa-panel-ii-il10',
    panelId: 'milliplex-mouse-panel-ii',
    analyteId: 'milliplex-mouse-il10',
    createdAt: new Date().toISOString()
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

export function seedSpecies(): void {
  const db = getDatabase()
  const existing = db.select().from(species).all()

  if (existing.length === 0) {
    console.log('Seeding species...')
    db.insert(species).values(SPECIES_SEED_DATA).run()
    console.log('Seeded', SPECIES_SEED_DATA.length, 'species')
  } else {
    console.log('Species already seeded, skipping')
  }
}

export function seedAnalytes(): void {
  const db = getDatabase()
  const existing = db.select().from(analytes).all()

  if (existing.length === 0) {
    console.log('Seeding analytes...')
    db.insert(analytes).values(ANALYTE_SEED_DATA).run()
    console.log('Seeded', ANALYTE_SEED_DATA.length, 'analytes')
  } else {
    console.log('Analytes already seeded, skipping')
  }
}

export function seedPanels(): void {
  const db = getDatabase()
  const existing = db.select().from(premixPanels).all()

  if (existing.length === 0) {
    console.log('Seeding panels...')
    db.insert(premixPanels).values(PANEL_SEED_DATA).run()
    console.log('Seeded', PANEL_SEED_DATA.length, 'panels')
  } else {
    console.log('Panels already seeded, skipping')
  }
}

export function seedPanelAnalytes(): void {
  const db = getDatabase()
  const existing = db.select().from(panelAnalytes).all()

  if (existing.length === 0) {
    console.log('Seeding panel-analyte associations...')
    db.insert(panelAnalytes).values(PANEL_ANALYTE_SEED_DATA).run()
    console.log('Seeded', PANEL_ANALYTE_SEED_DATA.length, 'panel-analyte associations')
  } else {
    console.log('Panel-analyte associations already seeded, skipping')
  }
}

export function seedOperators(): void {
  const db = getDatabase()
  const existing = db.select().from(operators).all()

  if (existing.length > 0) {
    console.log('Operators already seeded, skipping')
    return
  }

  console.log('Seeding operators...')
  const now = new Date().toISOString()
  for (const name of OPERATOR_SEED_NAMES) {
    db.insert(operators)
      .values({
        id: crypto.randomUUID(),
        name,
        active: true,
        createdAt: now,
        updatedAt: now
      })
      .run()
  }
  console.log('Seeded', OPERATOR_SEED_NAMES.length, 'operators')
}

export function seedAll(): void {
  // Phase 16 (v1.0): app opens with an empty database. The xlsx importer
  // (`templates/panels/all-panels.xlsx`) is the sole source of platforms,
  // species, analytes, and panels. Operators are added by the lab via the
  // OperatorsSection UI on first run. Seed functions remain exported for
  // any future dev/maintenance use.
}
