import { z } from 'zod'

/**
 * Replicate mode validation
 */
export const replicateModeSchema = z.enum(['singles', 'duplicates'])

/**
 * Request type validation
 */
export const requestTypeSchema = z.enum(['premix', 'premix_singles', 'custom'])

/**
 * Single analyte validation
 */
export const singleAnalyteSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  stockConcentration: z.number().positive()
})

/**
 * Calculator inputs validation
 */
export const calculatorInputsSchema = z.object({
  sampleCount: z.number().int().positive(),
  replicateMode: replicateModeSchema,
  plateCount: z.number().int().positive().max(10),
  requestType: requestTypeSchema,
  volumePerWell: z.number().positive().default(25),
  deadVolume: z.number().nonnegative().default(500)
})

/**
 * Add single request validation
 */
export const addSingleRequestSchema = z.object({
  analyte: singleAnalyteSchema,
  requestType: requestTypeSchema,
  currentSinglesCount: z.number().int().nonnegative()
})

/**
 * Validate adding a single analyte
 * Returns error message if invalid, null if valid
 */
export function validateAddSingle(
  requestType: z.infer<typeof requestTypeSchema>,
  currentSinglesCount: number
): string | null {
  if (requestType === 'premix') {
    return 'Cannot add singles to premix-only request'
  }

  if (requestType === 'premix_singles' && currentSinglesCount >= 5) {
    return 'Maximum 5 singles allowed for premix + singles mode'
  }

  // Custom mode has no limit
  return null
}

export type ReplicateModeValidated = z.infer<typeof replicateModeSchema>
export type RequestTypeValidated = z.infer<typeof requestTypeSchema>
export type SingleAnalyteValidated = z.infer<typeof singleAnalyteSchema>
export type CalculatorInputsValidated = z.infer<typeof calculatorInputsSchema>
