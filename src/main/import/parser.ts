import * as XLSX from 'xlsx'

export interface RawImportRow {
  platform: string
  species: string
  panel_name: string
  analyte_name: string
  bead_region: number
  bead_stock_conc: number
  antibody_stock_conc: number
  panel_description?: string
}

export function parseImportFile(filePath: string): RawImportRow[] {
  const workbook = XLSX.readFile(filePath)
  const sheet = workbook.Sheets[workbook.SheetNames[0]]
  return XLSX.utils.sheet_to_json<RawImportRow>(sheet)
}
