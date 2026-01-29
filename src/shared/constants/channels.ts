export const IPC_CHANNELS = {
  // Platform
  PLATFORM_GET_ALL: 'platform:get-all',
  PLATFORM_GET_BY_ID: 'platform:get-by-id',
  PLATFORM_CREATE: 'platform:create',
  PLATFORM_UPDATE: 'platform:update',

  // Species
  SPECIES_GET_BY_PLATFORM: 'species:get-by-platform',

  // Panel
  PANEL_GET_BY_PLATFORM_SPECIES: 'panel:get-by-platform-species',
  PANEL_GET_WITH_ANALYTES: 'panel:get-with-analytes',
  PANEL_UPDATE: 'panel:update',
  PANEL_DELETE: 'panel:delete',
  PANEL_ADD_ANALYTE: 'panel:add-analyte',
  PANEL_REMOVE_ANALYTE: 'panel:remove-analyte',

  // Analyte
  ANALYTE_GET_BY_PLATFORM_SPECIES: 'analyte:get-by-platform-species',
  ANALYTE_GET_BY_PANEL: 'analyte:get-by-panel',
  ANALYTE_UPDATE: 'analyte:update',
  ANALYTE_DELETE: 'analyte:delete',

  // Database
  DB_HEALTH: 'db:health',

  // Print
  PRINT_PREP_SHEET: 'print:prep-sheet',

  // Import
  IMPORT_PANEL_DATA: 'import:panel-data'
} as const

export type IpcChannel = (typeof IPC_CHANNELS)[keyof typeof IPC_CHANNELS]
