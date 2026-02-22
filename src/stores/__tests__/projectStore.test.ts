import { describe, it, expect, beforeEach } from 'vitest'
import { useProjectStore } from '../projectStore.ts'

describe('projectStore', () => {
  beforeEach(() => {
    useProjectStore.setState({
      projects: [],
      activeProject: null,
      loading: false,
      error: null,
    })
  })

  it('has correct initial state', () => {
    const state = useProjectStore.getState()
    expect(state.projects).toEqual([])
    expect(state.activeProject).toBeNull()
    expect(state.loading).toBe(false)
    expect(state.error).toBeNull()
  })

  it('loads projects', async () => {
    await useProjectStore.getState().loadProjects()
    const state = useProjectStore.getState()
    expect(state.projects.length).toBeGreaterThan(0)
    expect(state.loading).toBe(false)
  })

  it('loads active project', async () => {
    await useProjectStore.getState().loadActiveProject()
    const state = useProjectStore.getState()
    expect(state.activeProject).not.toBeNull()
    expect(state.activeProject!.id).toBeTruthy()
    expect(state.loading).toBe(false)
  })
})
