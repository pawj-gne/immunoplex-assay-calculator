import Decimal from 'decimal.js'

// Configure decimal.js for scientific precision
Decimal.set({ precision: 20, rounding: Decimal.ROUND_HALF_UP })

// Re-export Decimal class for direct use
export { Decimal }

/**
 * Volume operations - internal unit is microliters (uL)
 */
export function createVolume(value: number | string, unit: 'uL' | 'mL' = 'uL'): Decimal {
  const decimal = new Decimal(value)
  return unit === 'mL' ? decimal.times(1000) : decimal
}

export function volumeToDisplay(volumeUL: Decimal, unit: 'uL' | 'mL' = 'uL', decimals = 2): string {
  const converted = unit === 'mL' ? volumeUL.dividedBy(1000) : volumeUL
  return converted.toFixed(decimals)
}

export function addVolumes(...volumes: Decimal[]): Decimal {
  return volumes.reduce((sum, v) => sum.plus(v), new Decimal(0))
}

export function multiplyVolume(volume: Decimal, factor: number | Decimal): Decimal {
  return volume.times(factor)
}

/**
 * Round volume UP to nearest 0.1 mL (ceiling at 0.1 mL precision).
 * Per Smoke 3 PRD (SMK3-06): supersedes the previous "round up to nearest mL"
 * rule from CALC-06 / STATE decision 02-01.
 *
 * Input: volume in µL (Decimal)
 * Output: volume in µL (Decimal), rounded UP at 0.1 mL precision
 *
 * Examples (µL → µL):
 *   7400 → 7400  (already at 0.1 mL)
 *   7401 → 7500
 *   50   → 100
 *   0    → 0     (exactly zero stays zero)
 */
export function ceilToTenthML(volumeUL: Decimal): Decimal {
  const mL = volumeUL.dividedBy(1000)
  const roundedML = mL.toDecimalPlaces(1, Decimal.ROUND_CEIL)
  return roundedML.times(1000)
}

/**
 * Round volume DOWN to nearest 0.1 mL (floor at 0.1 mL precision).
 *
 * Asymmetric counterpart to ceilToTenthML — used for Old Beads / Old
 * Antibodies operator inputs per Smoke 3 D-07: typed value is
 * floor-rounded so the operator never claims more on-hand reagent than
 * they actually have. Calculator outputs continue to ceiling-round
 * (SMK3-06 / ceilToTenthML) so prep volume is sufficient.
 *
 * Unit contract: input and output BOTH in mL (NOT µL). This is intentionally
 * asymmetric with ceilToTenthML (µL → µL) to match the Old Beads / Old
 * Antibodies UI input domain (operator types mL values directly).
 *
 * Examples (mL → mL):
 *   1.51 → 1.5
 *   1.59 → 1.5
 *   1.50 → 1.5
 *   0.04 → 0.0
 *   0.00 → 0.0
 */
export function floorToTenthML(volumeML: Decimal | number): Decimal {
  const mL = volumeML instanceof Decimal ? volumeML : new Decimal(volumeML)
  return mL.toDecimalPlaces(1, Decimal.ROUND_FLOOR)
}

/**
 * Concentration operations
 */
export function createConcentration(value: number | string): Decimal {
  return new Decimal(value)
}

/**
 * C1V1 = C2V2 calculation
 * Given stock concentration (C1), final concentration (C2), and final volume (V2),
 * calculate the volume of stock needed (V1)
 */
export function calculateStockVolume(
  stockConc: Decimal,
  finalConc: Decimal,
  finalVolume: Decimal
): Decimal {
  // V1 = (C2 * V2) / C1
  return finalConc.times(finalVolume).dividedBy(stockConc)
}

/**
 * Calculate single analyte addition volume
 * For premix: addition volume = master mix volume / stock concentration
 */
export function calculateSingleAnalyteVolume(
  masterMixVolume: Decimal,
  stockConcentration: Decimal
): Decimal {
  return masterMixVolume.dividedBy(stockConcentration)
}
