import { describe, it, expect, afterEach } from 'vitest'
import * as XLSX from 'xlsx'
import * as fs from 'fs'
import * as path from 'path'
import * as os from 'os'
import { parseWorkbook, parseSheet, ParseError } from '../parser'

/** Build an in-memory .xlsx from AoA inputs, write to temp, return file path */
function buildTempXlsx(sheets: { name: string; rows: unknown[][] }[]): string {
  const wb = XLSX.utils.book_new()
  for (const s of sheets) {
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(s.rows), s.name)
  }
  const tmpPath = path.join(
    os.tmpdir(),
    `parser-test-${Date.now()}-${Math.random().toString(36).slice(2)}.xlsx`
  )
  XLSX.writeFile(wb, tmpPath)
  createdFiles.push(tmpPath)
  return tmpPath
}

const createdFiles: string[] = []
afterEach(() => {
  while (createdFiles.length) {
    const p = createdFiles.pop()!
    try {
      fs.unlinkSync(p)
    } catch {
      /* ignore */
    }
  }
})

// ---------------------------------------------------------------------------
// Reference fixtures (inline AoA, deliberately self-contained)
// ---------------------------------------------------------------------------

/**
 * Pattern A: analyte-header row is BELOW the Premix Concentration row.
 * Mirrors 16 of 17 production fixtures (Bio-Rad, Thermofisher, most Millipore).
 *
 * Layout (0-indexed rows):
 *  r0  Criteria
 *  r1  Platform | Bio-Rad
 *  r2  Species  | Human
 *  r3  Panel    | Panel 1
 *  r4  Panel Description | Cytokine
 *  r5  (blank)
 *  r6  Values
 *  r7  Reagent Description | Concentration | Diluent | Volume/well (ml)
 *  r8  Beads      | variable | L-AB | 0.025
 *  r9  Antibodies (trailing whitespace - Pitfall A) | variable | L-AB | 0.025
 *  r10 SAPE       | 1        | n/a  | 0.025
 *  r11 SAPE Name  | Streptavidin-PE
 *  r12 (blank)
 *  r13 Category
 *  r14 [_,_,_,_,Premix Name, Premix A, Premix B]
 *  r15 [Single Analytes,_,_,_, Premix Concentration, 1, 1]
 *  r16 [Analyte, Bead Region, Concentration, _, Count, Analyte, Analyte]
 *  r17 [IL-6, 12, 50, _, 1, IL-6, _]
 *  r18 [IL-10, 13, 50, _, 2, IL-10, IL-10]
 */
const PATTERN_A_SHEET: unknown[][] = [
  ['Criteria'],
  ['Platform', 'Bio-Rad'],
  ['Species', 'Human'],
  ['Panel', 'Panel 1'],
  ['Panel Description', 'Cytokine'],
  [],
  ['Values'],
  ['Reagent Description', 'Concentration', 'Diluent', 'Volume/well (ml)'],
  ['Beads', 'variable', 'L-AB', 0.025],
  ['Antibodies ', 'variable', 'L-AB', 0.025], // trailing whitespace - Pitfall A
  ['SAPE', 1, 'n/a', 0.025],
  ['SAPE Name', 'Streptavidin-PE'],
  [],
  ['Category'],
  [null, null, null, null, 'Premix Name', 'Premix A', 'Premix B'],
  ['Single Analytes', null, null, null, 'Premix Concentration', 1, 1],
  ['Analyte', 'Bead Region', 'Concentration', null, 'Count', 'Analyte', 'Analyte'],
  ['IL-6', 12, 50, null, 1, 'IL-6', null],
  ['IL-10', 13, 50, null, 2, 'IL-10', 'IL-10']
]

