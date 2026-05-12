/**
 * Phase 13 (SMK3-08 + SMK3-09 + SMK3-10): multi-sheet XLSX parser for the
 * Smoke 3 sectioned panel format. Reads a workbook, skips the `Table` summary
 * sheet, emits a typed ParsedPanel[] for every other sheet.
 *
 * Block structure per sheet:
 *   - Criteria  block: Platform / Species / Panel / Panel Description rows
 *   - Values    block: header + 3 reagent rows (beads/antibodies/sape) + optional SAPE Name row
 *   - Category  block: premix matrix headers + single-analyte data rows
 *
 * Pattern A (16 of 17 fixtures): analyte-header row is BELOW the Premix Concentration row.
 * Pattern B (Millipore Human Panel 1): analyte-header row COINCIDES with Premix Concentration row.
 *
 * Locator logic uses TEXT MARKERS not hardcoded row offsets — robust across both patterns.
 */
import * as XLSX from 'xlsx'
import {
  normalizePanelName,
  canonReagentKind,
  isSapeNameLabel,
  type ReagentKind
} from './normalize'

export type { ReagentKind } from './normalize'

export interface ParsedReagent {
  kind: ReagentKind
  concentration: number | null // D-07: null when source cell = 'variable' (beads/antibodies only)
  diluent: string | null // SMK3-DIL-01: open text; null when source cell empty
  volumePerWell: number
}

export interface ParsedAnalyte {
  name: string
  beadRegion: number
  concentration: number
}

export interface ParsedPremix {
  name: string
  premixConc: number
  memberNames: string[] // verbatim names from analyte rows in that premix column; validator does case-insensitive match
}

export interface ParsedPanel {
  sheetName: string
  platform: string
  species: string
  panelNameRaw: string
  panelNameNormalized: string
  panelDescription: string | null
  sapeName: string | null
  reagents: ParsedReagent[]
  analytes: ParsedAnalyte[]
  premixes: ParsedPremix[]
}

export class ParseError extends Error {
  constructor(
    message: string,
    public sheetName?: string
  ) {
    super(sheetName ? `[${sheetName}] ${message}` : message)
    this.name = 'ParseError'
  }
}

// ------- Cell accessor helpers --------------------------------------------

function cell(rows: unknown[][], r: number, c: number): string {
  const raw = rows[r]?.[c]
  if (raw === null || raw === undefined) return ''
  return String(raw).trim()
}

function cellNumber(
  rows: unknown[][],
  r: number,
  c: number,
  label: string,
  sheetName: string
): number {
  const raw = rows[r]?.[c]
  const num = typeof raw === 'number' ? raw : Number(String(raw ?? '').trim())
  if (!Number.isFinite(num)) {
    throw new ParseError(
      `${label} at row ${r + 1}, col ${String.fromCharCode(65 + c)} must be numeric (got "${raw}")`,
      sheetName
    )
  }
  return num
}

function cellNumberOrVariable(
  rows: unknown[][],
  r: number,
  c: number,
  label: string,
  sheetName: string
): number | null {
  const raw = String(rows[r]?.[c] ?? '')
    .trim()
    .toLowerCase()
  if (raw === 'variable') return null
  return cellNumber(rows, r, c, label, sheetName)
}

// ------- Top-level workbook reader -----------------------------------------

export function parseWorkbook(filePath: string): ParsedPanel[] {
  const workbook = XLSX.readFile(filePath, { cellFormula: false, cellDates: false })
  const panels: ParsedPanel[] = []
  for (const sheetName of workbook.SheetNames) {
    if (sheetName.trim().toLowerCase() === 'table') continue // D-02
    const sheet = workbook.Sheets[sheetName]
    const rows = XLSX.utils.sheet_to_json<unknown[]>(sheet, {
      header: 1,
      blankrows: false,
      defval: null
    }) as unknown[][]
    panels.push(parseSheet(sheetName, rows))
  }
  return panels
}

