import { create } from 'zustand'
import type { AppSettings, Skill } from '@/types/index.ts'
import { settingsService } from '@/services/index.ts'

interface SettingsState {
  settings: AppSettings | null
  skills: Skill[]
  loading: boolean
  error: string | null
  connectionTestResult: { success: boolean; message: string } | null
  loadSettings: () => Promise<void>
  updateSettings: (partial: Partial<AppSettings>) => Promise<void>
  loadSkills: () => Promise<void>
  toggleSkill: (skillId: string, enabled: boolean) => Promise<void>
  testConnection: () => Promise<void>
}

export const useSettingsStore = create<SettingsState>((set) => ({
  settings: null,
  skills: [],
  loading: false,
  error: null,
  connectionTestResult: null,

  loadSettings: async () => {
    set({ loading: true, error: null })
    try {
      const settings = await settingsService.getSettings()
      set({ settings, loading: false })
    } catch (e) {
      set({ error: (e as Error).message, loading: false })
    }
  },

  updateSettings: async (partial) => {
    try {
      const settings = await settingsService.updateSettings(partial)
      set({ settings })
    } catch (e) {
      set({ error: (e as Error).message })
    }
  },

  loadSkills: async () => {
    try {
      const skills = await settingsService.getSkills()
      set({ skills })
    } catch (e) {
      set({ error: (e as Error).message })
    }
  },

  toggleSkill: async (skillId, enabled) => {
    try {
      await settingsService.toggleSkill(skillId, enabled)
      const skills = await settingsService.getSkills()
      set({ skills })
    } catch (e) {
      set({ error: (e as Error).message })
    }
  },

  testConnection: async () => {
    set({ connectionTestResult: null })
    try {
      const result = await settingsService.testConnection()
      set({ connectionTestResult: result })
    } catch (e) {
      set({ connectionTestResult: { success: false, message: (e as Error).message } })
    }
  },
}))