/**
 * Pattern B: analyte-header row COINCIDES with the Premix Concentration row.
 * Mirrors Millipore Human Panel 1 fixture (the one outlier in 17 production fixtures).
 *
 *  r0  Criteria
 *  r1  Platform | Millipore
 *  r2  Species  | Human
 *  r3  Panel    | Panel I   <- Roman; exercises D-19
 *  r4  Panel Description | Cytokines
 *  r5  (blank)
 *  r6  Values
 *  r7  Reagent Description | Concentration | Diluent | Volume/well (ml)
 *  r8  Beads      | variable | Assay Buffer | 0.025
 *  r9  Antibodies | variable | Assay Buffer | 0.025
 *  r10 SAPE       | 1        | n/a          | 0.025
 *  r11 SAPE Name  | SAPE-10
 *  r12 (blank)
 *  r13 Category
 *  r14 [Single Analytes,_,_,_, Premix Name, Premix Panel I 5-plex]
 *  r15 [Analyte, Bead Region, Concentration, _, Premix Concentration, 1]  <- analyte-header coincides with Premix Conc
 *  r16 [IL-6, 12, 50, _, 1]
 *  r17 [IL-10, 13, 50, _, 2]
 *  r18 [IFN-g, 14, 50, _, 3]
 */
const PATTERN_B_SHEET: unknown[][] = [
  ['Criteria'],
  ['Platform', 'Millipore'],
  ['Species', 'Human'],
  ['Panel', 'Panel I'], // Roman, exercises D-19
  ['Panel Description', 'Cytokines'],
  [],
  ['Values'],
  ['Reagent Description', 'Concentration', 'Diluent', 'Volume/well (ml)'],
  ['Beads', 'variable', 'Assay Buffer', 0.025],
  ['Antibodies', 'variable', 'Assay Buffer', 0.025],
  ['SAPE', 1, 'n/a', 0.025],
  ['SAPE Name', 'SAPE-10'],
  [],
  ['Category'],
  ['Single Analytes', null, null, null, 'Premix Name', 'Premix Panel I 5-plex'],
  ['Analyte', 'Bead Region', 'Concentration', null, 'Premix Concentration', 1],
  ['IL-6', 12, 50, null, 1],
  ['IL-10', 13, 50, null, 2],
  ['IFN-g', 14, 50, null, 3]
]

const TABLE_DECORATIVE: unknown[][] = [
  ['Decorative summary tab; importer should skip per D-02.'],
  ['Panel', 'Range', 'Notes'],
  ['Panel 1', '1 through 7', 'Cytokines']
]

// ---------------------------------------------------------------------------
// parseWorkbook — multi-sheet + Table skip
// ---------------------------------------------------------------------------

