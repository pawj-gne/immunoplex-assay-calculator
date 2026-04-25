import * as XLSX from 'xlsx'

export interface RawImportRow {
  platform: string
  species: string
  panel_name: string
  analyte_name: string
  bead_region: number
  premix_conc: number
  single_conc: number
}

export function parseImportFile(filePath: string): RawImportRow[] {
  const workbook = XLSX.readFile(filePath)
  const sheet = workbook.Sheets[workbook.SheetNames[0]]
  const rows = XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1 }) as unknown[][]

  // Detect lab format: row 0 col 0 is "Panel Name"
  if (rows.length > 0 && String(rows[0][0]).trim() === 'Panel Name') {
    return parseLabFormat(rows)
  }

  // Fall back to legacy flat format (one header row, one analyte per row)
  return XLSX.utils.sheet_to_json<RawImportRow>(sheet)
}

function parseLabFormat(rows: unknown[][]): RawImportRow[] {
  const panelName = String(rows[0]?.[1] ?? '').trim()
  const platform = String(rows[1]?.[1] ?? '').trim()
  const species = String(rows[2]?.[1] ?? '').trim()

  if (!panelName) throw new Error('Panel Name is missing from cell B1')
  if (!platform) throw new Error('Platform is missing from cell B2')
  if (!species) throw new Error('Species is missing from cell B3')

  // Find the analyte header row: col A = "Target", col B = "Bead Region"
  let headerRowIdx = -1
  for (let i = 0; i < rows.length; i++) {
    const a = String(rows[i][0] ?? '').trim().toLowerCase()
    const b = String(rows[i][1] ?? '').trim().toLowerCase()
    if (a === 'target' && b === 'bead region') {
      headerRowIdx = i
      break
    }
  }

  if (headerRowIdx === -1) {
    throw new Error('Could not find analyte section — expected a row with "Target" and "Bead Region" column headers')
  }

  // Locate columns by name so column order doesn't matter
  const headerRow = rows[headerRowIdx].map((c) => String(c ?? '').trim().toLowerCase())
  const beadRegionIdx = headerRow.indexOf('bead region')
  const singleConcIdx = headerRow.indexOf('single concentration')

  if (beadRegionIdx === -1) throw new Error('Missing "Bead Region" column in analyte section')
  if (singleConcIdx === -1) throw new Error('Missing "Single Concentration" column in analyte section')

  const result: RawImportRow[] = []
  for (let i = headerRowIdx + 1; i < rows.length; i++) {
    const row = rows[i]
    const analyteName = String(row[0] ?? '').trim()
    if (!analyteName) continue

    result.push({
      platform,
      species,
      panel_name: panelName,
      analyte_name: analyteName,
      bead_region: Number(row[beadRegionIdx]),
      premix_conc: Number(row[singleConcIdx]),
      single_conc: Number(row[singleConcIdx])
    })
  }

  return result
}
