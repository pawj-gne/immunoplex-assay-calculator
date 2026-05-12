import { Decimal } from 'decimal.js'
import {
  STANDARD_WELLS,
  DEAD_VOLUME_PER_SETUP_UL,
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
import { createVolume, ceilToTenthML } from './decimal'

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
  // getUnknownWellsPerPlate returns samples per plate:
  //   singles: 72 (72 wells, 1 well per sample)
  //   duplicates: 36 (72 wells, 2 wells per sample — already divided)
  const samplesPerPlate = getUnknownWellsPerPlate(replicateMode)
  return samplesPerPlate * plateCount
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
 * Calculate final volume (rounded UP to nearest 0.1 mL per Smoke 3 SMK3-06)
 *
 * Uses the ceilToTenthML utility from decimal.ts. Supersedes the prior
 * "round up to nearest mL" rule (CALC-06 / STATE decision 02-01).
 */
export function calculateFinalVolume(rawVolumeUL: Decimal): Decimal {
  return ceilToTenthML(rawVolumeUL)
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
 * Apply old-reagent subtraction per Smoke 3 PRD §Calculation → Old Reagents.
 *
 * - new reagent volume = max(0, raw - old) — D-11 floor-clamp to zero so the
 *   operator never gets a negative new-reagent suggestion.
 * - total reagent = old + new (dead volume is already inside rawVolumeUL).
 *
 * Caller is responsible for:
 *   1. Floor-rounding `oldReagentUL` to 0.1 mL precision BEFORE passing in
 *      (per D-08, the floor-round happens at consumption time — typically
 *      via floorToTenthML in lib/decimal.ts converting from mL to µL).
 *   2. Applying ceilToTenthML to the returned values for display (the
 *      output-rounding asymmetry per D-07).
 *
 * This function is per-reagent (call once for beads, once for antibodies).
 * It does NOT mutate inputs.
 */
export function applyOldReagentSubtraction(
  rawVolumeUL: Decimal,
  oldReagentUL: Decimal
): { newReagentUL: Decimal; totalReagentUL: Decimal } {
  const diff = rawVolumeUL.minus(oldReagentUL)
  const newReagentUL = diff.isNegative() ? new Decimal(0) : diff
  const totalReagentUL = oldReagentUL.plus(newReagentUL)
  return { newReagentUL, totalReagentUL }
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
 * Create calculator inputs with default volumes.
 *
 * Per Smoke 3 SMK3-05, dead volume is no longer a free-form caller-provided
 * number — it is derived from `numberOfSetups × DEAD_VOLUME_PER_SETUP_UL`.
 * Default `numberOfSetups = 1` keeps the legacy 2 mL dead volume.
 *
 * BREAKING (for direct callers): the 5th positional arg WAS `deadVolumeUL`
 * (a µL number defaulting to 500). It is NOW `numberOfSetups` (an integer
 * setup count defaulting to 1). Plan 12-03 will fix calculatorStore to pass
 * `numberOfSetups` instead of the runtime `deadVolume` value. Until then,
 * the defensive sanity cap below catches a legacy caller passing 2000 (the
 * legacy 2000 µL dead-volume default) as the 5th arg.
 */
export function createCalculatorInputs(
  sampleCount: number,
  replicateMode: ReplicateMode,
  plateCount: number,
  volumePerWellUL: number = 25,
  numberOfSetups: number = 1
): CalculatorInputs {
  if (!Number.isInteger(numberOfSetups) || numberOfSetups < 1) {
    throw new Error(
      `createCalculatorInputs: numberOfSetups must be an integer >= 1 (got ${numberOfSetups})`
    )
  }
  if (numberOfSetups > 1000) {
    throw new Error(
      `createCalculatorInputs: numberOfSetups ${numberOfSetups} exceeds sanity cap of 1000 — caller likely passing deadVolume from a pre-Smoke-3 callsite`
    )
  }
  const deadVolumeUL = numberOfSetups * DEAD_VOLUME_PER_SETUP_UL
  return {
    sampleCount,
    replicateMode,
    plateCount,
    numberOfSetups,
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

  // Add panel premix if selected — sub-panel's subPanelConc applies to all
  // analytes in the sub-panel.
  if (panel) {
    const stockConc = panel.subPanelConc > 0 ? panel.subPanelConc : 1
    const premixVolumeUL = finalVolumeUL.dividedBy(stockConc)
    captureBeads.push({
      name: panel.name,
      stockConc,
      volumeUL: premixVolumeUL,
      isPremix: true
    })

    detectionAntibodies.push({
      name: panel.name,
      stockConc,
      volumeUL: premixVolumeUL,
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