/** Test-friendly entry: parse already-loaded rows for one sheet. */
export function parseSheet(sheetName: string, rows: unknown[][]): ParsedPanel {
  const criteriaRow = findRowWith(rows, 0, 'criteria')
  const valuesRow = findRowWith(rows, 0, 'values')
  const categoryRow = findRowWith(rows, 0, 'category')
  if (criteriaRow < 0)
    throw new ParseError('Missing "Criteria" section marker in column A', sheetName)
  if (valuesRow < 0) throw new ParseError('Missing "Values" section marker in column A', sheetName)
  if (categoryRow < 0)
    throw new ParseError('Missing "Category" section marker in column A', sheetName)
  if (!(criteriaRow < valuesRow && valuesRow < categoryRow)) {
    throw new ParseError(
      'Criteria/Values/Category markers must appear in that order',
      sheetName
    )
  }

  const criteria = parseCriteria(sheetName, rows, criteriaRow + 1, valuesRow)
  const reagents = parseValues(sheetName, rows, valuesRow + 1, categoryRow)
  const sapeName = findSapeName(rows, valuesRow + 1, categoryRow)
  const category = parseCategory(sheetName, rows, categoryRow + 1)

  return {
    sheetName,
    platform: criteria.platform,
    species: criteria.species,
    panelNameRaw: criteria.panelNameRaw,
    panelNameNormalized: normalizePanelName(criteria.panelNameRaw, sheetName),
    panelDescription: criteria.description,
    sapeName,
    reagents,
    analytes: category.analytes,
    premixes: category.premixes
  }
}

function findRowWith(rows: unknown[][], col: number, marker: string): number {
  const want = marker.trim().toLowerCase()
  for (let r = 0; r < rows.length; r++) {
    if (cell(rows, r, col).toLowerCase() === want) return r
  }
  return -1
}

// ------- Criteria block parser ---------------------------------------------

interface CriteriaBlock {
  platform: string
  species: string
  panelNameRaw: string
  description: string | null
}

function parseCriteria(
  sheetName: string,
  rows: unknown[][],
  startRow: number,
  endRow: number
): CriteriaBlock {
  const findLabel = (label: string): number => {
    for (let r = startRow; r < endRow; r++) {
      if (cell(rows, r, 0).toLowerCase() === label.toLowerCase()) return r
    }
    return -1
  }
  const platformRow = findLabel('Platform')
  const speciesRow = findLabel('Species')
  const panelRow = findLabel('Panel')
  const descRow = findLabel('Panel Description')

  if (platformRow < 0) throw new ParseError('Criteria block missing "Platform" row', sheetName)
  if (speciesRow < 0) throw new ParseError('Criteria block missing "Species" row', sheetName)
  if (panelRow < 0) throw new ParseError('Criteria block missing "Panel" row', sheetName)

  const platform = cell(rows, platformRow, 1)
  const species = cell(rows, speciesRow, 1)
  const panelNameRaw = cell(rows, panelRow, 1)
  const description = descRow >= 0 ? cell(rows, descRow, 1) || null : null

  if (!platform) throw new ParseError('Platform value (col B) is empty', sheetName)
  if (!species) throw new ParseError('Species value (col B) is empty', sheetName)
  if (!panelNameRaw) throw new ParseError('Panel value (col B) is empty', sheetName)

  return { platform, species, panelNameRaw, description }
}

// ------- Values block parser -----------------------------------------------

