import { create } from 'zustand'
import type { Commit, DebriefResult, FileDiff, Evaluation } from '@/types/index.ts'
import { debriefService, checkpointService } from '@/services/index.ts'

interface DebriefState {
  pendingCommits: Commit[]
  reviewedCommits: Commit[]
  currentDebrief: DebriefResult | null
  diffFiles: FileDiff[]
  gapCount: number
  loading: boolean
  debriefLoading: boolean
  error: string | null
  answers: Record<string, { text: string; evaluation: Evaluation | null }>
  loadCommits: (projectId: string) => Promise<void>
  loadDebrief: (commitHash: string) => Promise<void>
  loadGapCount: (projectId: string) => Promise<void>
  markReviewed: (debriefId: string) => Promise<void>
  submitAnswer: (debriefId: string, questionId: string, answer: string) => Promise<Evaluation>
  clearDebrief: () => void
}

export const useDebriefStore = create<DebriefState>((set, get) => ({
  pendingCommits: [],
  reviewedCommits: [],
  currentDebrief: null,
  diffFiles: [],
  gapCount: 0,
  loading: false,
  debriefLoading: false,
  error: null,
  answers: {},

  loadCommits: async (projectId) => {
    set({ loading: true, error: null })
    try {
      const [pending, reviewed] = await Promise.all([
        debriefService.getPendingCommits(projectId),
        debriefService.getReviewedCommits(projectId),
      ])
      set({ pendingCommits: pending, reviewedCommits: reviewed, loading: false })
    } catch (e) {
      set({ error: (e as Error).message, loading: false })
    }
  },

  loadDebrief: async (commitHash) => {
    set({ debriefLoading: true, error: null, answers: {} })
    try {
      const [debrief, files] = await Promise.all([
        debriefService.runDebrief(commitHash),
        debriefService.getDiffContent(commitHash),
      ])
      set({ currentDebrief: debrief, diffFiles: files, debriefLoading: false })
    } catch (e) {
      set({ error: (e as Error).message, debriefLoading: false })
    }
  },

  loadGapCount: async (projectId) => {
    try {
      const gapCount = await debriefService.getGapCount(projectId)
      set({ gapCount })
    } catch {
      // non-critical
    }
  },

  markReviewed: async (debriefId) => {
    try {
      await debriefService.markReviewed(debriefId)
      const { currentDebrief, pendingCommits, reviewedCommits } = get()
      if (currentDebrief && currentDebrief.id === debriefId) {
        const commit = pendingCommits.find((c) => c.hash === currentDebrief.commitHash)
        if (commit) {
          const updated = { ...commit, status: 'reviewed' as const }
          set({
            currentDebrief: { ...currentDebrief, status: 'reviewed' },
            pendingCommits: pendingCommits.filter((c) => c.hash !== commit.hash),
            reviewedCommits: [updated, ...reviewedCommits],
          })
        }
      }
    } catch (e) {
      set({ error: (e as Error).message })
    }
  },

  submitAnswer: async (debriefId, questionId, answer) => {
    const evaluation = await checkpointService.submitCheckpoint(debriefId, questionId, answer)
    set((state) => ({
      answers: {
        ...state.answers,
        [questionId]: { text: answer, evaluation },
      },
    }))
    return evaluation
  },

  clearDebrief: () => set({ currentDebrief: null, diffFiles: [], answers: {} }),
}))