describe('parseWorkbook (multi-sheet + Table skip)', () => {
  it('T-1: returns ParsedPanel[] (array, not single object)', () => {
    const file = buildTempXlsx([{ name: 'Bio-Rad Human Panel 1', rows: PATTERN_A_SHEET }])
    const out = parseWorkbook(file)
    expect(Array.isArray(out)).toBe(true)
    expect(out).toHaveLength(1)
    expect(out[0].sheetName).toBe('Bio-Rad Human Panel 1')
  })

  it('T-2: case-insensitive Table sheet skip (Table, table, TABLE, "  Table  ")', () => {
    const file = buildTempXlsx([
      { name: 'Table', rows: TABLE_DECORATIVE },
      { name: 'Bio-Rad Human Panel 1', rows: PATTERN_A_SHEET }
    ])
    const out = parseWorkbook(file)
    expect(out).toHaveLength(1)
    expect(out[0].sheetName).toBe('Bio-Rad Human Panel 1')

    const file2 = buildTempXlsx([
      { name: 'table', rows: TABLE_DECORATIVE },
      { name: 'Bio-Rad Human Panel 1', rows: PATTERN_A_SHEET }
    ])
    expect(parseWorkbook(file2)).toHaveLength(1)

    const file3 = buildTempXlsx([
      { name: 'TABLE', rows: TABLE_DECORATIVE },
      { name: 'Bio-Rad Human Panel 1', rows: PATTERN_A_SHEET }
    ])
    expect(parseWorkbook(file3)).toHaveLength(1)

    // Note: XLSX truncates sheet names to 31 chars and may strip leading whitespace
    // during writeFile, but `parseWorkbook` should still match via trim+lowercase.
    const file4 = buildTempXlsx([
      { name: 'Table ', rows: TABLE_DECORATIVE },
      { name: 'Bio-Rad Human Panel 1', rows: PATTERN_A_SHEET }
    ])
    expect(parseWorkbook(file4)).toHaveLength(1)
  })

  it('T-3: workbook with 2 non-Table sheets returns length 2', () => {
    const file = buildTempXlsx([
      { name: 'Table', rows: TABLE_DECORATIVE },
      { name: 'Bio-Rad Human Panel 1', rows: PATTERN_A_SHEET },
      { name: 'Millipore Human Panel 1', rows: PATTERN_B_SHEET }
    ])
    const out = parseWorkbook(file)
    expect(out).toHaveLength(2)
    expect(out.map((p) => p.sheetName)).toEqual([
      'Bio-Rad Human Panel 1',
      'Millipore Human Panel 1'
    ])
  })

  it('T-4: non-Table sheet missing Criteria marker rejected with attributed ParseError', () => {
    const missingCriteria: unknown[][] = PATTERN_A_SHEET.slice(1) // drop the Criteria row
    const file = buildTempXlsx([{ name: 'NoCriteria', rows: missingCriteria }])
    try {
      parseWorkbook(file)
      throw new Error('expected parseWorkbook to throw')
    } catch (err) {
      expect(err).toBeInstanceOf(ParseError)
      expect((err as ParseError).message).toMatch(/Criteria/)
      expect((err as ParseError).message).toContain('[NoCriteria]')
    }
  })

  it('T-5: non-Table sheet missing Values marker rejected', () => {
    const rows: unknown[][] = [
      ['Criteria'],
      ['Platform', 'Bio-Rad'],
      ['Species', 'Human'],
      ['Panel', 'Panel 1'],
      // no Values block
      ['Category'],
      ['Analyte', 'Bead Region', 'Concentration'],
      ['IL-6', 12, 50]
    ]
    expect(() => parseSheet('NoValues', rows)).toThrow(/Values/)
  })

  it('T-6: non-Table sheet missing Category marker rejected', () => {
    const rows: unknown[][] = [
      ['Criteria'],
      ['Platform', 'Bio-Rad'],
      ['Species', 'Human'],
      ['Panel', 'Panel 1'],
      ['Values'],
      ['Reagent Description', 'Concentration', 'Diluent', 'Volume/well (ml)'],
      ['Beads', 'variable', 'L-AB', 0.025],
      ['Antibodies', 'variable', 'L-AB', 0.025],
      ['SAPE', 1, 'n/a', 0.025]
      // no Category block
    ]
    expect(() => parseSheet('NoCategory', rows)).toThrow(/Category/)
  })
})

// ---------------------------------------------------------------------------
// parseSheet — Criteria block
// ---------------------------------------------------------------------------

describe('parseSheet — Criteria block', () => {
  it('T-7: Platform / Species / Panel labels in col A -> col B values captured', () => {
    const parsed = parseSheet('PatternASheet', PATTERN_A_SHEET)
    expect(parsed.platform).toBe('Bio-Rad')
    expect(parsed.species).toBe('Human')
    expect(parsed.panelNameRaw).toBe('Panel 1')
  })

  it('T-8: Panel value "Panel I" -> panelNameRaw stays raw, panelNameNormalized -> "Panel 1"', () => {
    const parsed = parseSheet('PatternBSheet', PATTERN_B_SHEET)
    expect(parsed.panelNameRaw).toBe('Panel I')
    expect(parsed.panelNameNormalized).toBe('Panel 1')
  })

  it('T-9: Panel value "Panel 3" -> panelNameNormalized "Panel 3" (digit passthrough)', () => {
    const rows = clone(PATTERN_A_SHEET)
    setCell(rows, 3, 1, 'Panel 3')
    const parsed = parseSheet('Panel3', rows)
    expect(parsed.panelNameNormalized).toBe('Panel 3')
  })

  it('T-10: Panel Description optional; absent -> null', () => {
    const rows: unknown[][] = clone(PATTERN_A_SHEET)
    // Remove the Panel Description row at index 4
    rows.splice(4, 1)
    const parsed = parseSheet('NoDesc', rows)
    expect(parsed.panelDescription).toBeNull()
  })

  it('T-11: Missing Panel label in Criteria block -> ParseError', () => {
    const rows: unknown[][] = clone(PATTERN_A_SHEET)
    // Remove the Panel row at index 3
    rows.splice(3, 1)
    expect(() => parseSheet('NoPanel', rows)).toThrow(/"Panel"/)
  })

  it('T-12: Empty Panel value (col B) -> ParseError', () => {
    const rows = clone(PATTERN_A_SHEET)
    setCell(rows, 3, 1, '')
    expect(() => parseSheet('EmptyPanel', rows)).toThrow(/Panel value/)
  })
})

