import { create } from 'zustand'
import type {
  CodeGraph,
  CodeGraphStatus,
  ExploreMode,
  GraphFunction,
  KeywordDoc,
  SourceFile,
  TermExplanation,
} from '@/types/codegraph.ts'
import { codeGraphService } from '@/services/codegraph/index.ts'
import { IS_MOCK_SERVICES } from '@/services/index.ts'
import { useProjectStore } from '@/stores/projectStore.ts'
import type { Offsets } from '@/components/features/codegraph/layout.ts'

// Intentionally not persisted: drag offsets, expanded cells and history are session-only
// (docs/plans/codegraph.md, decision 4).

const HISTORY_LIMIT = 30
const ANALYZE_DEBOUNCE_MS = 300
const DOC_LANGUAGE = 'typescript'
export const MIN_ZOOM = 0.4
export const MAX_ZOOM = 2

export type PanelTab = 'function' | 'file'

export interface SelectedTerm {
  text: string
  line: number
  /** The line's text, so a cached explanation is not reused after the line changes. */
  lineText: string
}

export type ExplainStatus = 'idle' | 'loading' | 'done' | 'error' | 'cancelled'

interface CodeGraphState {
  /** Project the session state below belongs to. */
  projectKey: string | null
  graph: CodeGraph | null
  status: CodeGraphStatus | null
  loading: boolean
  error: string | null

  mode: ExploreMode
  entry: string | null
  depth: number | null
  depthText: string
  maxNodes: number
  maxNodesText: string

  selectedId: string | null
  history: string[]
  panelTab: PanelTab
  fileTabId: string | null
  expanded: Record<string, boolean>
  offsets: Offsets
  zoom: number
  query: string
  showExternals: boolean

  sources: Record<string, SourceFile>
  term: SelectedTerm | null
  keywordDocs: Record<string, KeywordDoc | null>
  explanations: Record<string, TermExplanation>
  explainStatus: ExplainStatus
  explainError: string | null
  explainOpen: boolean

  loadStatus: () => Promise<void>
  analyze: () => Promise<void>
  requestAnalyze: () => void
  setMode: (mode: ExploreMode) => void
  setEntry: (entry: string) => void
  setDepthText: (text: string) => void
  applyRecommendedDepth: () => void
  setMaxNodesText: (text: string) => void
  select: (fnId: string) => void
  back: () => void
  openFile: (fileId: string) => void
  setPanelTab: (tab: PanelTab) => void
  toggleExpanded: (fnId: string) => void
  setOffset: (fileId: string, dx: number, dy: number) => void
  resetOffsets: () => void
  setZoom: (zoom: number) => void
  setQuery: (query: string) => void
  toggleExternals: () => void
  loadSource: (fileId: string) => Promise<void>
  selectTerm: (term: SelectedTerm) => void
  toggleExplain: () => void
  cancelExplain: () => void
  retryExplain: () => void
}

let analyzeTimer: ReturnType<typeof setTimeout> | null = null
let analyzeRequest = 0

const MOCK_PROJECT_ID = 'mock'

/** The active project's id, the sample project's id with mocks, or null when there is none. */
function projectId(): string | null {
  return useProjectStore.getState().activeProject?.id ?? (IS_MOCK_SERVICES ? MOCK_PROJECT_ID : null)
}

/** Tauri commands reject with a plain string; services and mocks throw Error. */
function errorMessage(e: unknown): string {
  if (e instanceof Error) return e.message
  if (typeof e === 'string') return e
  return String(e)
}

/** Session state that belongs to one project and is dropped when the project changes. */
const PROJECT_SESSION = {
  graph: null,
  error: null,
  entry: null,
  depth: null,
  depthText: '',
  selectedId: null,
  history: [],
  panelTab: 'function',
  fileTabId: null,
  expanded: {},
  offsets: {},
  query: '',
  sources: {},
  term: null,
  explanations: {},
  explainStatus: 'idle',
  explainError: null,
  explainOpen: false,
} satisfies Partial<CodeGraphState>

function fnById(graph: CodeGraph | null, id: string | null): GraphFunction | undefined {
  if (!graph || !id) return undefined
  return graph.functions.find((f) => f.id === id)
}

export function explanationKey(fnId: string, term: SelectedTerm): string {
  return `${fnId}|${term.text}|${term.line}|${term.lineText}`
}

/** Distance that brings a ghost function into scope in the current mode. */
function scopeDistance(graph: CodeGraph, fn: GraphFunction): number | null {
  if (graph.mode === 'function') return fn.distance
  return graph.files.find((f) => f.id === fn.fileId)?.level ?? null
}

