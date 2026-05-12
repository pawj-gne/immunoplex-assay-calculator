/**
 * Phase 13 (D-06, D-07, SMK3-DIL-01): Per-reagent rows for master panels.
 * Replaces the dropped beads/ab/sape_volume_per_well columns on master_panels.
 */

export type ReagentKind = 'beads' | 'antibodies' | 'sape'

export interface MasterPanelReagent {
  id: string
  masterPanelId: string
  reagentKind: ReagentKind
  concentration: number | null // D-07: NULL = 'variable' sentinel (beads/antibodies); SAPE rows must be non-null (DB CHECK)
  diluent: string | null // SMK3-DIL-01 open-text; verbatim from xlsx (n/a, L-AB, Assay Buffer)
  volumePerWell: number
  createdAt: string
  updatedAt: string
}

export interface MasterPanelReagentCreate {
  masterPanelId: string
  reagentKind: ReagentKind
  concentration: number | null
  diluent: string | null
  volumePerWell: number
}