// ---------------------------------------------------------------------------
// parseSheet — Values block
// ---------------------------------------------------------------------------

describe('parseSheet — Values block', () => {
  it('T-13: three reagent rows -> reagents[] length 3 (beads, antibodies, sape)', () => {
    const parsed = parseSheet('VB', PATTERN_A_SHEET)
    expect(parsed.reagents).toHaveLength(3)
    expect(parsed.reagents.map((r) => r.kind)).toEqual(['beads', 'antibodies', 'sape'])
  })

  it('T-14: "variable" on beads concentration -> concentration null (D-07)', () => {
    const parsed = parseSheet('VarBeads', PATTERN_A_SHEET)
    const beads = parsed.reagents.find((r) => r.kind === 'beads')!
    expect(beads.concentration).toBeNull()
  })

  it('T-15: numeric SAPE concentration captured', () => {
    const parsed = parseSheet('SapeNum', PATTERN_A_SHEET)
    const sape = parsed.reagents.find((r) => r.kind === 'sape')!
    expect(sape.concentration).toBe(1)
  })

  it('T-16: "n/a" diluent stored verbatim (SMK3-DIL-01)', () => {
    const parsed = parseSheet('SapeDil', PATTERN_A_SHEET)
    const sape = parsed.reagents.find((r) => r.kind === 'sape')!
    expect(sape.diluent).toBe('n/a')
  })

  it('T-17: empty diluent cell -> null', () => {
    const rows = clone(PATTERN_A_SHEET)
    // SAPE row index 10, col C (index 2) -> empty
    setCell(rows, 10, 2, '')
    const parsed = parseSheet('EmptyDil', rows)
    const sape = parsed.reagents.find((r) => r.kind === 'sape')!
    expect(sape.diluent).toBeNull()
  })

  it('T-18: "Antibodies " (trailing whitespace - Pitfall A) -> canonicalized to "antibodies"', () => {
    const parsed = parseSheet('TrailingWs', PATTERN_A_SHEET)
    expect(parsed.reagents.map((r) => r.kind)).toContain('antibodies')
  })

  it('T-19: SAPE Name row captured into sapeName field; absent -> null', () => {
    const parsedA = parseSheet('WithSapeName', PATTERN_A_SHEET)
    expect(parsedA.sapeName).toBe('Streptavidin-PE')

    const rowsNoName = clone(PATTERN_A_SHEET)
    // Remove the SAPE Name row at index 11
    rowsNoName.splice(11, 1)
    const parsedB = parseSheet('NoSapeName', rowsNoName)
    expect(parsedB.sapeName).toBeNull()
  })

  it('T-20: fewer than 3 reagents detected -> ParseError', () => {
    const rows = clone(PATTERN_A_SHEET)
    // Drop the Antibodies row at index 9
    rows.splice(9, 1)
    expect(() => parseSheet('TwoReagents', rows)).toThrow(/3 reagent rows/)
  })
})

// ---------------------------------------------------------------------------
// parseSheet — Category block (Pattern A and Pattern B)
// ---------------------------------------------------------------------------

