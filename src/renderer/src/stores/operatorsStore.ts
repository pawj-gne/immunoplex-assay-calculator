import { create } from 'zustand'
import type { Operator } from '../../../shared/types/operator'

interface OperatorsState {
  // State
  operators: Operator[]
  includeInactive: boolean
  isLoading: boolean
  error: string | null

  // Actions
  loadOperators: (opts?: { includeInactive?: boolean }) => Promise<void>
  createOperator: (name: string) => Promise<Operator | null>
  renameOperator: (id: string, name: string) => Promise<Operator | null>
  setOperatorActive: (id: string, active: boolean) => Promise<Operator | null>
  softDeleteOperator: (id: string) => Promise<void>
}

export const useOperatorsStore = create<OperatorsState>((set, get) => ({
  operators: [],
  includeInactive: false,
  isLoading: false,
  error: null,

  loadOperators: async (opts) => {
    const includeInactive = opts?.includeInactive ?? false
    set({ isLoading: true, error: null, includeInactive })
    try {
      const operators = await window.electronAPI.operator.getAll({ includeInactive })
      set({ operators, isLoading: false })
    } catch (e) {
      set({ isLoading: false, error: (e as Error).message })
    }
  },

  createOperator: async (name) => {
    set({ error: null })
    try {
      const op = await window.electronAPI.operator.create({ name })
      await get().loadOperators({ includeInactive: get().includeInactive })
      return op
    } catch (e) {
      set({ error: (e as Error).message })
      return null
    }
  },

  renameOperator: async (id, name) => {
    set({ error: null })
    try {
      const op = await window.electronAPI.operator.update(id, { name })
      await get().loadOperators({ includeInactive: get().includeInactive })
      return op
    } catch (e) {
      set({ error: (e as Error).message })
      return null
    }
  },

  setOperatorActive: async (id, active) => {
    set({ error: null })
    try {
      const op = await window.electronAPI.operator.update(id, { active })
      await get().loadOperators({ includeInactive: get().includeInactive })
      return op
    } catch (e) {
      set({ error: (e as Error).message })
      return null
    }
  },

  softDeleteOperator: async (id) => {
    set({ error: null })
    try {
      await window.electronAPI.operator.delete(id)
      await get().loadOperators({ includeInactive: get().includeInactive })
    } catch (e) {
      set({ error: (e as Error).message })
    }
  }
}))
