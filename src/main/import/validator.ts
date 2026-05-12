/**
 * Phase 13 SMK3-11: cross-sheet validator. Per-sheet checks:
 *   - Platform / species FK resolution (case-insensitive name match against DB rows)
 *   - Premix-member existence in the same sheet's Single Analytes block (case-insensitive)
 *   - SAPE concentration NOT NULL gate (defensive; D-06 DB CHECK also enforces)
 *
 * Cross-sheet pass:
 *   - D-21 duplicate-normalize detection: if two sheets normalize to the same
 *     (platformId, speciesId, normalizedName) triple, the WHOLE file is rejected.
 *
 * All errors aggregated BEFORE returning; per-sheet errors carry the sheetName,
 * cross-sheet errors carry empty string '' so the UI can surface them at the file level.
 */
import type { ParsedPanel, ParsedReagent, ParsedAnalyte, ParsedPremix } from './parser'

export interface ResolvedPanel {
  sheetName: string
  platformId: string
  speciesId: string
  panelNameNormalized: string
  panelDescription: string | null
  sapeName: string | null
  reagents: ParsedReagent[]
  analytes: ParsedAnalyte[]
  premixes: ParsedPremix[]
}

export interface ValidationError {
  sheetName: string // empty string '' for cross-sheet errors (D-21)
  message: string
}

export interface ValidationResult {
  resolved: ResolvedPanel[] | null
  errors: ValidationError[]
}

export function validateAndResolve(
  parsed: ParsedPanel[],
  platforms: { id: string; name: string }[],
  speciesList: { id: string; name: string; platformId: string }[]
): ValidationResult {
  const errors: ValidationError[] = []
  const resolved: ResolvedPanel[] = []

  // First pass: per-sheet resolution
  for (const p of parsed) {
    const platform = platforms.find(
      (x) => x.name.toLowerCase() === p.platform.toLowerCase()
    )
    if (!platform) {
      errors.push({
        sheetName: p.sheetName,
        message: `Unknown platform "${p.platform}". Valid: ${platforms.map((x) => x.name).join(', ')}`
      })
      continue
    }
    const platformSpecies = speciesList.filter((s) => s.platformId === platform.id)
    const matchedSpecies = platformSpecies.find(
      (s) => s.name.toLowerCase() === p.species.toLowerCase()
    )
    if (!matchedSpecies) {
      errors.push({
        sheetName: p.sheetName,
        message: `Unknown species "${p.species}" for platform "${platform.name}". Valid: ${platformSpecies.map((s) => s.name).join(', ')}`
      })
      continue
    }

    // Premix-member existence in this sheet's analyte block
    const masterNamesLC = new Set(p.analytes.map((a) => a.name.toLowerCase()))
    for (const pm of p.premixes) {
      for (const m of pm.memberNames) {
        if (!masterNamesLC.has(m.toLowerCase())) {
          errors.push({
            sheetName: p.sheetName,
            message: `Premix "${pm.name}" references analyte "${m}" not in the Single Analytes block`
          })
        }
      }
    }

    // SAPE concentration defensive check (DB CHECK is the real gate; this gives a nicer error)
    const sape = p.reagents.find((r) => r.kind === 'sape')
    if (!sape || sape.concentration === null) {
      errors.push({
        sheetName: p.sheetName,
        message: 'SAPE concentration must be a numeric value (cannot be "variable")'
      })
    }

    resolved.push({
      sheetName: p.sheetName,
      platformId: platform.id,
      speciesId: matchedSpecies.id,
      panelNameNormalized: p.panelNameNormalized,
      panelDescription: p.panelDescription,
      sapeName: p.sapeName,
      reagents: p.reagents,
      analytes: p.analytes,
      premixes: p.premixes
    })
  }

  // Second pass: D-21 cross-sheet collision
  const tripleSeen = new Map<string, string>() // triple key -> first sheetName
  for (const r of resolved) {
    const key = `${r.platformId}|${r.speciesId}|${r.panelNameNormalized}`
    const prior = tripleSeen.get(key)
    if (prior) {
      errors.push({
        sheetName: '',
        message: `Sheets "${prior}" and "${r.sheetName}" normalize to the same (${r.platformId}, ${r.speciesId}, ${r.panelNameNormalized}). Resolve duplicate panel names.`
      })
    } else {
      tripleSeen.set(key, r.sheetName)
    }
  }

  if (errors.length > 0) return { resolved: null, errors }
  return { resolved, errors: [] }
}
