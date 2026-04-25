import type { ParsedPanel } from './parser'

export interface ResolvedPanel {
  panel_name: string
  platformId: string
  speciesId: string
  analytes: { name: string; bead_region: number; single_conc: number }[]
  sub_panels: { name: string; sub_panel_conc: number; analyte_names: string[] }[]
}

export interface ResolutionResult {
  resolved: ResolvedPanel | null
  errors: string[]
}

export function validateAndResolve(
  parsed: ParsedPanel,
  platforms: { id: string; name: string }[],
  speciesList: { id: string; name: string; platformId: string }[]
): ResolutionResult {
  const errors: string[] = []

  const platform = platforms.find((p) => p.name.toLowerCase() === parsed.platform.toLowerCase())
  if (!platform) {
    const valid = platforms.map((p) => p.name).join(', ')
    errors.push(`Unknown platform "${parsed.platform}". Valid platforms: ${valid}`)
  }

  let matchedSpecies: { id: string; name: string; platformId: string } | undefined
  if (platform) {
    const platformSpecies = speciesList.filter((s) => s.platformId === platform.id)
    matchedSpecies = platformSpecies.find(
      (s) => s.name.toLowerCase() === parsed.species.toLowerCase()
    )
    if (!matchedSpecies) {
      const valid = platformSpecies.map((s) => s.name).join(', ')
      errors.push(
        `Unknown species "${parsed.species}" for platform "${platform.name}". Valid species: ${valid}`
      )
    }
  }

  // Verify every sub-panel analyte name is present in the master list
  const masterNamesLC = new Set(parsed.analytes.map((a) => a.name.toLowerCase()))
  for (const sp of parsed.sub_panels) {
    for (const name of sp.analyte_names) {
      if (!masterNamesLC.has(name.toLowerCase())) {
        errors.push(
          `Sub-panel "${sp.name}" references analyte "${name}" that does not appear in the master analyte list`
        )
      }
    }
  }

  if (errors.length > 0 || !platform || !matchedSpecies) {
    return { resolved: null, errors }
  }

  return {
    resolved: {
      panel_name: parsed.panel_name,
      platformId: platform.id,
      speciesId: matchedSpecies.id,
      analytes: parsed.analytes,
      sub_panels: parsed.sub_panels
    },
    errors: []
  }
}
