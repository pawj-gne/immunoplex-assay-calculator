import type { Decimal } from 'decimal.js'
import type { ReplicateMode, RequestType } from '../constants/calculator'

/**
 * Inputs for volume calculations
 */
export interface CalculatorInputs {
  /** Number of unknown samples to process */
  sampleCount: number
  /** Whether samples are run in singles or duplicates */
  replicateMode: ReplicateMode
  /** Number of plates to prepare */
  plateCount: number
  /** Volume of reagent per well in µL */
  volumePerWell: Decimal
  /** Dead volume to add for pipetting loss in µL */
  deadVolume: Decimal
}

/**
 * Outputs from volume calculations
 */
export interface CalculatorOutputs {
  /** Total wells needed across all plates */
  totalWells: number
  /** Wells used for unknown samples */
  unknownWells: number
  /** Wells used for standards */
  standardWells: number
  /** Raw calculated volume in µL */
  rawVolume: Decimal
  /** Final volume rounded up to nearest mL, in µL */
  finalVolume: Decimal
  /** Final volume in mL for display */
  finalVolumeML: number
}

/**
 * Single analyte addition
 */
export interface SingleAnalyte {
  id: string
  name: string
  stockConcentration: number
  additionVolume?: Decimal // Calculated when added
}

/**
 * Single analyte with calculated addition volume
 */
export interface SingleAnalyteWithVolume extends SingleAnalyte {
  /** Calculated volume to add in µL */
  additionVolume: Decimal
  /** Display-friendly volume in µL */
  additionVolumeDisplay: string
}

/**
 * Full calculation results including singles
 */
export interface FullCalculatorOutputs extends CalculatorOutputs {
  /** Singles with their calculated addition volumes */
  singlesWithVolumes: SingleAnalyteWithVolume[]
  /** Total volume of all single additions */
  totalSinglesVolume: Decimal
  /** Whether more singles can be added */
  canAddMore: boolean
  /** How many more singles can be added */
  remainingSingles: number
}

/**
 * Full calculator state
 */
export interface CalculatorState {
  // Inputs
  sampleCount: number
  replicateMode: ReplicateMode
  plateCount: number
  requestType: RequestType
  volumePerWell: number // Will be converted to Decimal for calculations
  deadVolume: number // Will be converted to Decimal for calculations

  // Singles
  singles: SingleAnalyte[]

  // Computed outputs (derived)
  outputs: CalculatorOutputs | null
}
