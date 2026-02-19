import { describe, it, expect, beforeEach } from 'vitest'
import { useDebriefStore } from '../debriefStore.ts'

describe('debriefStore', () => {
  beforeEach(() => {
    useDebriefStore.setState({
      pendingCommits: [],
      reviewedCommits: [],
      currentDebrief: null,
      diffContent: '',
      gapCount: 0,
      loading: false,
      debriefLoading: false,
      error: null,
      answers: {},
    })
  })

  it('has correct initial state', () => {
    const state = useDebriefStore.getState()
    expect(state.pendingCommits).toEqual([])
    expect(state.reviewedCommits).toEqual([])
    expect(state.currentDebrief).toBeNull()
    expect(state.loading).toBe(false)
    expect(state.error).toBeNull()
  })

  it('loads commits', async () => {
    await useDebriefStore.getState().loadCommits('proj-1')
    const state = useDebriefStore.getState()
    expect(state.pendingCommits.length).toBeGreaterThan(0)
    expect(state.reviewedCommits.length).toBeGreaterThan(0)
    expect(state.loading).toBe(false)
  })

  it('loads debrief for commit', async () => {
    await useDebriefStore.getState().loadDebrief('a3f7c2d')
    const state = useDebriefStore.getState()
    expect(state.currentDebrief).not.toBeNull()
    expect(state.currentDebrief!.commitHash).toBe('a3f7c2d')
    expect(state.diffContent).toBeTruthy()
    expect(state.debriefLoading).toBe(false)
  })

  it('loads gap count', async () => {
    await useDebriefStore.getState().loadGapCount('proj-1')
    expect(useDebriefStore.getState().gapCount).toBeGreaterThan(0)
  })

  it('clears debrief', async () => {
    await useDebriefStore.getState().loadDebrief('a3f7c2d')
    useDebriefStore.getState().clearDebrief()
    const state = useDebriefStore.getState()
    expect(state.currentDebrief).toBeNull()
    expect(state.diffContent).toBe('')
  })

  it('submits answer and stores it', async () => {
    await useDebriefStore.getState().loadDebrief('a3f7c2d')
    const evaluation = await useDebriefStore.getState().submitAnswer('debrief-1', 'q-1', 'My answer')
    expect(evaluation).toHaveProperty('score')
    expect(useDebriefStore.getState().answers['q-1']).toBeDefined()
    expect(useDebriefStore.getState().answers['q-1'].text).toBe('My answer')
  })
})
