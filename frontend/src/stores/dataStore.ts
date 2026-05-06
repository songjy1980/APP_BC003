import { create } from 'zustand'
import type { DataSummary, CostGroupMapping, PaginatedRecords } from '../types'
import api from '../api/client'

interface DataStore {
  summary: DataSummary | null
  mappings: CostGroupMapping[]
  records: PaginatedRecords | null
  loading: boolean
  error: string | null

  fetchSummary: () => Promise<void>
  fetchMappings: () => Promise<void>
  fetchRecords: (params?: Record<string, unknown>) => Promise<void>
  uploadFile: (file: File) => Promise<{ batch_id: string; row_count: number }>
  updateMappings: (mappings: { cost_group_value: string; business_cost_category: string }[]) => Promise<void>
}

export const useDataStore = create<DataStore>((set, get) => ({
  summary: null,
  mappings: [],
  records: null,
  loading: false,
  error: null,

  fetchSummary: async () => {
    set({ loading: true, error: null })
    try {
      const res = await api.get('/data/summary')
      set({ summary: res.data, loading: false })
    } catch (e: unknown) {
      set({ error: (e as Error).message, loading: false })
    }
  },

  fetchMappings: async () => {
    try {
      const res = await api.get('/data/mappings')
      set({ mappings: res.data })
    } catch (e: unknown) {
      set({ error: (e as Error).message })
    }
  },

  fetchRecords: async (params = {}) => {
    set({ loading: true })
    try {
      const res = await api.get('/data/records', { params })
      set({ records: res.data, loading: false })
    } catch (e: unknown) {
      set({ error: (e as Error).message, loading: false })
    }
  },

  uploadFile: async (file: File) => {
    set({ loading: true, error: null })
    try {
      const form = new FormData()
      form.append('file', file)
      const res = await api.post('/data/upload', form)
      set({ loading: false })
      return res.data
    } catch (e: unknown) {
      set({ error: (e as Error).message, loading: false })
      throw e
    }
  },

  updateMappings: async (mappings) => {
    set({ loading: true })
    try {
      const res = await api.put('/data/mappings', mappings)
      set({ mappings: res.data, loading: false })
    } catch (e: unknown) {
      set({ error: (e as Error).message, loading: false })
    }
  },
}))
