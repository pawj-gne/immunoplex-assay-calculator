/**
 * Phase 13 (SMK3-08, SMK3-09, SMK3-10, SMK3-11, SMK3-DIL-01): Smoke-3 importer.
 *
 * Pipeline:
 *   1. parseWorkbook(filePath) → ParsedPanel[]
 *   2. validateAndResolve(parsed, platforms, species) → ResolvedPanel[] | errors
 *   3. If errors: return immediately, zero DB writes.
 *   4. Open ONE transaction; for each ResolvedPanel: wholesale-replace existing or create fresh.
 *
 * D-12: hard-delete old children before INSERT fresh (no orphans; supersedes Phase 5 D-05).
 * D-15 + D-17: FK SET NULL on runs.panel_id + run_single_analytes.analyte_id preserves historical rows.
 * Pitfall 27: validate-first; single transaction wrapping all writes.
 */
import { parseWorkbook, ParseError } from './parser'
import { validateAndResolve, type ResolvedPanel, type ValidationError } from './validator'
import { getDatabase, getSqlite } from '../db/client'
import { platforms, species } from '../db/schema'
import { analyteRepository } from '../db/repositories/analyte'
import { panelRepository } from '../db/repositories/panel'
import { masterPanelRepository } from '../db/repositories/masterPanel'
import { masterPanelReagentRepository } from '../db/repositories/masterPanelReagent'

export interface PanelSummary {
  sheetName: string
  normalizedName: string
  platform: string
  species: string
  analyteCount: number
  premixCount: number
  sapeName: string | null
  sapeConc: number
  wasUpdate: boolean
}

export interface ImportSheetError {
  sheetName: string // empty string for file-level (D-21) errors
  issues: string[]
}

export interface ImportResult {
  success: boolean
  canceled?: boolean
  summaries: PanelSummary[]
  errors: ImportSheetError[]
}

export function importPanelData(filePath: string): ImportResult {
  // Step 1: parse workbook → ParsedPanel[]
  let parsed
  try {
    parsed = parseWorkbook(filePath)
  } catch (err) {
    const sheetName = err instanceof ParseError ? (err.sheetName ?? '') : ''
    const message = err instanceof Error ? err.message : 'Failed to parse file'
    return { success: false, summaries: [], errors: [{ sheetName, issues: [message] }] }
  }

  if (parsed.length === 0) {
    return {
      success: false,
      summaries: [],
      errors: [
        {
          sheetName: '',
          issues: ['Workbook contains no panel sheets (only the Table summary was found)']
        }
      ]
    }
  }

  // Step 2: load FK reference data + validate
  const db = getDatabase()
  const allPlatforms = db
    .select()
    .from(platforms)
    .all()
    .map((p) => ({ id: p.id, name: p.name }))
  const allSpecies = db
    .select()
    .from(species)
    .all()
    .map((s) => ({ id: s.id, name: s.name, platformId: s.platformId }))

  const { resolved, errors: vErrors } = validateAndResolve(parsed, allPlatforms, allSpecies)
  if (resolved === null) {
    return {
      success: false,
      summaries: [],
      errors: groupErrorsBySheet(vErrors)
    }
  }

  // Step 3: single transaction wrapping all per-panel writes
  const summaries: PanelSummary[] = []
  const sqlite = getSqlite()
  try {
    sqlite.transaction(() => {
      for (const r of resolved) {
        const summary = wholesaleReplace(r, allPlatforms, allSpecies)
        summaries.push(summary)
      }
    })()
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Transaction failed'
    return {
      success: false,
      summaries: [],
      errors: [{ sheetName: '', issues: [`Transaction rolled back: ${message}`] }]
    }
  }

  return { success: true, summaries, errors: [] }
}

