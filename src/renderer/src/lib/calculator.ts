import { Decimal } from 'decimal.js'
import {
  STANDARD_WELLS,
  getUnknownWellsPerPlate,
  getMaxSingles,
  type ReplicateMode,
  type RequestType
} from '../../../shared/constants/calculator'
import type {
  CalculatorInputs,
  CalculatorOutputs,
  SingleAnalyte,
  ItemizedVolumes,
  ReagentLine
} from '../../../shared/types/calculator'
import type { Analyte } from '../../../shared/types/analyte'
import type { PanelWithAnalytes } from '../../../shared/types/panel'
import { createVolume, roundUpToNearestML } from './decimal'

/**
 * Calculate total wells needed for a given number of samples
 *
 * Formula: (samples × replicate_factor) + (standards × plates)
 * - Singles: 1 well per sample
 * - Duplicates: 2 wells per sample
 * - Standards: 24 wells per plate (each plate needs its own standard curve)
 */
export function calculateTotalWells(
  sampleCount: number,
  replicateMode: ReplicateMode,
  plateCount: number
): { totalWells: number; unknownWells: number; standardWells: number } {
  const replicateFactor = replicateMode === 'singles' ? 1 : 2
  const unknownWells = sampleCount * replicateFactor
  const standardWells = STANDARD_WELLS * plateCount

  return {
    totalWells: unknownWells + standardWells,
    unknownWells,
    standardWells
  }
}

/**
 * Calculate the maximum number of samples that fit on the given plates
 */
export function calculateMaxSamples(replicateMode: ReplicateMode, plateCount: number): number {
  const unknownWellsPerPlate = getUnknownWellsPerPlate(replicateMode)
  const totalUnknownWells = unknownWellsPerPlate * plateCount
  const replicateFactor = replicateMode === 'singles' ? 1 : 2
  return Math.floor(totalUnknownWells / replicateFactor)
}

/**
 * Calculate raw volume before rounding
 *
 * Formula: (total_wells × volume_per_well) + dead_volume
 */
export function calculateRawVolume(
  totalWells: number,
  volumePerWell: Decimal,
  deadVolume: Decimal
): Decimal {
  return volumePerWell.times(totalWells).plus(deadVolume)
}

/**
 * Calculate final volume (rounded up to nearest mL)
 *
 * Uses the roundUpToNearestML utility from decimal.ts
 */
export function calculateFinalVolume(rawVolumeUL: Decimal): Decimal {
  return roundUpToNearestML(rawVolumeUL)
}

/**
 * Perform full volume calculation from inputs to outputs
 */
export function calculateVolumes(inputs: CalculatorInputs): CalculatorOutputs {
  const { sampleCount, replicateMode, plateCount, volumePerWell, deadVolume } = inputs

  // Calculate wells
  const { totalWells, unknownWells, standardWells } = calculateTotalWells(
    sampleCount,
    replicateMode,
    plateCount
  )

  // Calculate volumes
  const rawVolume = calculateRawVolume(totalWells, volumePerWell, deadVolume)
  const finalVolume = calculateFinalVolume(rawVolume)
  const finalVolumeML = finalVolume.dividedBy(1000).toNumber()

  return {
    totalWells,
    unknownWells,
    standardWells,
    rawVolume,
    finalVolume,
    finalVolumeML
  }
}

/**
 * Validate sample count against plate capacity
 */
export function validateSampleCount(
  sampleCount: number,
  replicateMode: ReplicateMode,
  plateCount: number
): { valid: boolean; maxSamples: number; message?: string } {
  const maxSamples = calculateMaxSamples(replicateMode, plateCount)

  if (sampleCount <= 0) {
    return { valid: false, maxSamples, message: 'Sample count must be greater than 0' }
  }

  if (sampleCount > maxSamples) {
    return {
      valid: false,
      maxSamples,
      message: `Sample count exceeds plate capacity. Maximum ${maxSamples} samples for ${plateCount} plate(s) in ${replicateMode} mode.`
    }
  }

  return { valid: true, maxSamples }
}

/**
 * Create calculator inputs with default volumes
 */
export function createCalculatorInputs(
  sampleCount: number,
  replicateMode: ReplicateMode,
  plateCount: number,
  volumePerWellUL: number = 25,
  deadVolumeUL: number = 500
): CalculatorInputs {
  return {
    sampleCount,
    replicateMode,
    plateCount,
    volumePerWell: createVolume(volumePerWellUL, 'uL'),
    deadVolume: createVolume(deadVolumeUL, 'uL')
  }
}

