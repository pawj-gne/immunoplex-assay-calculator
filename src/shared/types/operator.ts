import type { Operator as DbOperator } from '../../main/db/schema'

export type Operator = DbOperator

export interface OperatorCreate {
  name: string
  active?: boolean
}

export interface OperatorUpdate {
  name?: string
  active?: boolean
}
