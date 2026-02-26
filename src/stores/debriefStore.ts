import { create } from 'zustand'
import type { Commit, DebriefResult, FileDiff, Evaluation } from '@/types/index.ts'
import { debriefService, checkpointService } from '@/services/index.ts'

let debriefLoadQueue: Promise<void> = Promise.resolve()
let activeDebriefLoad: { commitHash: string; promise: Promise<void> } | null = null

const RAW_DEBRIEF_RESPONSE_START = '__RAW_DEBRIEF_RESPONSE_START__'
const RAW_DEBRIEF_RESPONSE_END = '__RAW_DEBRIEF_RESPONSE_END__'
const RAW_DEBRIEF_REPAIR_RESPONSE_START = '__RAW_DEBRIEF_REPAIR_RESPONSE_START__'
const RAW_DEBRIEF_REPAIR_RESPONSE_END = '__RAW_DEBRIEF_REPAIR_RESPONSE_END__'

const extractMarkedSection = (input: string, startMarker: string, endMarker: string): string | null => {
  const startIdx = input.indexOf(startMarker)
  if (startIdx === -1) return null

  const contentStartIdx = startIdx + startMarker.length
  const endIdx = input.indexOf(endMarker, contentStartIdx)
  if (endIdx === -1) return null

  return input.slice(contentStartIdx, endIdx).trim()
}

const stripMarkedSection = (input: string, startMarker: string, endMarker: string): string => {
  const startIdx = input.indexOf(startMarker)
  if (startIdx === -1) return input

  const endIdx = input.indexOf(endMarker, startIdx + startMarker.length)
  if (endIdx === -1) return input

  return `${input.slice(0, startIdx)}${input.slice(endIdx + endMarker.length)}`.trim()
}

const parseDebriefFailureMessage = (message: string): { cleanMessage: string; rawDebriefText: string | null } => {
  const primaryRaw = extractMarkedSection(message, RAW_DEBRIEF_RESPONSE_START, RAW_DEBRIEF_RESPONSE_END)
  const repairRaw = extractMarkedSection(
    message,
    RAW_DEBRIEF_REPAIR_RESPONSE_START,
    RAW_DEBRIEF_REPAIR_RESPONSE_END
  )

  let stripped = stripMarkedSection(message, RAW_DEBRIEF_RESPONSE_START, RAW_DEBRIEF_RESPONSE_END)
  stripped = stripMarkedSection(
    stripped,
    RAW_DEBRIEF_REPAIR_RESPONSE_START,
    RAW_DEBRIEF_REPAIR_RESPONSE_END
  ).trim()

  const rawBlocks = [primaryRaw, repairRaw].filter((block): block is string => !!block)
  if (rawBlocks.length === 0) {
    return { cleanMessage: message, rawDebriefText: null }
  }

  const rawDebriefText = rawBlocks.length === 1
    ? rawBlocks[0]
    : `Primary model response:\n${rawBlocks[0]}\n\nRepair pass response:\n${rawBlocks[1]}`

  return {
    cleanMessage: stripped || 'AI response parse failed',
    rawDebriefText,
  }
}

interface DebriefState {
  pendingCommits: Commit[]
  reviewedCommits: Commit[]
  currentDebrief: DebriefResult | null
  diffFiles: FileDiff[]
  gapCount: number
  loading: boolean
  debriefLoading: boolean
  error: string | null
  rawDebriefText: string | null
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
  rawDebriefText: null,
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
    if (activeDebriefLoad?.commitHash === commitHash) {
      console.info('[debrief] load deduped (already in progress)', { commitHash })
      return activeDebriefLoad.promise
    }

    const runLoad = async () => {
      const flowStart = performance.now()
      console.info('[debrief] load start', { commitHash })
      set({
        currentDebrief: null,
        diffFiles: [],
        debriefLoading: true,
        error: null,
        rawDebriefText: null,
        answers: {},
      })

      const debriefRequestStart = performance.now()
      console.info('[debrief] requesting debrief analysis', { commitHash })
      const debriefPromise = debriefService.runDebrief(commitHash).then((debrief) => {
        console.info('[debrief] debrief response received', {
          commitHash,
          debriefId: debrief.id,
          status: debrief.status,
          elapsedMs: Math.round(performance.now() - debriefRequestStart),
        })
        set({ currentDebrief: debrief })
        return debrief
      })

      const diffRequestStart = performance.now()
      console.info('[debrief] requesting commit diff files', { commitHash })
      const diffPromise = debriefService.getDiffContent(commitHash).then((files) => {
        console.info('[debrief] commit diff files received', {
          commitHash,
          fileCount: files.length,
          elapsedMs: Math.round(performance.now() - diffRequestStart),
        })
        set({ diffFiles: files })
        return files
      })

      const [debriefResult, diffResult] = await Promise.allSettled([debriefPromise, diffPromise])

      const getErrorMessage = (reason: unknown) =>
        reason instanceof Error ? reason.message : String(reason)

      const nextState: Partial<DebriefState> = { debriefLoading: false, error: null }
      const errors: string[] = []

      if (debriefResult.status === 'fulfilled') {
        nextState.currentDebrief = debriefResult.value
        nextState.rawDebriefText = null
      } else {
        const message = getErrorMessage(debriefResult.reason)
        const parsed = parseDebriefFailureMessage(message)
        if (parsed.rawDebriefText) {
          nextState.rawDebriefText = parsed.rawDebriefText
          errors.push(`Debrief failed: ${parsed.cleanMessage}`)
        } else {
          errors.push(`Debrief failed: ${message}`)
        }
      }

      if (diffResult.status === 'fulfilled') {
        nextState.diffFiles = diffResult.value
      } else {
        const message = getErrorMessage(diffResult.reason)
        errors.push(`Diff failed: ${message}`)
      }

      if (errors.length > 0) {
        const errorMessage = errors.join(' | ')
        nextState.error = errorMessage
        console.error('[debrief] load completed with errors', {
          commitHash,
          elapsedMs: Math.round(performance.now() - flowStart),
          errors,
        })
      } else {
        console.info('[debrief] load completed', {
          commitHash,
          debriefId: nextState.currentDebrief?.id,
          diffFiles: nextState.diffFiles?.length ?? 0,
          totalElapsedMs: Math.round(performance.now() - flowStart),
        })
      }

      set(nextState)
    }

    const queuedLoad = debriefLoadQueue
      .catch(() => undefined)
      .then(runLoad)

    debriefLoadQueue = queuedLoad
    activeDebriefLoad = { commitHash, promise: queuedLoad }

    return queuedLoad.finally(() => {
      if (activeDebriefLoad?.promise === queuedLoad) {
        activeDebriefLoad = null
      }
    })
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

  clearDebrief: () => set({ currentDebrief: null, diffFiles: [], rawDebriefText: null, answers: {} }),
}))
