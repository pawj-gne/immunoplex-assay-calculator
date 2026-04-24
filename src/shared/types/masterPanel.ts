export interface MasterPanel {
  id: string
  name: string
  platformId: string
  speciesId: string
  beadsVolumePerWell: number
  abVolumePerWell: number
  sapeVolumePerWell: number
  vendorSinglesTerm: string | null
  createdAt: string
  updatedAt: string
}

export interface MasterPanelCreate {
  name: string
  platformId: string
  speciesId: string
  beadsVolumePerWell: number
  abVolumePerWell: number
  sapeVolumePerWell: number
  vendorSinglesTerm: string | null
}

// Phase 7 importer calls masterPanelRepository.upsertByPlatformAndSpecies(input)
export interface MasterPanelUpsertInput extends MasterPanelCreate {}

// Shared with analyte upsert — three-way discriminator (Phase 7 banner consumer)
export type UpsertAction = 'created' | 'adopted' | 'updated'

export interface UpsertResult {
  id: string
  action: UpsertAction
}
