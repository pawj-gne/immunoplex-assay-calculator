import { parseImportFile } from './parser'
import { validateImportRows, validatePlatformsAndSpecies } from './validator'
import type { ResolvedRow } from './validator'
import { getDatabase, getSqlite } from '../db/client'
import { platforms, species } from '../db/schema'
import { analyteRepository } from '../db/repositories/analyte'
import { panelRepository } from '../db/repositories/panel'

export interface ImportResult {
  success: boolean
  canceled?: boolean
  created: { analytes: number; panels: number; links: number }
  skipped: { analytes: number }
  errors: { row: number; issues: string[] }[]
}

export function importPanelData(filePath: string): ImportResult {
  // Step 1: Parse the file
  const rawRows = parseImportFile(filePath)

  // Step 2: Validate row shapes
  const { valid, errors: validationErrors } = validateImportRows(rawRows)
  if (validationErrors.length > 0) {
    return {
      success: false,
      created: { analytes: 0, panels: 0, links: 0 },
      skipped: { analytes: 0 },
      errors: validationErrors
    }
  }

  // Step 3: Load platforms and species from DB
  const db = getDatabase()
  const allPlatforms = db.select().from(platforms).all()
  const allSpecies = db.select().from(species).all()

  // Step 4: Resolve platform/species names to IDs
  const { resolved, errors: resolutionErrors } = validatePlatformsAndSpecies(
    valid,
    allPlatforms.map((p) => ({ id: p.id, name: p.name })),
    allSpecies.map((s) => ({ id: s.id, name: s.name, platformId: s.platformId }))
  )

  if (resolutionErrors.length > 0) {
    return {
      success: false,
      created: { analytes: 0, panels: 0, links: 0 },
      skipped: { analytes: 0 },
      errors: resolutionErrors
    }
  }

  // Step 5: Group rows by unique panel (name + platformId + speciesId)
  const panelGroups = new Map<string, ResolvedRow[]>()
  for (const row of resolved) {
    const key = `${row.panel_name.toLowerCase()}|${row.platformId}|${row.speciesId}`
    if (!panelGroups.has(key)) {
      panelGroups.set(key, [])
    }
    panelGroups.get(key)!.push(row)
  }

  // Step 6: Transactional insert
  let createdAnalytes = 0
  let createdPanels = 0
  let createdLinks = 0
  let skippedAnalytes = 0

  const sqlite = getSqlite()
  const transaction = sqlite.transaction(() => {
    for (const [, rows] of panelGroups) {
      const firstRow = rows[0]

      // Find or create panel
      let panel = panelRepository.findByNamePlatformSpecies(
        firstRow.panel_name,
        firstRow.platformId,
        firstRow.speciesId
      )
      if (!panel) {
        panel = panelRepository.create({
          name: firstRow.panel_name,
          description: null,
          platformId: firstRow.platformId,
          speciesId: firstRow.speciesId
        })
        createdPanels++
      }

      for (const row of rows) {
        // Find or create analyte
        let analyte = analyteRepository.findByNamePlatformSpecies(
          row.analyte_name,
          row.platformId,
          row.speciesId
        )
        if (!analyte) {
          analyte = analyteRepository.create({
            name: row.analyte_name,
            beadRegion: row.bead_region,
            premixConc: row.premix_conc,
            singleConc: row.single_conc,
            platformId: row.platformId,
            speciesId: row.speciesId
          })
          createdAnalytes++
        } else {
          skippedAnalytes++
        }

        // Link analyte to panel (skips if already linked)
        panelRepository.addAnalyteToPanel(panel.id, analyte.id)
        createdLinks++
      }
    }
  })

  transaction()

  return {
    success: true,
    created: { analytes: createdAnalytes, panels: createdPanels, links: createdLinks },
    skipped: { analytes: skippedAnalytes },
    errors: []
  }
}
