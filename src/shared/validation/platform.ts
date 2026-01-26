import { z } from 'zod'

export const platformCreateSchema = z.object({
  name: z.string().min(1, 'Name is required').max(100),
  description: z.string().max(500).nullable().optional(),
  stockConcentration: z.number().positive('Stock concentration must be positive')
})

export const platformUpdateSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1).max(100).optional(),
  description: z.string().max(500).nullable().optional(),
  stockConcentration: z.number().positive().optional()
})

export type PlatformCreateInput = z.infer<typeof platformCreateSchema>
export type PlatformUpdateInput = z.infer<typeof platformUpdateSchema>