export const useCodeGraphStore = create<CodeGraphState>((set, get) => ({
  projectKey: null,
  graph: null,
  status: null,
  loading: false,
  error: null,

  mode: 'file',
  entry: null,
  depth: null,
  depthText: '',
  maxNodes: 200,
  maxNodesText: '200',

  selectedId: null,
  history: [],
  panelTab: 'function',
  fileTabId: null,
  expanded: {},
  offsets: {},
  zoom: 1,
  query: '',
  showExternals: true,

  sources: {},
  term: null,
  keywordDocs: {},
  explanations: {},
  explainStatus: 'idle',
  explainError: null,
  explainOpen: false,

  loadStatus: async () => {
    try {
      const status = await codeGraphService.getStatus()
      set({ status })
    } catch (e) {
      set({ error: errorMessage(e) })
    }
  },

  analyze: async () => {
    if (analyzeTimer) {
      clearTimeout(analyzeTimer)
      analyzeTimer = null
    }
    const pid = projectId()
    if (!pid) return
    const previous = get().projectKey
    if (previous && previous !== pid) set({ ...PROJECT_SESSION, projectKey: pid })
    else if (!previous) set({ projectKey: pid })
    const { mode, entry, depth, maxNodes } = get()
    const request = ++analyzeRequest
    set({ loading: true, error: null })
    try {
      const graph = await codeGraphService.analyze(pid, { mode, entry, depth, maxNodes })
      if (request !== analyzeRequest) return
      const state = get()

      // Keep session state only for ids that still exist (decision 4).
      const fileIds = new Set(graph.files.map((f) => f.id))
      const fnIds = new Set(graph.functions.map((f) => f.id))
      const offsets: Offsets = {}
      for (const [id, o] of Object.entries(state.offsets)) if (fileIds.has(id)) offsets[id] = o
      const expanded: Record<string, boolean> = {}
      for (const [id, v] of Object.entries(state.expanded)) if (v && fnIds.has(id)) expanded[id] = true

      let selectedId = state.selectedId && fnIds.has(state.selectedId) ? state.selectedId : null
      if (!selectedId) {
        const entryFn =
          graph.mode === 'function'
            ? graph.functions.find((f) => f.id === graph.entry)
            : graph.functions
                .filter((f) => f.fileId === graph.entry && f.kind !== 'callback')
                .sort((a, b) => a.startLine - b.startLine)[0]
        selectedId = entryFn?.id ?? graph.functions.find((f) => f.kind !== 'callback')?.id ?? null
      }
      const selected = fnById(graph, selectedId)

      set({
        graph,
        loading: false,
        entry: graph.entry,
        depth: graph.depth,
        depthText: String(graph.depth),
        offsets,
        expanded,
        selectedId,
        fileTabId: state.fileTabId && fileIds.has(state.fileTabId) ? state.fileTabId : (selected?.fileId ?? null),
        history: state.history.filter((id) => fnIds.has(id)),
      })
      const fileToLoad = get().fileTabId
      if (fileToLoad) void get().loadSource(fileToLoad)
    } catch (e) {
      if (request !== analyzeRequest) return
      set({ loading: false, error: errorMessage(e) })
    }
  },

  requestAnalyze: () => {
    if (analyzeTimer) clearTimeout(analyzeTimer)
    analyzeTimer = setTimeout(() => {
      analyzeTimer = null
      void get().analyze()
    }, ANALYZE_DEBOUNCE_MS)
  },

  setMode: (mode) => {
    if (mode === get().mode) return
    const selected = get().selectedId
    // Function mode starts from the selected function; File mode from the default entry.
    set({ mode, entry: mode === 'function' ? selected : null, depth: null, depthText: '' })
    void get().analyze()
  },

  setEntry: (entry) => {
    set({ entry, depth: null, depthText: '' })
    if (get().mode === 'function') set({ selectedId: entry })
    void get().analyze()
  },

  setDepthText: (text) => {
    set({ depthText: text })
    const v = parseInt(text, 10)
    if (Number.isNaN(v)) return
    set({ depth: Math.max(1, Math.min(10, v)) })
    get().requestAnalyze()
  },

  applyRecommendedDepth: () => {
    const rec = get().graph?.recommendedDepth
    if (!rec) return
    set({ depth: rec, depthText: String(rec) })
    void get().analyze()
  },

  setMaxNodesText: (text) => {
    set({ maxNodesText: text })
    const v = parseInt(text, 10)
    if (Number.isNaN(v) || v < 10) return
    set({ maxNodes: Math.min(2000, v) })
    get().requestAnalyze()
  },

  select: (fnId) => {
    const { graph, selectedId, history } = get()
    const fn = fnById(graph, fnId)
    if (!graph || !fn) return
    const target = fn.parentId ? (fnById(graph, fn.parentId) ?? fn) : fn
    set({
      selectedId: target.id,
      history: target.id !== selectedId && selectedId ? [...history, selectedId].slice(-HISTORY_LIMIT) : history,
      panelTab: 'function',
      fileTabId: target.fileId,
      term: null,
      explainOpen: false,
      explainStatus: 'idle',
    })
    void get().loadSource(target.fileId)
    if (target.scope === 'ghost') {
      const d = scopeDistance(graph, target)
      if (d !== null) {
        set({ depth: d, depthText: String(d) })
        void get().analyze()
      }
    }
  },

  back: () => {
    const { history, graph } = get()
    const prev = history[history.length - 1]
    if (!prev) return
    const fn = fnById(graph, prev)
    set({
      selectedId: prev,
      history: history.slice(0, -1),
      panelTab: 'function',
      fileTabId: fn?.fileId ?? get().fileTabId,
      term: null,
      explainOpen: false,
      explainStatus: 'idle',
    })
    if (fn) void get().loadSource(fn.fileId)
  },

  openFile: (fileId) => {
    const { graph, selectedId, history } = get()
    if (!graph) return
    const file = graph.files.find((f) => f.id === fileId)
    const selected = fnById(graph, selectedId)
    const next: Partial<CodeGraphState> = { panelTab: 'file', fileTabId: fileId, term: null, explainOpen: false, explainStatus: 'idle' }
    if (selected?.fileId !== fileId) {
      const first = graph.functions
        .filter((f) => f.fileId === fileId && f.kind !== 'callback')
        .sort((a, b) => a.startLine - b.startLine)[0]
      if (first) {
        next.selectedId = first.id
        next.history = selectedId ? [...history, selectedId].slice(-HISTORY_LIMIT) : history
      }
    }
    set(next)
    void get().loadSource(fileId)
    if (file?.scope === 'ghost' && file.level !== null && graph.mode === 'file') {
      set({ depth: file.level, depthText: String(file.level) })
      void get().analyze()
    }
  },

  setPanelTab: (tab) => {
    const selected = fnById(get().graph, get().selectedId)
    set({ panelTab: tab, fileTabId: tab === 'file' ? (selected?.fileId ?? get().fileTabId) : get().fileTabId })
  },

  toggleExpanded: (fnId) => set((s) => ({ expanded: { ...s.expanded, [fnId]: !s.expanded[fnId] } })),

  setOffset: (fileId, dx, dy) => set((s) => ({ offsets: { ...s.offsets, [fileId]: { dx, dy } } })),

  resetOffsets: () => set({ offsets: {} }),

  setZoom: (zoom) => set({ zoom: Math.round(Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, zoom)) * 100) / 100 }),

  setQuery: (query) => set({ query }),

  toggleExternals: () => set((s) => ({ showExternals: !s.showExternals })),

  loadSource: async (fileId) => {
    const pid = get().projectKey
    if (!pid || get().sources[fileId]) return
    try {
      const source = await codeGraphService.getSource(pid, fileId)
      // Drop the answer if the project changed while it was loading.
      if (get().projectKey !== pid) return
      set((s) => ({ sources: { ...s.sources, [fileId]: source } }))
    } catch (e) {
      if (get().projectKey !== pid) return
      set({ error: errorMessage(e) })
    }
  },

  selectTerm: (term) => {
    set({ term, explainOpen: false, explainStatus: 'idle', explainError: null })
    if (term.text in get().keywordDocs) return
    codeGraphService
      .getKeywordDoc(DOC_LANGUAGE, term.text)
      .then((doc) => set((s) => ({ keywordDocs: { ...s.keywordDocs, [term.text]: doc } })))
      .catch(() => set((s) => ({ keywordDocs: { ...s.keywordDocs, [term.text]: null } })))
  },

  toggleExplain: () => {
    const { explainOpen, term, selectedId, graph, explanations, projectKey: pid } = get()
    if (explainOpen) {
      set({ explainOpen: false })
      return
    }
    const fn = fnById(graph, selectedId)
    if (!term || !fn || !pid) return
    const key = explanationKey(fn.id, term)
    if (explanations[key]) {
      set({ explainOpen: true, explainStatus: 'done' })
      return
    }
    set({ explainOpen: true, explainStatus: 'loading', explainError: null })
    codeGraphService
      .explainTerm(pid, { term: term.text, fileId: fn.fileId, line: term.line, functionId: fn.id })
      .then((result) => {
        const current = get()
        if (current.term !== term || current.explainStatus !== 'loading') return
        set((s) => ({ explanations: { ...s.explanations, [key]: result }, explainStatus: 'done' }))
      })
      .catch((e: unknown) => {
        if (get().term !== term || get().explainStatus === 'cancelled') return
        const message = errorMessage(e)
        set({ explainStatus: message === 'Cancelled' ? 'cancelled' : 'error', explainError: message })
      })
  },

  cancelExplain: () => {
    set({ explainStatus: 'cancelled' })
    void codeGraphService.cancelExplain()
  },

  retryExplain: () => {
    set({ explainOpen: false, explainStatus: 'idle', explainError: null })
    get().toggleExplain()
  },
}))
