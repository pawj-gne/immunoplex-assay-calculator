import { parseImportFile, ParseError } from './parser'
import { validateAndResolve } from './validator'
import { getDatabase, getSqlite } from '../db/client'
import { platforms, species } from '../db/schema'
import { analyteRepository } from '../db/repositories/analyte'
import { panelRepository } from '../db/repositories/panel'

export interface ImportResult {
  success: boolean
  canceled?: boolean
  created: { analytes: number; panels: number; subPanels: number; links: number }
  skipped: { analytes: number }
  errors: { row: number; issues: string[] }[]
}

export function importPanelData(filePath: string): ImportResult {
  // Step 1: Parse
  let parsed
  try {
    parsed = parseImportFile(filePath)
  } catch (err) {
    const message = err instanceof ParseError ? err.message : err instanceof Error ? err.message : 'Failed to parse file'
    return failure(message)
  }

  // Step 2: Resolve platform/species + validate sub-panel memberships
  const db = getDatabase()
  const allPlatforms = db.select().from(platforms).all().map((p) => ({ id: p.id, name: p.name }))
  const allSpecies = db.select().from(species).all().map((s) => ({ id: s.id, name: s.name, platformId: s.platformId }))

  const { resolved, errors: resolutionErrors } = validateAndResolve(parsed, allPlatforms, allSpecies)
  if (!resolved) {
    return {
      success: false,
      created: { analytes: 0, panels: 0, subPanels: 0, links: 0 },
      skipped: { analytes: 0 },
      errors: resolutionErrors.map((msg) => ({ row: 0, issues: [msg] }))
    }
  }

  // Step 3: Transactional insert
  let createdAnalytes = 0
  let createdPanels = 0
  let createdSubPanels = 0
  let createdLinks = 0
  let skippedAnalytes = 0

  const sqlite = getSqlite()
  sqlite.transaction(() => {
    // 3a. Create or find the master panel
    let masterPanel = panelRepository.findByNamePlatformSpecies(
      resolved.panel_name,
      resolved.platformId,
      resolved.speciesId
    )
    if (!masterPanel) {
      masterPanel = panelRepository.create({
        name: resolved.panel_name,
        description: null,
        platformId: resolved.platformId,
        speciesId: resolved.speciesId,
        parentPanelId: null,
        subPanelConc: 1
      })
      createdPanels++
    }

    // 3b. Create or find each master analyte; link to master panel
    const analyteIdByName = new Map<string, string>()
    for (const a of resolved.analytes) {
      let analyte = analyteRepository.findByNamePlatformSpecies(
        a.name,
        resolved.platformId,
        resolved.speciesId
      )
      if (!analyte) {
        analyte = analyteRepository.create({
          name: a.name,
          beadRegion: a.bead_region,
          premixConc: a.single_conc, // legacy column mirrors single_conc (will be dropped post-cleanup)
          singleConc: a.single_conc,
          platformId: resolved.platformId,
          speciesId: resolved.speciesId
        })
        createdAnalytes++
      } else {
        skippedAnalytes++
      }
      analyteIdByName.set(a.name.toLowerCase(), analyte.id)
      panelRepository.addAnalyteToPanel(masterPanel.id, analyte.id)
      createdLinks++
    }

    // 3c. Create sub-panels and link their analytes
    for (const sp of resolved.sub_panels) {
      let subPanel = panelRepository.findByNamePlatformSpecies(
        sp.name,
        resolved.platformId,
        resolved.speciesId
      )
      if (!subPanel) {
        subPanel = panelRepository.create({
          name: sp.name,
          description: null,
          platformId: resolved.platformId,
          speciesId: resolved.speciesId,
          parentPanelId: masterPanel.id,
          subPanelConc: sp.sub_panel_conc
        })
        createdSubPanels++
      }

      for (const memberName of sp.analyte_names) {
        const analyteId = analyteIdByName.get(memberName.toLowerCase())
        if (!analyteId) continue // already validated; defensive
        panelRepository.addAnalyteToPanel(subPanel.id, analyteId)
        createdLinks++
      }
    }
  })()

  return {
    success: true,
    created: {
      analytes: createdAnalytes,
      panels: createdPanels,
      subPanels: createdSubPanels,
      links: createdLinks
    },
    skipped: { analytes: skippedAnalytes },
    errors: []
  }
}

function failure(message: string): ImportResult {
  return {
    success: false,
    created: { analytes: 0, panels: 0, subPanels: 0, links: 0 },
    skipped: { analytes: 0 },
    errors: [{ row: 0, issues: [message] }]
  }
}
