import { describe, it, expect } from 'vitest'
import * as path from 'path'
import { parseImportFile } from '../parser'

describe('parseImportFile (lab panel format)', () => {
  it('parses panel-template.csv correctly', () => {
    const templatePath = path.resolve(__dirname, '../../../../templates/panel-template.csv')
    const parsed = parseImportFile(templatePath)

    expect(parsed.panel_name).toBe('Example Master Panel')
    expect(parsed.platform).toBe('Millipore')
    expect(parsed.species).toBe('Mouse')

    expect(parsed.analytes).toHaveLength(5)
    expect(parsed.analytes[0]).toEqual({ name: 'Analyte 1', bead_region: 12, single_conc: 20 })
    expect(parsed.analytes[4]).toEqual({ name: 'Analyte 5', bead_region: 56, single_conc: 20 })

    expect(parsed.sub_panels).toHaveLength(3)

    const premix = parsed.sub_panels.find((sp) => sp.name === 'Premix Example 5-plex')
    expect(premix?.sub_panel_conc).toBe(1)
    expect(premix?.analyte_names).toEqual([
      'Analyte 1',
      'Analyte 2',
      'Analyte 3',
      'Analyte 4',
      'Analyte 5'
    ])

    const jamA = parsed.sub_panels.find((sp) => sp.name === 'JAMMate A')
    expect(jamA?.sub_panel_conc).toBe(20)
    expect(jamA?.analyte_names).toEqual(['Analyte 1', 'Analyte 2'])

    const jamB = parsed.sub_panels.find((sp) => sp.name === 'JAMMate B')
    expect(jamB?.sub_panel_conc).toBe(20)
    expect(jamB?.analyte_names).toEqual(['Analyte 3', 'Analyte 4'])
  })
})
