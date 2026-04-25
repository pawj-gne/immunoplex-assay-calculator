import * as XLSX from 'xlsx'

export interface ParsedAnalyte {
  name: string
  bead_region: number
  single_conc: number
}

export interface ParsedSubPanel {
  name: string
  sub_panel_conc: number
  analyte_names: string[]
}

export interface ParsedPanel {
  panel_name: string
  platform: string
  species: string
  analytes: ParsedAnalyte[]
  sub_panels: ParsedSubPanel[]
}

export class ParseError extends Error {}

export function parseImportFile(filePath: string): ParsedPanel {
  const workbook = XLSX.readFile(filePath)
  const sheet = workbook.Sheets[workbook.SheetNames[0]]
  const rows = XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1, blankrows: false }) as unknown[][]

  return parseLabFormat(rows)
}

function parseLabFormat(rows: unknown[][]): ParsedPanel {
  const cell = (r: number, c: number): string => String(rows[r]?.[c] ?? '').trim()

  // ---------- Header block (rows 1-3) ----------
  if (cell(0, 0).toLowerCase() !== 'panel name') {
    throw new ParseError('Cell A1 must be "Panel Name"')
  }
  if (cell(1, 0).toLowerCase() !== 'platform') {
    throw new ParseError('Cell A2 must be "Platform"')
  }
  if (cell(2, 0).toLowerCase() !== 'species') {
    throw new ParseError('Cell A3 must be "Species"')
  }

  const panel_name = cell(0, 1)
  const platform = cell(1, 1)
  const species = cell(2, 1)
  if (!panel_name) throw new ParseError('Panel Name (cell B1) is empty')
  if (!platform) throw new ParseError('Platform (cell B2) is empty')
  if (!species) throw new ParseError('Species (cell B3) is empty')

  // ---------- Locate the analyte header row ----------
  // Look for a row with col A = "Target" and col B = "Bead Region".
  let analyteHeaderRow = -1
  for (let i = 0; i < rows.length; i++) {
    if (cell(i, 0).toLowerCase() === 'target' && cell(i, 1).toLowerCase() === 'bead region') {
      analyteHeaderRow = i
      break
    }
  }
  if (analyteHeaderRow === -1) {
    throw new ParseError('Could not find analyte header row (expected "Target" in col A and "Bead Region" in col B)')
  }

  // Find Single Concentration column index in the analyte header row
  const headerCells = (rows[analyteHeaderRow] ?? []).map((v) => String(v ?? '').trim().toLowerCase())
  const singleConcIdx = headerCells.indexOf('single concentration')
  if (singleConcIdx === -1) {
    throw new ParseError('Could not find "Single Concentration" column in analyte header row')
  }

  // ---------- Locate sub-panel header rows ----------
  // Sub-panels are listed as columns to the right of Single Concentration.
  // Convention: the row labelled "sub-panel conc" carries the concentrations,
  // and the row IMMEDIATELY ABOVE it carries the sub-panel names.
  const subPanelConcRow = findRowAbove(rows, analyteHeaderRow, (rowCells) =>
    rowCells.some((v) => String(v ?? '').trim().toLowerCase() === 'sub-panel conc')
  )

  const subPanelHeaderRow = subPanelConcRow > 0 ? subPanelConcRow - 1 : -1

  const sub_panels: ParsedSubPanel[] = []
  const subPanelColumns: { col: number; name: string; conc: number }[] = []

  if (subPanelHeaderRow !== -1 && subPanelConcRow !== -1) {
    const headerRow = rows[subPanelHeaderRow] ?? []
    const concRow = rows[subPanelConcRow] ?? []
    for (let c = singleConcIdx + 1; c < headerRow.length; c++) {
      const name = String(headerRow[c] ?? '').trim()
      if (!name) continue
      const conc = Number(concRow[c])
      if (!Number.isFinite(conc) || conc <= 0) {
        throw new ParseError(`Sub-panel "${name}" is missing a valid concentration in the sub-panel conc row`)
      }
      subPanelColumns.push({ col: c, name, conc })
    }
  }

  // ---------- Read master analyte rows ----------
  const analytes: ParsedAnalyte[] = []
  const seenNames = new Set<string>()
  for (let r = analyteHeaderRow + 1; r < rows.length; r++) {
    const name = cell(r, 0)
    if (!name) continue
    const beadRegion = Number(rows[r][1])
    const singleConc = Number(rows[r][singleConcIdx])

    if (!Number.isFinite(beadRegion) || beadRegion <= 0) {
      throw new ParseError(`Analyte "${name}" has an invalid Bead Region`)
    }
    if (!Number.isFinite(singleConc) || singleConc <= 0) {
      throw new ParseError(`Analyte "${name}" has an invalid Single Concentration`)
    }
    if (seenNames.has(name.toLowerCase())) {
      throw new ParseError(`Analyte "${name}" appears more than once in the master list`)
    }
    seenNames.add(name.toLowerCase())

    analytes.push({
      name,
      bead_region: Math.trunc(beadRegion),
      single_conc: singleConc
    })
  }

  if (analytes.length === 0) {
    throw new ParseError('No analytes found below the Target / Bead Region header row')
  }

  // ---------- Read sub-panel memberships ----------
  for (const sp of subPanelColumns) {
    const member_names: string[] = []
    for (let r = analyteHeaderRow + 1; r < rows.length; r++) {
      const name = String(rows[r][sp.col] ?? '').trim()
      if (!name) continue
      member_names.push(name)
    }
    sub_panels.push({ name: sp.name, sub_panel_conc: sp.conc, analyte_names: member_names })
  }

  return {
    panel_name,
    platform,
    species,
    analytes,
    sub_panels
  }
}

function findRowAbove(
  rows: unknown[][],
  belowRow: number,
  predicate: (cells: unknown[]) => boolean
): number {
  for (let i = belowRow - 1; i >= 0; i--) {
    if (predicate(rows[i] ?? [])) return i
  }
  return -1
}
