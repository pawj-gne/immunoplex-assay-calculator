/**
 * Phase 13 D-03 + D-18 + D-19 + D-20 (SMK3-09): pure string transforms for
 * the xlsx parser pipeline. Roman -> Arabic for panel names; loose-match
 * canonicalization for reagent description rows.
 */
import { ParseError } from './parser'

export type ReagentKind = 'beads' | 'antibodies' | 'sape'

// D-19: Roman conversion range capped at I..X (1-10). Larger values fail validation.
const ROMAN_TO_ARABIC: Record<string, number> = {
  I: 1,
  II: 2,
  III: 3,
  IV: 4,
  V: 5,
  VI: 6,
  VII: 7,
  VIII: 8,
  IX: 9,
  X: 10
}

// D-20: panel name regex (case-insensitive via `i` flag). Captures either Roman ([IVX]+) or pure digits (\d+).
const PANEL_NAME_REGEX = /^Panel\s+([IVX]+|\d+)$/i

/**
 * Normalize a panel name from a Criteria-block `Panel` row to its canonical
 * Arabic form per D-18 ("master_panels.name stores only the normalized form").
 *
 * Throws ParseError attributed to `sheetName` for:
 *  - Empty / non-matching pattern (D-20 regex miss)
 *  - Roman variant outside I..X range (Pitfall C)
 *  - Pure-digit values <= 0
 */
export function normalizePanelName(raw: string, sheetName: string): string {
  const trimmed = raw.trim()
  const match = trimmed.match(PANEL_NAME_REGEX)
  if (!match) {
    throw new ParseError(
      `Panel name must be "Panel <number>" or "Panel <I..X>" (got "${raw}")`,
      sheetName
    )
  }
  const variant = match[1]

  // Pure-digit path
  if (/^\d+$/.test(variant)) {
    const n = Number(variant)
    if (!Number.isInteger(n) || n < 1) {
      throw new ParseError(
        `Panel name digit must be a positive integer (got "${raw}")`,
        sheetName
      )
    }
    return `Panel ${n}`
  }

  // Roman path — uppercase before lookup (regex `i` flag accepted mixed case)
  const upper = variant.toUpperCase()
  const arabic = ROMAN_TO_ARABIC[upper]
  if (arabic === undefined) {
    throw new ParseError(
      `Panel name Roman variant must be I through X (got "${raw}")`,
      sheetName
    )
  }
  return `Panel ${arabic}`
}

/**
 * Canonicalize a Reagent Description cell value (Values block col A) to one
 * of three reagent kinds, OR null if the value doesn't match a known alias.
 *
 * Aliases (D-03):
 *   beads      <- 'Beads' | 'Bead'
 *   antibodies <- 'Antibodies' | 'Antibody' | 'Ab'   (CRITICAL: trailing whitespace tolerated - Pitfall A)
 *   sape       <- 'SAPE' | 'SA-PE' | 'Streptavidin-PE'
 *
 * Returns null for unknown values (caller decides whether that's a parse error).
 * Returns null for 'SAPE Name' — that label is detected separately by isSapeNameLabel().
 */
export function canonReagentKind(raw: string): ReagentKind | null {
  const lc = raw.trim().toLowerCase()
  if (lc === 'beads' || lc === 'bead') return 'beads'
  if (lc === 'antibodies' || lc === 'antibody' || lc === 'ab') return 'antibodies'
  if (lc === 'sape' || lc === 'sa-pe' || lc === 'streptavidin-pe') return 'sape'
  return null
}

/**
 * Detect the 'SAPE Name' row marker in the Values block. Case-insensitive +
 * whitespace-trimmed match per D-03.
 */
export function isSapeNameLabel(raw: string): boolean {
  return raw.trim().toLowerCase() === 'sape name'
}
