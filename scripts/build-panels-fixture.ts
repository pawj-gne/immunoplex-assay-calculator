/**
 * Phase 13 D-05 + SC #6: Build templates/panels/all-panels.xlsx from the 17
 * source CSV fixtures in the same directory.
 *
 * Run: npm run fixtures:panels
 *
 * Output: one workbook with 18 sheets:
 *   - 17 panel sheets (Title-case names, preserving Roman variants where used in source filenames)
 *   - 1 'Table' summary sheet from _table.csv (case-sensitive name 'Table'; D-02 parser skips by case-insensitive match)
 *
 * The generated .xlsx is committed to git (D-05 "committed once; regenerable").
 */
import * as XLSX from 'xlsx'
import * as fs from 'fs'
import * as path from 'path'

const PANELS_DIR = path.resolve(__dirname, '..', 'templates', 'panels')
const OUTPUT_PATH = path.join(PANELS_DIR, 'all-panels.xlsx')

/**
 * Minimal CSV splitter — relies on fixtures being well-formed (no quoted cells with embedded commas).
 * Verified by inspection of all 17 source CSVs in templates/panels/.
 * If a future fixture requires quoted-CSV handling, swap to `csv-parse` or `papaparse`.
 */
function csvToRows(csvText: string): string[][] {
  return csvText
    .split(/\r?\n/)
    .filter((line, idx, arr) => idx < arr.length - 1 || line.length > 0) // drop trailing empty line
    .map((line) => line.split(','))
}

/**
 * Derive Title-case sheet name from filename.
 *
 * Examples:
 *   bio-rad-human-panel-1.csv      → "Bio-Rad Human Panel 1"
 *   millipore-mouse-panel-3.csv    → "Millipore Mouse Panel 3"
 *   thermofisher-human-panel-i.csv → "Thermofisher Human Panel I"   (Roman preserved)
 *   thermofisher-mouse-panel-i.csv → "Thermofisher Mouse Panel I"   (Roman preserved)
 *
 * Roman preservation: if the last hyphen-separated token matches /^[ivx]+$/i,
 * upper-case it (Title-case rule produces "I" not "1"); else if numeric, leave as-is.
 */
function deriveSheetName(csvFilename: string): string {
  const base = path.basename(csvFilename, '.csv') // 'thermofisher-human-panel-i'
  const tokens = base.split('-') // ['thermofisher','human','panel','i']
  const titled = tokens.map((tok, idx) => {
    if (idx === tokens.length - 1) {
      // last token: numeric → keep digits; roman → uppercase
      if (/^[ivx]+$/i.test(tok)) return tok.toUpperCase()
      return tok
    }
    // Title-case for word tokens; preserve Bio-Rad hyphenation by joining on space
    if (tok.length === 0) return tok
    return tok.charAt(0).toUpperCase() + tok.slice(1)
  })
  // Special case: "bio-rad" becomes "Bio-Rad" not "Bio Rad"
  // Recompose: join Bio + Rad with hyphen; everyone else with space.
  // Easier approach: handle known multi-hyphen vendor names explicitly.
  // For Phase 13 fixtures, only 'bio-rad' has the multi-hyphen pattern.
  let result = titled.join(' ')
  result = result.replace(/^Bio Rad/, 'Bio-Rad')
  return result
}

function main(): void {
  if (!fs.existsSync(PANELS_DIR)) {
    console.error(`Panels directory not found: ${PANELS_DIR}`)
    process.exit(1)
  }
  const allFiles = fs.readdirSync(PANELS_DIR).sort()
  const panelCsvs = allFiles.filter((f) => f.endsWith('.csv') && f !== '_table.csv')
  const tableCsv = '_table.csv'

  if (panelCsvs.length === 0) {
    console.error('No panel CSV fixtures found.')
    process.exit(1)
  }
  if (!allFiles.includes(tableCsv)) {
    console.error(`Missing required ${tableCsv}`)
    process.exit(1)
  }

  console.log(`Found ${panelCsvs.length} panel CSV(s) + 1 Table summary CSV`)

  const wb = XLSX.utils.book_new()

  for (const csvFile of panelCsvs) {
    const text = fs.readFileSync(path.join(PANELS_DIR, csvFile), 'utf-8')
    const rows = csvToRows(text)
    const sheet = XLSX.utils.aoa_to_sheet(rows)
    const sheetName = deriveSheetName(csvFile)
    XLSX.utils.book_append_sheet(wb, sheet, sheetName)
    console.log(`  + ${sheetName} (${rows.length} rows)`)
  }

  // Append Table summary sheet last
  const tableText = fs.readFileSync(path.join(PANELS_DIR, tableCsv), 'utf-8')
  const tableRows = csvToRows(tableText)
  const tableSheet = XLSX.utils.aoa_to_sheet(tableRows)
  XLSX.utils.book_append_sheet(wb, tableSheet, 'Table')
  console.log(`  + Table (${tableRows.length} rows)`)

  XLSX.writeFile(wb, OUTPUT_PATH)
  console.log(`\nWrote ${panelCsvs.length + 1} sheets to ${OUTPUT_PATH}`)
}

main()
