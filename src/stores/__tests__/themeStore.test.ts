import { describe, it, expect, beforeEach } from 'vitest'
import { useThemeStore } from '../themeStore.ts'

describe('themeStore', () => {
  beforeEach(() => {
    localStorage.clear()
    useThemeStore.setState({ theme: 'dark' })
  })

  it('defaults to dark theme', () => {
    expect(useThemeStore.getState().theme).toBe('dark')
  })

  it('toggles between dark and light', () => {
    useThemeStore.getState().toggleTheme()
    expect(useThemeStore.getState().theme).toBe('light')

    useThemeStore.getState().toggleTheme()
    expect(useThemeStore.getState().theme).toBe('dark')
  })

  it('persists to localStorage', () => {
    useThemeStore.getState().setTheme('light')
    expect(localStorage.getItem('diffadvisor-theme')).toBe('light')
  })

  it('sets theme directly', () => {
    useThemeStore.getState().setTheme('light')
    expect(useThemeStore.getState().theme).toBe('light')
  })
})
