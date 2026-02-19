import { useThemeStore } from '@/stores/themeStore.ts'

export function useTheme() {
  const theme = useThemeStore((s) => s.theme)
  const toggleTheme = useThemeStore((s) => s.toggleTheme)
  const setTheme = useThemeStore((s) => s.setTheme)

  return { theme, toggleTheme, setTheme, isDark: theme === 'dark' }
}
