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
 * Round volume up to nearest mL (for reagent prep)
 */
export function roundUpToNearestML(volumeUL: Decimal): Decimal {
  const mL = volumeUL.dividedBy(1000)
  const roundedML = mL.ceil()
  return roundedML.times(1000)
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