/**
 * Calculate the addition volume for a single analyte
 *
 * Formula: addition_volume = master_mix_volume / stock_concentration
 *
 * Example: 5000 µL master mix, 20x stock = 250 µL addition
 */
export function calculateSingleAdditionVolume(
  masterMixVolume: Decimal,
  stockConcentration: number
): Decimal {
  return masterMixVolume.dividedBy(stockConcentration)
}

/**
 * Calculate addition volumes for all singles
 *
 * Takes the final master mix volume and calculates how much of each
 * single analyte to add based on their stock concentrations.
 */
export function calculateSingleAdditions(
  masterMixVolume: Decimal,
  singles: SingleAnalyte[]
): Array<SingleAnalyte & { additionVolume: Decimal }> {
  return singles.map((single) => ({
    ...single,
    additionVolume: calculateSingleAdditionVolume(masterMixVolume, single.stockConcentration)
  }))
}

/**
 * Check if more singles can be added based on request type
 */
export function canAddSingle(requestType: RequestType, currentCount: number): boolean {
  const maxSingles = getMaxSingles(requestType)
  return currentCount < maxSingles
}

/**
 * Get remaining singles count
 */
export function getRemainingSingles(requestType: RequestType, currentCount: number): number {
  const maxSingles = getMaxSingles(requestType)
  if (maxSingles === Infinity) return Infinity
  return Math.max(0, maxSingles - currentCount)
}

/**
 * Validate singles count when changing request type
 * Returns singles that need to be removed if switching to a more restrictive type
 */
export function validateSinglesForRequestType(
  requestType: RequestType,
  singles: SingleAnalyte[]
): { valid: boolean; excess: number; message?: string } {
  const maxSingles = getMaxSingles(requestType)
  const currentCount = singles.length

  if (currentCount <= maxSingles) {
    return { valid: true, excess: 0 }
  }

  const excess = currentCount - maxSingles
  return {
    valid: false,
    excess,
    message: `${excess} single(s) must be removed for ${requestType} mode (max ${maxSingles})`
  }
}

/**
 * Calculate itemized volumes for all reagents based on selected analytes
 *
 * Output format:
 * - Capture Beads: premix line (if panel selected) + individual lines for singles
 * - Detection Antibodies: premix line (if panel selected) + individual lines for singles
 * - SA-PE: total volume only
 *
 * Formula for single additions: finalVolume / stockConcentration
 */
export function calculateItemizedVolumes(
  finalVolumeUL: Decimal,
  panel: PanelWithAnalytes | null,
  singleAnalytes: Analyte[]
): ItemizedVolumes {
  const captureBeads: ReagentLine[] = []
  const detectionAntibodies: ReagentLine[] = []

  // Add panel premix if selected
  if (panel) {
    // For premix, the stock concentration is 1x (ready to use)
    captureBeads.push({
      name: panel.name,
      stockConc: 1,
      volumeUL: finalVolumeUL,
      isPremix: true
    })

    detectionAntibodies.push({
      name: panel.name,
      stockConc: 1,
      volumeUL: finalVolumeUL,
      isPremix: true
    })
  } else if (singleAnalytes.length === 0) {
    // Custom assay buffer for beads when no panel and no singles
    captureBeads.push({
      name: 'Assay Buffer',
      stockConc: 1,
      volumeUL: finalVolumeUL,
      isPremix: false
    })

    detectionAntibodies.push({
      name: 'Assay Buffer',
      stockConc: 1,
      volumeUL: finalVolumeUL,
      isPremix: false
    })
  }

  // Add individual analytes (singles)
  for (const analyte of singleAnalytes) {
    // Capture beads
    captureBeads.push({
      name: analyte.name,
      stockConc: analyte.singleConc,
      volumeUL: finalVolumeUL.dividedBy(analyte.singleConc),
      beadRegion: analyte.beadRegion,
      isPremix: false
    })

    // Detection antibodies
    detectionAntibodies.push({
      name: analyte.name,
      stockConc: analyte.singleConc,
      volumeUL: finalVolumeUL.dividedBy(analyte.singleConc),
      beadRegion: analyte.beadRegion,
      isPremix: false
    })
  }

  // SA-PE is always the full final volume
  const saPEVolumeUL = finalVolumeUL
  const saPEVolumeML = finalVolumeUL.dividedBy(1000).toNumber()

  return {
    captureBeads,
    detectionAntibodies,
    saPEVolumeUL,
    saPEVolumeML
  }
}
