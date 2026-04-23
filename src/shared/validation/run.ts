import { z } from 'zod'

export const SAMPLE_TYPE_ENUM = z.enum(['Supernatant', 'Lysate', 'Lavage', 'Plasma', 'Serum'])

const WELL_ID_RE = /^[A-H](?:[1-9]|1[0-2])$/
const PLATE_KEY_RE = /^\d+$/

export const runCreateSchema = z
  .object({
    requestNumber: z.number().int().min(1).max(99999).nullable(),
    requestOverrideAdHoc: z.boolean(),
    userName: z.string().min(1),
    operatorId: z.string().min(1),
    runDate: z.string().min(1),
    sampleType: SAMPLE_TYPE_ENUM,
    dilutionFactor: z.number().positive(),
    sampleCount: z.number().int().positive(),
    replicateMode: z.enum(['singles', 'duplicates']),
    requestType: z.enum(['premix', 'premix_singles', 'custom']),
    platformId: z.string().min(1),
    speciesId: z.string().min(1),
    panelId: z.string().min(1).nullable(),
    volumePerWell: z.number().positive(),
    deadVolume: z.number().nonnegative(),
    hamilton: z.number().int().min(1).max(5),
    runPlatePosition: z.number().int().min(1).max(4),
    standardPosition: z.number().int().min(1).max(2),
    troughPosition: z.number().int().min(1).max(2),
    comments: z.string().nullable(),
    plex: z.number().int().nonnegative(),
    plateCount: z.number().int().positive(),
    plates: z.record(z.string().regex(PLATE_KEY_RE), z.array(z.string().regex(WELL_ID_RE))),
    singleAnalyteIds: z.array(z.string().min(1))
  })
  .superRefine((data, ctx) => {
    // requestNumber must be non-null unless requestOverrideAdHoc is true
    if (!data.requestOverrideAdHoc && data.requestNumber === null) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['requestNumber'],
        message: 'requestNumber is required unless requestOverrideAdHoc is true'
      })
    }
    if (data.requestOverrideAdHoc && data.requestNumber !== null) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['requestNumber'],
        message: 'requestNumber must be null when requestOverrideAdHoc is true'
      })
    }
    // Max 5 singles under premix_singles mode (consistent with calculatorStore enforcement)
    if (data.requestType === 'premix_singles' && data.singleAnalyteIds.length > 5) {
      ctx.addIssue({
        code: z.ZodIssueCode.too_big,
        path: ['singleAnalyteIds'],
        maximum: 5,
        type: 'array',
        inclusive: true,
        message: 'singleAnalyteIds cannot exceed 5 when requestType is premix_singles'
      })
    }
  })

// ISSUE 3: Update schema = Create schema. The type, schema, IPC handler, and preload signature
// all agree that RunUpdate === RunCreate shape. requestType/platformId/speciesId are immutable
// but still accepted in the payload — the repository update() method ignores them in its set() call.
export const runUpdateSchema = runCreateSchema

export type RunCreateInput = z.infer<typeof runCreateSchema>
export type RunUpdateInput = z.infer<typeof runUpdateSchema>
