import { useEffect, useMemo, useRef } from 'react'
import { IS_MOCK_SERVICES } from '@/services/index.ts'
import { useProjectStore } from '@/stores/projectStore.ts'
import { useCodeGraphStore } from '@/stores/codegraphStore.ts'
import { layoutGraph } from '@/components/features/codegraph/layout.ts'
import ControlsPanel from '@/components/features/codegraph/ControlsPanel.tsx'
import GraphToolbar from '@/components/features/codegraph/GraphToolbar.tsx'
import GraphCanvas from '@/components/features/codegraph/GraphCanvas.tsx'
import GraphLegend from '@/components/features/codegraph/GraphLegend.tsx'
import DetailsPanel from '@/components/features/codegraph/DetailsPanel.tsx'
import StatusFooter from '@/components/features/codegraph/StatusFooter.tsx'
import Spinner from '@/components/ui/Spinner.tsx'
import EmptyState from '@/components/ui/EmptyState.tsx'
import { MONO } from '@/components/features/codegraph/styles.ts'

/** Re-analyze when the watcher reports a new commit (docs/plans/codegraph.md, "Re-analysis"). */
const AUTO_REANALYZE_ON_COMMIT = true

function relativeTime(iso: string): string {
  const seconds = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 1000))
  if (seconds < 60) return 'just now'
  const minutes = Math.round(seconds / 60)
  if (minutes < 60) return `${minutes} min ago`
  return `${Math.round(minutes / 60)} h ago`
}

export default function CodeGraph() {
  const activeProject = useProjectStore((s) => s.activeProject)
  const loadActiveProject = useProjectStore((s) => s.loadActiveProject)
  const graph = useCodeGraphStore((s) => s.graph)
  const status = useCodeGraphStore((s) => s.status)
  const loading = useCodeGraphStore((s) => s.loading)
  const error = useCodeGraphStore((s) => s.error)
  const expanded = useCodeGraphStore((s) => s.expanded)
  const offsets = useCodeGraphStore((s) => s.offsets)
  const showExternals = useCodeGraphStore((s) => s.showExternals)
  const loadStatus = useCodeGraphStore((s) => s.loadStatus)
  const analyze = useCodeGraphStore((s) => s.analyze)
  const scrollRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    void loadStatus()
    void loadActiveProject().then(() => {
      if (useProjectStore.getState().activeProject || IS_MOCK_SERVICES) void analyze()
    })
  }, [loadStatus, loadActiveProject, analyze])

  useEffect(() => {
    if (!AUTO_REANALYZE_ON_COMMIT || IS_MOCK_SERVICES) return
    if (!('__TAURI_INTERNALS__' in window)) return
    let unlisten: (() => void) | undefined
    let disposed = false
    import('@tauri-apps/api/event').then(({ listen }) => {
      listen('commit_detected', () => {
        void useCodeGraphStore.getState().analyze()
      }).then((fn) => {
        if (disposed) fn()
        else unlisten = fn
      })
    })
    return () => {
      disposed = true
      if (unlisten) unlisten()
    }
  }, [])

  const layout = useMemo(
    () => (graph ? layoutGraph(graph, { expanded, showExternals, offsets }) : null),
    [graph, expanded, showExternals, offsets],
  )

  if (!activeProject && !IS_MOCK_SERVICES) {
    return (
      <div style={{ padding: '32px 40px' }}>
        <EmptyState message="No active project. Add or select a project on the Dashboard to explore its code graph." />
      </div>
    )
  }

  const inFunctions = graph ? graph.functions.filter((f) => f.scope === 'in' && f.kind !== 'callback').length : 0
  const ghostFiles = graph ? graph.files.filter((f) => f.scope === 'ghost').length : 0

  return (
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100%' }}>
      <header
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'center',
          gap: 14,
          padding: '16px 24px',
          borderBottom: '1px solid var(--border)',
        }}
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <h1 className="font-mono" style={{ fontSize: 22, fontWeight: 600, letterSpacing: '-0.02em', color: 'var(--text)' }}>
            Code Graph
          </h1>
          <span className="font-mono" style={{ fontSize: 13, color: 'var(--text-tertiary)' }}>
            {activeProject?.path ?? '~/dev/shop-dashboard (mock)'}
          </span>
        </div>
        {activeProject && (activeProject.language || activeProject.frameworks.length > 0) && (
          <span
            className="font-mono"
            style={{ fontSize: 11, color: 'var(--text-secondary)', backgroundColor: 'var(--bg-tertiary)', borderRadius: 99, padding: '3px 10px' }}
          >
            {[...activeProject.frameworks, activeProject.language].filter(Boolean).join(' · ')}
          </span>
        )}
        <div style={{ flex: 1 }} />
        {graph && (
          <span style={{ fontFamily: MONO, fontSize: 12, color: 'var(--text-secondary)' }}>
            {inFunctions} functions · {graph.edges.length} connections · {ghostFiles} {ghostFiles === 1 ? 'file' : 'files'} out of scope
          </span>
        )}
        {graph && (
          <span style={{ fontFamily: MONO, fontSize: 11, color: 'var(--text-secondary)' }}>
            on-demand analysis · {relativeTime(graph.analyzedAt)}
          </span>
        )}
      </header>

      <div style={{ display: 'flex', flexWrap: 'wrap', flex: 1, minHeight: 0 }}>
        <ControlsPanel graph={graph} />

        <section style={{ flex: '999 1 560px', minWidth: 0, display: 'flex', flexDirection: 'column', backgroundColor: 'var(--bg)' }}>
          {graph && layout ? (
            <>
              <GraphToolbar graph={graph} scrollRef={scrollRef} boardWidth={layout.width} />
              <GraphCanvas graph={graph} layout={layout} scrollRef={scrollRef} />
              <GraphLegend />
            </>
          ) : (
            <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 420 }}>
              {error ? (
                <span style={{ fontFamily: MONO, fontSize: 13, color: 'var(--critical)', padding: 24 }}>{error}</span>
              ) : (
                <Spinner message={loading ? 'Analyzing project…' : 'Preparing…'} />
              )}
            </div>
          )}
        </section>

        {graph && <DetailsPanel graph={graph} />}
      </div>

      <StatusFooter graph={graph} status={status} />
    </div>
  )
}