/** Wholesale-replace one master panel: delete children + INSERT fresh, OR create from scratch. */
function wholesaleReplace(
  r: ResolvedPanel,
  allPlatforms: { id: string; name: string }[],
  allSpecies: { id: string; name: string; platformId: string }[]
): PanelSummary {
  const existing = masterPanelRepository.findByPlatformSpeciesName(
    r.platformId,
    r.speciesId,
    r.panelNameNormalized
  )
  let masterPanelId: string
  let wasUpdate: boolean

  if (existing) {
    // D-12 wholesale-delete children
    analyteRepository.deleteByMasterPanelId(existing.id)
    panelRepository.deleteByMasterPanelId(existing.id)
    masterPanelReagentRepository.deleteByMasterPanelId(existing.id)
    masterPanelRepository.updateMetadata(existing.id, {
      name: r.panelNameNormalized,
      description: r.panelDescription,
      sapeName: r.sapeName
    })
    masterPanelId = existing.id
    wasUpdate = true
  } else {
    const created = masterPanelRepository.createWithMetadata({
      platformId: r.platformId,
      speciesId: r.speciesId,
      name: r.panelNameNormalized,
      description: r.panelDescription,
      sapeName: r.sapeName,
      vendorSinglesTerm: null // D-11: new imports write NULL
    })
    masterPanelId = created.id
    wasUpdate = false
  }

  // INSERT fresh: 3 reagents
  for (const rg of r.reagents) {
    masterPanelReagentRepository.create({
      masterPanelId,
      reagentKind: rg.kind,
      concentration: rg.concentration,
      diluent: rg.diluent,
      volumePerWell: rg.volumePerWell
    })
  }
  // INSERT fresh: analytes (build name→id map for premix linking)
  const analyteIdByLowerName = new Map<string, string>()
  for (const a of r.analytes) {
    const created = analyteRepository.create({
      name: a.name,
      beadRegion: a.beadRegion,
      premixConc: a.concentration,
      singleConc: a.concentration,
      platformId: r.platformId,
      speciesId: r.speciesId,
      masterPanelId
    })
    analyteIdByLowerName.set(a.name.toLowerCase(), created.id)
  }
  // INSERT fresh: premixes + member links
  for (const pm of r.premixes) {
    const premix = panelRepository.create({
      name: pm.name,
      description: null,
      platformId: r.platformId,
      speciesId: r.speciesId,
      parentPanelId: null,
      subPanelConc: pm.premixConc,
      masterPanelId
    })
    for (const memberName of pm.memberNames) {
      const aid = analyteIdByLowerName.get(memberName.toLowerCase())
      if (!aid) continue
      panelRepository.addAnalyteToPanel(premix.id, aid)
    }
  }

  const platformName = allPlatforms.find((p) => p.id === r.platformId)?.name ?? r.platformId
  const speciesName = allSpecies.find((s) => s.id === r.speciesId)?.name ?? r.speciesId
  const sapeReagent = r.reagents.find((x) => x.kind === 'sape')!
  return {
    sheetName: r.sheetName,
    normalizedName: r.panelNameNormalized,
    platform: platformName,
    species: speciesName,
    analyteCount: r.analytes.length,
    premixCount: r.premixes.length,
    sapeName: r.sapeName,
    sapeConc: sapeReagent.concentration!,
    wasUpdate
  }
}

/** Group validator ValidationError[] into ImportSheetError[]. */
function groupErrorsBySheet(errors: ValidationError[]): ImportSheetError[] {
  const map = new Map<string, string[]>()
  for (const e of errors) {
    const list = map.get(e.sheetName) ?? []
    list.push(e.message)
    map.set(e.sheetName, list)
  }
  const result: ImportSheetError[] = []
  const hasFileLevel = map.has('')
  if (hasFileLevel) result.push({ sheetName: '', issues: map.get('')! })
  const perSheet = [...map.keys()].filter((k) => k !== '').sort()
  for (const k of perSheet) result.push({ sheetName: k, issues: map.get(k)! })
  return result
}
