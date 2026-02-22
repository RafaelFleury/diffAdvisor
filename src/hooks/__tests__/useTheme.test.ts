import { describe, it, expect, beforeEach } from 'vitest'
import { useThemeStore } from '@/stores/themeStore.ts'

describe('useTheme (via themeStore)', () => {
  beforeEach(() => {
    useThemeStore.setState({ theme: 'dark' })
  })

  it('returns current theme', () => {
    expect(useThemeStore.getState().theme).toBe('dark')
  })

  it('toggles between light and dark', () => {
    useThemeStore.getState().toggleTheme()
    expect(useThemeStore.getState().theme).toBe('light')
    useThemeStore.getState().toggleTheme()
    expect(useThemeStore.getState().theme).toBe('dark')
  })

  it('sets theme directly', () => {
    useThemeStore.getState().setTheme('light')
    expect(useThemeStore.getState().theme).toBe('light')
    useThemeStore.getState().setTheme('dark')
    expect(useThemeStore.getState().theme).toBe('dark')
  })
})
