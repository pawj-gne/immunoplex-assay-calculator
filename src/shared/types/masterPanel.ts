export interface MasterPanel {
  id: string
  name: string
  platformId: string
  speciesId: string
  // Phase 13 D-10: the three per-reagent volume fields were removed and replaced
  //   by master_panel_reagents rows; see src/shared/types/masterPanelReagent.ts.
  sapeName: string | null
  description: string | null
  vendorSinglesTerm: string | null
  createdAt: string
  updatedAt: string
}

export interface MasterPanelCreate {
  name: string
  platformId: string
  speciesId: string
  sapeName?: string | null
  description?: string | null
  vendorSinglesTerm: string | null
}

// Phase 7 importer calls masterPanelRepository.upsertByPlatformAndSpecies(input)
// Phase 13 retains the type alias for v0.7.0 back-compat callers (D-11);
// new Smoke 3 callers use createWithMetadata / updateMetadata instead.
export interface MasterPanelUpsertInput extends MasterPanelCreate {}

// Shared with analyte upsert — three-way discriminator (Phase 7 banner consumer)
export type UpsertAction = 'created' | 'adopted' | 'updated'

export interface UpsertResult {
  id: string
  action: UpsertAction
}
