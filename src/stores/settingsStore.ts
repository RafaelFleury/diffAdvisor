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
  addSkill: (skill: Omit<Skill, 'id' | 'autoDetected' | 'builtIn'>) => Promise<void>
  testConnection: () => Promise<void>
}

let latestUpdateId = 0

function mergeSettings(current: AppSettings, partial: Partial<AppSettings>): AppSettings {
  return {
    project: { ...current.project, ...partial.project },
    ai: { ...current.ai, ...partial.ai },
    analysis: { ...current.analysis, ...partial.analysis },
    knowledge: { ...current.knowledge, ...partial.knowledge },
    appearance: { ...current.appearance, ...partial.appearance },
  }
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
    // Apply immediately so inputs stay responsive, and ignore responses from
    // superseded requests: they can resolve out of order and would revert
    // characters the user has typed since.
    const requestId = ++latestUpdateId
    set((state) => ({ settings: state.settings && mergeSettings(state.settings, partial) }))
    try {
      const settings = await settingsService.updateSettings(partial)
      if (requestId === latestUpdateId) set({ settings })
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

  addSkill: async (skill) => {
    try {
      await settingsService.addSkill(skill)
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
