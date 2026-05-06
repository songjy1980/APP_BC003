import { create } from 'zustand'
import type { RuleItem } from '../types'
import api from '../api/client'

interface RuleStore {
  rules: RuleItem[]
  loading: boolean
  error: string | null

  fetchRules: (scope?: string, enabled?: boolean) => Promise<void>
  createRule: (data: Partial<RuleItem>) => Promise<void>
  updateRule: (id: number, data: Partial<RuleItem>) => Promise<void>
  deleteRule: (id: number) => Promise<void>
}

export const useRuleStore = create<RuleStore>((set, get) => ({
  rules: [],
  loading: false,
  error: null,

  fetchRules: async (scope, enabled) => {
    set({ loading: true })
    try {
      const params: Record<string, unknown> = {}
      if (scope) params.scope = scope
      if (enabled !== undefined) params.enabled = enabled
      const res = await api.get('/rules', { params })
      set({ rules: res.data, loading: false })
    } catch (e: unknown) {
      set({ error: (e as Error).message, loading: false })
    }
  },

  createRule: async (data) => {
    set({ loading: true })
    try {
      const res = await api.post('/rules', data)
      set((s) => ({ rules: [...s.rules, res.data], loading: false }))
    } catch (e: unknown) {
      set({ error: (e as Error).message, loading: false })
    }
  },

  updateRule: async (id, data) => {
    set({ loading: true })
    try {
      const res = await api.put(`/rules/${id}`, data)
      set((s) => ({
        rules: s.rules.map((r) => (r.id === id ? res.data : r)),
        loading: false,
      }))
    } catch (e: unknown) {
      set({ error: (e as Error).message, loading: false })
    }
  },

  deleteRule: async (id) => {
    try {
      await api.delete(`/rules/${id}`)
      set((s) => ({ rules: s.rules.filter((r) => r.id !== id) }))
    } catch (e: unknown) {
      set({ error: (e as Error).message })
    }
  },
}))
