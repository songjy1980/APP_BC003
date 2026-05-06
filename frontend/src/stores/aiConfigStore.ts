import { create } from 'zustand'
import type { AIConfigItem } from '../types'
import api from '../api/client'

interface AIConfigStore {
  config: AIConfigItem | null
  models: string[]
  testResult: { success: boolean; response_time_ms?: number; error?: string } | null
  loading: boolean

  fetchConfig: () => Promise<void>
  updateConfig: (data: Partial<AIConfigItem>) => Promise<void>
  fetchModels: () => Promise<void>
  testConnection: () => Promise<void>
}

export const useAIConfigStore = create<AIConfigStore>((set) => ({
  config: null,
  models: [],
  testResult: null,
  loading: false,

  fetchConfig: async () => {
    set({ loading: true })
    try {
      const res = await api.get('/ai/config')
      set({ config: res.data, loading: false })
    } catch {
      set({ loading: false })
    }
  },

  updateConfig: async (data) => {
    set({ loading: true })
    try {
      const res = await api.put('/ai/config', data)
      set({ config: res.data, loading: false })
    } catch {
      set({ loading: false })
    }
  },

  fetchModels: async () => {
    try {
      const res = await api.get('/ai/models')
      set({ models: res.data.models || [] })
    } catch {
      set({ models: [] })
    }
  },

  testConnection: async () => {
    set({ loading: true })
    try {
      const res = await api.post('/ai/test')
      set({ testResult: res.data, loading: false })
    } catch (e: unknown) {
      set({ testResult: { success: false, error: (e as Error).message }, loading: false })
    }
  },
}))