function parseValues(
  sheetName: string,
  rows: unknown[][],
  startRow: number,
  endRow: number
): ParsedReagent[] {
  // Locate header row: col A = 'Reagent Description'
  let headerRow = -1
  for (let r = startRow; r < endRow; r++) {
    if (cell(rows, r, 0).toLowerCase() === 'reagent description') {
      headerRow = r
      break
    }
  }
  if (headerRow < 0) {
    throw new ParseError(
      'Values block missing "Reagent Description" header row',
      sheetName
    )
  }

  const reagents: ParsedReagent[] = []
  const seenKinds = new Set<ReagentKind>()
  for (let r = headerRow + 1; r < endRow; r++) {
    const labelRaw = cell(rows, r, 0)
    if (!labelRaw) continue
    if (isSapeNameLabel(labelRaw)) continue // SAPE Name handled separately
    const kind = canonReagentKind(labelRaw)
    if (kind === null) continue // unknown label; skip (preserves robustness — cosmetic rows tolerated)
    if (seenKinds.has(kind)) {
      throw new ParseError(`Duplicate reagent kind "${kind}" in Values block`, sheetName)
    }
    seenKinds.add(kind)
    const concentration =
      kind === 'sape'
        ? cellNumber(rows, r, 1, `${kind} Concentration`, sheetName) // SAPE must be numeric (D-06 CHECK)
        : cellNumberOrVariable(rows, r, 1, `${kind} Concentration`, sheetName)
    const diluentRaw = cell(rows, r, 2)
    const diluent = diluentRaw === '' ? null : diluentRaw // SMK3-DIL-01: verbatim; empty -> null
    const volumePerWell = cellNumber(rows, r, 3, `${kind} Volume/well`, sheetName)
    if (volumePerWell <= 0) {
      throw new ParseError(
        `${kind} Volume/well at row ${r + 1} must be > 0 (got ${volumePerWell})`,
        sheetName
      )
    }
    reagents.push({ kind, concentration, diluent, volumePerWell })
  }
  if (reagents.length < 3) {
    throw new ParseError(
      `Values block must have 3 reagent rows (beads + antibodies + sape); found ${reagents.length}`,
      sheetName
    )
  }
  // Sort canonical order: beads, antibodies, sape
  const order: ReagentKind[] = ['beads', 'antibodies', 'sape']
  reagents.sort((a, b) => order.indexOf(a.kind) - order.indexOf(b.kind))
  return reagents
}

function findSapeName(rows: unknown[][], startRow: number, endRow: number): string | null {
  for (let r = startRow; r < endRow; r++) {
    const labelRaw = cell(rows, r, 0)
    if (isSapeNameLabel(labelRaw)) {
      const val = cell(rows, r, 1)
      return val === '' ? null : val
    }
  }
  return null
}

// ------- Category block parser ---------------------------------------------

interface CategoryBlock {
  analytes: ParsedAnalyte[]
  premixes: ParsedPremix[]
}

