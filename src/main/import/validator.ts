import { z } from 'zod'

export const importRowSchema = z.object({
  platform: z.string().min(1, 'platform is required'),
  species: z.string().min(1, 'species is required'),
  panel_name: z.string().min(1, 'panel_name is required'),
  analyte_name: z.string().min(1, 'analyte_name is required'),
  bead_region: z.number().int('bead_region must be an integer').positive('bead_region must be positive'),
  bead_stock_conc: z.number().positive('bead_stock_conc must be positive'),
  antibody_stock_conc: z.number().positive('antibody_stock_conc must be positive'),
  panel_description: z.string().optional()
})

export type ValidatedRow = z.infer<typeof importRowSchema>

export interface ResolvedRow extends ValidatedRow {
  platformId: string
  speciesId: string
}

export interface ValidationResult {
  valid: ValidatedRow[]
  errors: { row: number; issues: string[] }[]
}

export interface ResolutionResult {
  resolved: ResolvedRow[]
  errors: { row: number; issues: string[] }[]
}

export function validateImportRows(rows: unknown[]): ValidationResult {
  const valid: ValidatedRow[] = []
  const errors: { row: number; issues: string[] }[] = []

  for (let i = 0; i < rows.length; i++) {
    const result = importRowSchema.safeParse(rows[i])
    if (result.success) {
      valid.push(result.data)
    } else {
      errors.push({
        row: i + 2, // 1-indexed + header row
        issues: result.error.issues.map((issue) => `${issue.path.join('.')}: ${issue.message}`)
      })
    }
  }

  return { valid, errors }
}

export function validatePlatformsAndSpecies(
  rows: ValidatedRow[],
  platforms: { id: string; name: string }[],
  speciesList: { id: string; name: string; platformId: string }[]
): ResolutionResult {
  const resolved: ResolvedRow[] = []
  const errors: { row: number; issues: string[] }[] = []

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i]
    const rowNum = i + 2 // 1-indexed + header row
    const rowIssues: string[] = []

    // Case-insensitive platform lookup
    const platform = platforms.find(
      (p) => p.name.toLowerCase() === row.platform.toLowerCase()
    )

    if (!platform) {
      const validNames = platforms.map((p) => p.name).join(', ')
      rowIssues.push(`Unknown platform "${row.platform}". Valid platforms: ${validNames}`)
    }

    // Case-insensitive species lookup within matched platform
    let matchedSpecies: { id: string; name: string; platformId: string } | undefined
    if (platform) {
      const platformSpecies = speciesList.filter((s) => s.platformId === platform.id)
      matchedSpecies = platformSpecies.find(
        (s) => s.name.toLowerCase() === row.species.toLowerCase()
      )

      if (!matchedSpecies) {
        const validSpecies = platformSpecies.map((s) => s.name).join(', ')
        rowIssues.push(
          `Unknown species "${row.species}" for platform "${platform.name}". Valid species: ${validSpecies}`
        )
      }
    }

    if (rowIssues.length > 0) {
      errors.push({ row: rowNum, issues: rowIssues })
    } else {
      resolved.push({
        ...row,
        platformId: platform!.id,
        speciesId: matchedSpecies!.id
      })
    }
  }

  return { resolved, errors }
}
