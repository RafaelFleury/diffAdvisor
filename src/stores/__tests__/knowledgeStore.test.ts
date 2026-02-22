import { describe, it, expect, beforeEach } from 'vitest'
import { useKnowledgeStore } from '../knowledgeStore.ts'

describe('knowledgeStore', () => {
  beforeEach(() => {
    useKnowledgeStore.setState({
      notes: [],
      currentNote: null,
      searchQuery: '',
      filteredNotes: [],
      loading: false,
      error: null,
    })
  })

  it('has correct initial state', () => {
    const state = useKnowledgeStore.getState()
    expect(state.notes).toEqual([])
    expect(state.currentNote).toBeNull()
    expect(state.searchQuery).toBe('')
    expect(state.loading).toBe(false)
  })

  it('loads notes', async () => {
    await useKnowledgeStore.getState().loadNotes()
    const state = useKnowledgeStore.getState()
    expect(state.notes.length).toBeGreaterThan(0)
    expect(state.filteredNotes.length).toBeGreaterThan(0)
    expect(state.loading).toBe(false)
  })

  it('auto-selects first note on load', async () => {
    await useKnowledgeStore.getState().loadNotes()
    expect(useKnowledgeStore.getState().currentNote).not.toBeNull()
  })

  it('selects a note by id', async () => {
    await useKnowledgeStore.getState().loadNotes()
    await useKnowledgeStore.getState().selectNote('note-2')
    expect(useKnowledgeStore.getState().currentNote?.id).toBe('note-2')
  })

  it('filters notes via search', async () => {
    await useKnowledgeStore.getState().loadNotes()
    await useKnowledgeStore.getState().setSearchQuery('security')
    const state = useKnowledgeStore.getState()
    expect(state.searchQuery).toBe('security')
    expect(state.filteredNotes.length).toBeGreaterThan(0)
    expect(state.filteredNotes.length).toBeLessThanOrEqual(state.notes.length)
  })

  it('saves a new note', async () => {
    await useKnowledgeStore.getState().loadNotes()
    const before = useKnowledgeStore.getState().notes.length
    await useKnowledgeStore.getState().saveNote({
      title: 'Test Note',
      content: '# Test\nContent here.',
      categoryPath: 'test',
    })
    const after = useKnowledgeStore.getState().notes.length
    expect(after).toBe(before + 1)
    expect(useKnowledgeStore.getState().currentNote?.title).toBe('Test Note')
  })
})
