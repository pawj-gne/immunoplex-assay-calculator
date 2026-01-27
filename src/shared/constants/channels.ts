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

  // Analyte
  ANALYTE_GET_BY_PLATFORM_SPECIES: 'analyte:get-by-platform-species',
  ANALYTE_GET_BY_PANEL: 'analyte:get-by-panel',

  // Database
  DB_HEALTH: 'db:health',

  // Print
  PRINT_PREP_SHEET: 'print:prep-sheet'
} as const

export type IpcChannel = (typeof IPC_CHANNELS)[keyof typeof IPC_CHANNELS]
