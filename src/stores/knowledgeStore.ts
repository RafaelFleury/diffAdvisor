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

const needsContent = (note: KnowledgeNote | null): note is KnowledgeNote =>
  note !== null && note.contentLoaded === false

export const useKnowledgeStore = create<KnowledgeState>((set, get) => {
  /** Fetches a note whose content was left out of the listing and caches it. */
  const loadFullNote = async (noteId: string) => {
    try {
      const full = await knowledgeService.getNote(noteId)
      if (!full) return
      const replace = (list: KnowledgeNote[]) => list.map((n) => (n.id === full.id ? full : n))
      set((state) => ({
        notes: replace(state.notes),
        filteredNotes: replace(state.filteredNotes),
        currentNote: state.currentNote?.id === full.id ? full : state.currentNote,
      }))
    } catch (e) {
      set({ error: (e as Error).message })
    }
  }

  return {
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
        if (needsContent(nextCurrentNote)) await loadFullNote(nextCurrentNote.id)
      } catch (e) {
        set({ error: (e as Error).message, loading: false })
      }
    },

    selectNote: async (noteId) => {
      const note = get().notes.find((n) => n.id === noteId) ?? null
      if (note) {
        set({ currentNote: note })
        if (needsContent(note)) await loadFullNote(note.id)
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
        // Results for an older query can arrive after newer ones while typing.
        if (get().searchQuery === query) set({ filteredNotes })
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
  }
})