describe('parseSheet — Category block (Pattern A and Pattern B)', () => {
  it('T-21 Pattern A: analyte data starts BELOW Premix Concentration row', () => {
    const parsed = parseSheet('PatternASheet', PATTERN_A_SHEET)
    expect(parsed.analytes).toHaveLength(2)
    expect(parsed.analytes.map((a) => a.name)).toEqual(['IL-6', 'IL-10'])
    expect(parsed.analytes[0]).toEqual({ name: 'IL-6', beadRegion: 12, concentration: 50 })
    expect(parsed.analytes[1]).toEqual({ name: 'IL-10', beadRegion: 13, concentration: 50 })
    expect(parsed.premixes).toHaveLength(2)
    expect(parsed.premixes[0].name).toBe('Premix A')
    expect(parsed.premixes[0].premixConc).toBe(1)
    expect(parsed.premixes[0].memberNames).toEqual(['IL-6', 'IL-10'])
    expect(parsed.premixes[1].name).toBe('Premix B')
    expect(parsed.premixes[1].memberNames).toEqual(['IL-10'])
  })

  it('T-22 Pattern B: analyte-header COINCIDES with Premix Concentration row', () => {
    const parsed = parseSheet('PatternBSheet', PATTERN_B_SHEET)
    expect(parsed.analytes).toHaveLength(3)
    expect(parsed.analytes.map((a) => a.name)).toEqual(['IL-6', 'IL-10', 'IFN-g'])
    expect(parsed.panelNameNormalized).toBe('Panel 1') // Roman I -> Arabic 1
    expect(parsed.premixes).toHaveLength(1)
    expect(parsed.premixes[0].name).toBe('Premix Panel I 5-plex')
    expect(parsed.premixes[0].premixConc).toBe(1)
    // Pattern B fixture has no premix-member cells populated (analyte rows only fill cols A-C),
    // so memberNames is the empty list. Validator will surface this as an empty membership.
    expect(parsed.premixes[0].memberNames).toEqual([])
  })

  it('T-23: walk analyte rows downward; blank col A stops the walk (Pitfall 8)', () => {
    const rows = clone(PATTERN_A_SHEET)
    // Insert a blank row mid-walk (between IL-6 and IL-10)
    rows.splice(18, 0, [null, null, null])
    const parsed = parseSheet('BlankRowStops', rows)
    // Only IL-6 captured (walk stopped at blank row before IL-10)
    expect(parsed.analytes.map((a) => a.name)).toEqual(['IL-6'])
  })

  it('T-24: duplicate analyte name within same sheet -> ParseError', () => {
    const rows = clone(PATTERN_A_SHEET)
    setCell(rows, 18, 0, 'IL-6') // duplicate IL-6 in row 18
    expect(() => parseSheet('DupAnalyte', rows)).toThrow(/Duplicate analyte/)
  })

  it('T-25: each premix column header maps to ParsedPremix with name+premixConc+memberNames', () => {
    const parsed = parseSheet('Premixes', PATTERN_A_SHEET)
    expect(parsed.premixes[0]).toMatchObject({
      name: 'Premix A',
      premixConc: 1,
      memberNames: ['IL-6', 'IL-10']
    })
    expect(parsed.premixes[1]).toMatchObject({
      name: 'Premix B',
      premixConc: 1,
      memberNames: ['IL-10']
    })
  })

  it('T-26: empty premix column header -> skipped', () => {
    const rows = clone(PATTERN_A_SHEET)
    // Wipe out Premix B name (row 14 col 6); should produce only 1 premix
    setCell(rows, 14, 6, '')
    const parsed = parseSheet('SparseHeaders', rows)
    expect(parsed.premixes).toHaveLength(1)
    expect(parsed.premixes[0].name).toBe('Premix A')
  })

  it('T-27: bead region non-integer -> ParseError', () => {
    const rows = clone(PATTERN_A_SHEET)
    setCell(rows, 17, 1, 'not-a-number')
    expect(() => parseSheet('BadBead', rows)).toThrow(/Bead Region/)
  })

  it('T-28: concentration non-numeric -> ParseError', () => {
    const rows = clone(PATTERN_A_SHEET)
    setCell(rows, 17, 2, 'fifty')
    expect(() => parseSheet('BadConc', rows)).toThrow(/Concentration/)
  })
})

// ---------------------------------------------------------------------------
// Helpers — defensive deep-ish clone of AoA fixtures + cell setter
// ---------------------------------------------------------------------------

function clone(rows: unknown[][]): unknown[][] {
  return rows.map((r) => (Array.isArray(r) ? [...r] : r))
}

function setCell(rows: unknown[][], r: number, c: number, value: unknown): void {
  if (!Array.isArray(rows[r])) rows[r] = []
  // Pad with nulls if needed
  while (rows[r].length <= c) rows[r].push(null)
  rows[r][c] = value
}