function parseCategory(sheetName: string, rows: unknown[][], startRow: number): CategoryBlock {
  // Phase 1: locate Premix Name + Premix Concentration cells (col >= 4).
  // In all 17 fixtures these are in col E (index 4); search anyway in case future fixtures shift.
  let premixNameRow = -1
  let premixNameCol = -1
  let premixConcRow = -1
  for (let r = startRow; r < rows.length; r++) {
    for (let c = 4; c < (rows[r]?.length ?? 0); c++) {
      if (cell(rows, r, c).toLowerCase() === 'premix name') {
        premixNameRow = r
        premixNameCol = c
        break
      }
    }
    if (premixNameRow >= 0) break
  }
  if (premixNameRow >= 0) {
    for (let r = premixNameRow; r < rows.length; r++) {
      if (cell(rows, r, premixNameCol).toLowerCase() === 'premix concentration') {
        premixConcRow = r
        break
      }
    }
    if (premixConcRow < 0) {
      throw new ParseError(
        'Category block has "Premix Name" but no "Premix Concentration" row',
        sheetName
      )
    }
  }

  // Phase 2: locate analyte data header row (col A = Analyte, col B = Bead Region, col C = Concentration)
  let analyteHeaderRow = -1
  for (let r = startRow; r < rows.length; r++) {
    if (
      cell(rows, r, 0).toLowerCase() === 'analyte' &&
      cell(rows, r, 1).toLowerCase() === 'bead region' &&
      cell(rows, r, 2).toLowerCase() === 'concentration'
    ) {
      analyteHeaderRow = r
      break
    }
  }
  if (analyteHeaderRow < 0) {
    throw new ParseError(
      'Category block missing analyte header row (expected "Analyte | Bead Region | Concentration" in cols A-C)',
      sheetName
    )
  }
  if (premixConcRow >= 0 && analyteHeaderRow < premixConcRow) {
    throw new ParseError(
      `Analyte header row (${analyteHeaderRow + 1}) must be at or after Premix Concentration row (${premixConcRow + 1})`,
      sheetName
    )
  }

  // Phase 3: collect premix column positions (header col > premixNameCol)
  const premixColumns: { col: number; name: string; premixConc: number }[] = []
  if (premixNameRow >= 0) {
    const headerRowCells = rows[premixNameRow] ?? []
    for (let c = premixNameCol + 1; c < headerRowCells.length; c++) {
      const name = cell(rows, premixNameRow, c)
      if (!name) continue
      const conc = cellNumber(
        rows,
        premixConcRow,
        c,
        `Premix "${name}" Concentration`,
        sheetName
      )
      if (conc <= 0) {
        throw new ParseError(
          `Premix "${name}" Concentration must be > 0 (got ${conc})`,
          sheetName
        )
      }
      premixColumns.push({ col: c, name, premixConc: conc })
    }
  }

  // Phase 4: walk analyte data rows downward; blank col A stops the walk (Pitfall 8).
  const analytes: ParsedAnalyte[] = []
  const seenNames = new Set<string>()
  const membersByCol = new Map<number, string[]>()
  for (const p of premixColumns) membersByCol.set(p.col, [])

  for (let r = analyteHeaderRow + 1; r < rows.length; r++) {
    const name = cell(rows, r, 0)
    if (!name) break // blank col A stops the walk (Pitfall 8)
    const lcName = name.toLowerCase()
    if (seenNames.has(lcName)) {
      throw new ParseError(`Duplicate analyte name "${name}" at row ${r + 1}`, sheetName)
    }
    seenNames.add(lcName)

    const beadRegion = cellNumber(rows, r, 1, `Analyte "${name}" Bead Region`, sheetName)
    if (!Number.isInteger(beadRegion) || beadRegion <= 0) {
      throw new ParseError(
        `Analyte "${name}" Bead Region at row ${r + 1} must be a positive integer (got ${beadRegion})`,
        sheetName
      )
    }
    const concentration = cellNumber(
      rows,
      r,
      2,
      `Analyte "${name}" Concentration`,
      sheetName
    )
    if (concentration <= 0) {
      throw new ParseError(
        `Analyte "${name}" Concentration at row ${r + 1} must be > 0 (got ${concentration})`,
        sheetName
      )
    }
    analytes.push({ name, beadRegion: Math.trunc(beadRegion), concentration })

    for (const p of premixColumns) {
      const memberName = cell(rows, r, p.col)
      // Pitfall (real Pattern B fixture): the row immediately after the
      // analyte-header/premix-conc combo line in the real all-panels.xlsx
      // Millipore fixtures carries a literal "Analyte" placeholder header in
      // each premix-member column (e.g. row 17 of Millipore Human Panel 1).
      // That row still has a real analyte in cols A-C, so we keep it in the
      // analytes list but skip the "Analyte" placeholder in member capture.
      if (!memberName) continue
      if (memberName.toLowerCase() === 'analyte') continue
      membersByCol.get(p.col)!.push(memberName)
    }
  }

  if (analytes.length === 0) {
    throw new ParseError('Category block has zero analyte rows below the header', sheetName)
  }

  const premixes: ParsedPremix[] = premixColumns.map((p) => ({
    name: p.name,
    premixConc: p.premixConc,
    memberNames: membersByCol.get(p.col) ?? []
  }))

  return { analytes, premixes }
}
