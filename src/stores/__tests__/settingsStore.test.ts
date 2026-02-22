import { describe, it, expect, beforeEach } from 'vitest'
import { useSettingsStore } from '../settingsStore.ts'

describe('settingsStore', () => {
  beforeEach(() => {
    useSettingsStore.setState({
      settings: null,
      skills: [],
      loading: false,
      error: null,
      connectionTestResult: null,
    })
  })

  it('has correct initial state', () => {
    const state = useSettingsStore.getState()
    expect(state.settings).toBeNull()
    expect(state.skills).toEqual([])
    expect(state.loading).toBe(false)
    expect(state.connectionTestResult).toBeNull()
  })

  it('loads settings', async () => {
    await useSettingsStore.getState().loadSettings()
    const state = useSettingsStore.getState()
    expect(state.settings).not.toBeNull()
    expect(state.settings!.project).toBeDefined()
    expect(state.settings!.ai).toBeDefined()
    expect(state.settings!.analysis).toBeDefined()
    expect(state.loading).toBe(false)
  })

  it('loads skills', async () => {
    await useSettingsStore.getState().loadSkills()
    const state = useSettingsStore.getState()
    expect(state.skills.length).toBeGreaterThan(0)
    expect(state.skills[0]).toHaveProperty('id')
    expect(state.skills[0]).toHaveProperty('name')
  })

  it('toggles a skill', async () => {
    await useSettingsStore.getState().loadSkills()
    const skill = useSettingsStore.getState().skills.find((s) => s.enabled)!
    await useSettingsStore.getState().toggleSkill(skill.id, false)
    const updated = useSettingsStore.getState().skills.find((s) => s.id === skill.id)!
    expect(updated.enabled).toBe(false)
  })

  it('tests connection', async () => {
    await useSettingsStore.getState().testConnection()
    const result = useSettingsStore.getState().connectionTestResult
    expect(result).not.toBeNull()
    expect(result).toHaveProperty('success')
    expect(result).toHaveProperty('message')
  })
})
