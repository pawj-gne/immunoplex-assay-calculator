import { z } from 'zod'

export const operatorCreateSchema = z.object({
  name: z.string().min(1).max(100),
  active: z.boolean().optional()
})

export const operatorUpdateSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  active: z.boolean().optional()
})

export type OperatorCreateInput = z.infer<typeof operatorCreateSchema>
export type OperatorUpdateInput = z.infer<typeof operatorUpdateSchema>
