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
    // Smoke 3 SMK3-05: optional with default 1 — pre-Smoke-3 saved runs lack
    // this field; the schema fills it in so the renderer round-trips legacy
    // runs with the v1.0 single-setup default.
    numberOfSetups: z.number().int().min(1).default(1),
    // Smoke 3 SMK3-02/03 (D-04, D-08): optional with default 0 — pre-Phase-14
    // saved runs lack these fields; the schema defaults absent values to 0
    // (the no-op case — equivalent to v1.0 behavior). Raw mL value stored
    // per D-08 (author intent); calculator floor-rounds at consumption.
    // Non-negative finite at the store layer; the 20%-cap is a UI concern
    // (Plan 14-06 confirm-once modal).
    oldBeads: z.number().nonnegative().default(0),
    oldAntibodies: z.number().nonnegative().default(0),
    // Phase 15 SMK3-12/15/16/17 — all optional + nullable; defaults preserve
    // pre-Phase-15 round-trip semantics (no field present → null/false).
    sapeName: z.string().nullable().optional(),
    sapeConcentration: z.number().nullable().optional(),
    beadsDiluent: z.string().nullable().optional(),
    antibodiesDiluent: z.string().nullable().optional(),
    beadsVolumePerWell: z.number().nullable().optional(),
    antibodiesVolumePerWell: z.number().nullable().optional(),
    premixConcentration: z.number().nullable().optional(),
    oldBeadsOverride: z.boolean().optional().default(false),
    oldAntibodiesOverride: z.boolean().optional().default(false),
    calculationRulesVersion: z.string().nullable().optional(),
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
