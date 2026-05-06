import { create } from 'zustand'
import type { CaseItem, CaseCreate, CaseCostItem, PlanItem, SSEEvent } from '../types'
import api from '../api/client'

interface CaseStore {
  cases: CaseItem[]
  currentCase: CaseItem | null
  currentPlans: PlanItem[]
  loading: boolean
  error: string | null
  sseMessages: string[]

  fetchCases: (status?: string) => Promise<void>
  fetchCase: (id: number) => Promise<void>
  createCase: (data: CaseCreate) => Promise<number>
  inferCosts: (id: number) => Promise<SSEEvent | null>
  reviewCosts: (id: number, reviews: { category: string; reviewed_value: number; override_reason?: string }[]) => Promise<void>
  generatePlans: (id: number) => Promise<SSEEvent | null>
  fetchPlans: (id: number) => Promise<void>
  deleteCase: (id: number) => Promise<void>
  clearMessages: () => void
}

export const useCaseStore = create<CaseStore>((set, get) => ({
  cases: [],
  currentCase: null,
  currentPlans: [],
  loading: false,
  error: null,
  sseMessages: [],

  fetchCases: async (status) => {
    set({ loading: true })
    try {
      const params = status ? { status } : {}
      const res = await api.get('/cases', { params })
      set({ cases: res.data, loading: false })
    } catch (e: unknown) {
      set({ error: (e as Error).message, loading: false })
    }
  },

  fetchCase: async (id) => {
    set({ loading: true })
    try {
      const res = await api.get(`/cases/${id}`)
      set({ currentCase: res.data, loading: false })
    } catch (e: unknown) {
      set({ error: (e as Error).message, loading: false })
    }
  },

  createCase: async (data) => {
    set({ loading: true })
    try {
      const res = await api.post('/cases', data)
      set({ loading: false })
      return res.data.case_id
    } catch (e: unknown) {
      set({ error: (e as Error).message, loading: false })
      throw e
    }
  },

  inferCosts: async (id) => {
    set({ sseMessages: [], loading: true, error: null })
    try {
      const response = await fetch(`/api/v1/cases/${id}/infer`, { method: 'POST' })
      if (!response.ok) throw new Error('SSE connection failed')
      const reader = response.body?.getReader()
      if (!reader) throw new Error('No reader')

      const decoder = new TextDecoder()
      let lastEvent: SSEEvent | null = null
      let buffer = ''

      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split('\n')
        buffer = lines.pop() || ''
        for (const line of lines) {
          if (line.startsWith('data: ')) {
            try {
              const event: SSEEvent = JSON.parse(line.slice(6))
              set((s) => ({ sseMessages: [...s.sseMessages, event.message || ''] }))
              lastEvent = event
            } catch { /* skip */ }
          }
        }
      }

      await get().fetchCase(id)
      set({ loading: false })
      return lastEvent
    } catch (e: unknown) {
      set({ error: (e as Error).message, loading: false })
      return null
    }
  },

  reviewCosts: async (id, reviews) => {
    set({ loading: true })
    try {
      await api.put(`/cases/${id}/costs`, reviews)
      await get().fetchCase(id)
      set({ loading: false })
    } catch (e: unknown) {
      set({ error: (e as Error).message, loading: false })
    }
  },

  generatePlans: async (id) => {
    set({ sseMessages: [], loading: true, error: null })
    try {
      const response = await fetch(`/api/v1/cases/${id}/plans`, { method: 'POST' })
      if (!response.ok) throw new Error('SSE connection failed')
      const reader = response.body?.getReader()
      if (!reader) throw new Error('No reader')

      const decoder = new TextDecoder()
      let lastEvent: SSEEvent | null = null
      let buffer = ''

      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split('\n')
        buffer = lines.pop() || ''
        for (const line of lines) {
          if (line.startsWith('data: ')) {
            try {
              const event: SSEEvent = JSON.parse(line.slice(6))
              set((s) => ({ sseMessages: [...s.sseMessages, event.message || ''] }))
              lastEvent = event
            } catch { /* skip */ }
          }
        }
      }

      set({ loading: false })
      return lastEvent
    } catch (e: unknown) {
      set({ error: (e as Error).message, loading: false })
      return null
    }
  },

  fetchPlans: async (id) => {
    try {
      const res = await api.get(`/cases/${id}/plans`)
      set({ currentPlans: res.data })
    } catch (e: unknown) {
      set({ error: (e as Error).message })
    }
  },

  deleteCase: async (id) => {
    try {
      await api.delete(`/cases/${id}`)
      set((s) => ({ cases: s.cases.filter((c) => c.id !== id) }))
    } catch (e: unknown) {
      set({ error: (e as Error).message })
    }
  },

  clearMessages: () => set({ sseMessages: [] }),
}))
