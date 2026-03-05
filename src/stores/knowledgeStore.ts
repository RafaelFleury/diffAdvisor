import { create } from 'zustand'
import type { KnowledgeNote } from '@/types/index.ts'
import { knowledgeService } from '@/services/index.ts'

interface KnowledgeState {
  notes: KnowledgeNote[]
  currentNote: KnowledgeNote | null
  searchQuery: string
  filteredNotes: KnowledgeNote[]
  loading: boolean
  error: string | null
  loadNotes: () => Promise<void>
  selectNote: (noteId: string) => Promise<void>
  setSearchQuery: (query: string) => Promise<void>
  saveNote: (note: Partial<KnowledgeNote> & { title: string; content: string; categoryPath: string }) => Promise<KnowledgeNote>
}

export const useKnowledgeStore = create<KnowledgeState>((set, get) => ({
  notes: [],
  currentNote: null,
  searchQuery: '',
  filteredNotes: [],
  loading: false,
  error: null,

  loadNotes: async () => {
    set({ loading: true, error: null })
    try {
      const notes = await knowledgeService.getNotes()
      const currentNote = get().currentNote
      const nextCurrentNote = currentNote
        ? notes.find((note) => note.id === currentNote.id) ?? notes[0] ?? null
        : notes.find((note) => note.id === 'note-1') ?? notes[0] ?? null
      set({ notes, filteredNotes: notes, currentNote: nextCurrentNote, loading: false })
    } catch (e) {
      set({ error: (e as Error).message, loading: false })
    }
  },

  selectNote: async (noteId) => {
    const note = get().notes.find((n) => n.id === noteId) ?? null
    if (note) {
      set({ currentNote: note })
    } else {
      try {
        const fetched = await knowledgeService.getNote(noteId)
        set({ currentNote: fetched })
      } catch (e) {
        set({ error: (e as Error).message })
      }
    }
  },

  setSearchQuery: async (query) => {
    set({ searchQuery: query })
    try {
      const filteredNotes = await knowledgeService.searchNotes(query)
      set({ filteredNotes })
    } catch (e) {
      set({ error: (e as Error).message })
    }
  },

  saveNote: async (note) => {
    try {
      const saved = await knowledgeService.saveNote(note)
      const notes = await knowledgeService.getNotes()
      set({ notes, filteredNotes: notes, currentNote: saved })
      return saved
    } catch (e) {
      set({ error: (e as Error).message })
      throw e
    }
  },
}))
