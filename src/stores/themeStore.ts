import { create } from 'zustand'
import type { Theme } from '@/types/index.ts'

interface ThemeState {
  theme: Theme
  toggleTheme: () => void
  setTheme: (theme: Theme) => void
}

const getInitialTheme = (): Theme => {
  try {
    const stored = localStorage.getItem('diffadvisor-theme')
    if (stored === 'light' || stored === 'dark') return stored
  } catch {
    // localStorage not available
  }
  return 'dark'
}

export const useThemeStore = create<ThemeState>((set) => ({
  theme: getInitialTheme(),
  toggleTheme: () =>
    set((state) => {
      const next = state.theme === 'dark' ? 'light' : 'dark'
      localStorage.setItem('diffadvisor-theme', next)
      return { theme: next }
    }),
  setTheme: (theme) => {
    localStorage.setItem('diffadvisor-theme', theme)
    set({ theme })
  },
}))
