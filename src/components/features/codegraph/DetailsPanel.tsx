import { useMemo } from 'react'
import type { CodeGraph, GraphFunction } from '@/types/codegraph.ts'
import { explanationKey, useCodeGraphStore } from '@/stores/codegraphStore.ts'
import { cellIdFor, chipText } from './layout.ts'
import CodeView from './CodeView.tsx'
import KeywordDocCard from './KeywordDocCard.tsx'
import TermExplanationCard from './TermExplanationCard.tsx'
import { MONO, chipButton, sectionLabel, segmentButton, segmentGroup, tagColors } from './styles.ts'

interface DetailsPanelProps {
  graph: CodeGraph
}

interface Relation {
  id: string
  name: string
  http: boolean
}

export default function DetailsPanel({ graph }: DetailsPanelProps) {
  const selectedId = useCodeGraphStore((s) => s.selectedId)
  const panelTab = useCodeGraphStore((s) => s.panelTab)
  const fileTabId = useCodeGraphStore((s) => s.fileTabId)
  const sources = useCodeGraphStore((s) => s.sources)
  const term = useCodeGraphStore((s) => s.term)
  const keywordDocs = useCodeGraphStore((s) => s.keywordDocs)
  const explanations = useCodeGraphStore((s) => s.explanations)
  const explainStatus = useCodeGraphStore((s) => s.explainStatus)
  const explainError = useCodeGraphStore((s) => s.explainError)
  const explainOpen = useCodeGraphStore((s) => s.explainOpen)
  const setPanelTab = useCodeGraphStore((s) => s.setPanelTab)
  const select = useCodeGraphStore((s) => s.select)
  const selectTerm = useCodeGraphStore((s) => s.selectTerm)
  const toggleExplain = useCodeGraphStore((s) => s.toggleExplain)
  const cancelExplain = useCodeGraphStore((s) => s.cancelExplain)
  const retryExplain = useCodeGraphStore((s) => s.retryExplain)

  const fnById = useMemo(() => new Map(graph.functions.map((f) => [f.id, f])), [graph])
  const fn: GraphFunction | undefined = selectedId ? fnById.get(selectedId) : undefined

  const { callers, callees, externals } = useMemo(() => {
    const callers: Relation[] = []
    const callees: Relation[] = []
    if (!fn) return { callers, callees, externals: [] as string[] }
    const seen = new Set<string>()
    for (const e of graph.edges) {
      const from = cellIdFor(graph, e.from)
      const to = cellIdFor(graph, e.to)
      if (to === fn.id && from !== fn.id && !seen.has(`in:${from}`)) {
        seen.add(`in:${from}`)
        callers.push({ id: from, name: fnById.get(from)?.name ?? from, http: e.kind === 'http' })
      }
      if (from === fn.id && to !== fn.id && !seen.has(`out:${to}`)) {
        seen.add(`out:${to}`)
        callees.push({ id: to, name: fnById.get(to)?.name ?? to, http: e.kind === 'http' })
      }
    }
    const externals = graph.externals.filter((x) => cellIdFor(graph, x.from) === fn.id).map(chipText)
    return { callers, callees, externals }
  }, [graph, fn, fnById])

  if (!fn) {
    return (
      <aside style={panelStyle}>
        <span style={{ fontFamily: MONO, fontSize: 13, color: 'var(--text-tertiary)' }}>Select a function in the graph.</span>
      </aside>
    )
  }

  const fileId = panelTab === 'file' ? (fileTabId ?? fn.fileId) : fn.fileId
  const file = graph.files.find((f) => f.id === fileId)
  const fileTag = tagColors(file?.tag ?? null)
  const fnTag = tagColors(graph.files.find((f) => f.id === fn.fileId)?.tag ?? null)
  const source = sources[fileId]
  const fileFns = graph.functions.filter((f) => f.fileId === fileId && f.kind !== 'callback').sort((a, b) => a.startLine - b.startLine)
  const importsCount = file?.imports.length ?? 0
  const explanation = term ? explanations[explanationKey(fn.id, term)] : undefined

  return (
    <aside style={panelStyle}>
      <div role="group" aria-label="Panel view" style={segmentGroup}>
        <button type="button" aria-pressed={panelTab === 'function'} onClick={() => setPanelTab('function')} style={segmentButton(panelTab === 'function')}>
          Function
        </button>
        <button type="button" aria-pressed={panelTab === 'file'} onClick={() => setPanelTab('file')} style={segmentButton(panelTab === 'file')}>
          Full file
        </button>
      </div>

      {panelTab === 'function' ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
              <span style={{ fontFamily: MONO, fontSize: 18, fontWeight: 600, color: 'var(--text)' }}>{fn.name}</span>
              <TagBadge colors={fnTag} />
            </div>
            <button
              type="button"
              onClick={() => setPanelTab('file')}
              style={{
                alignSelf: 'flex-start',
                padding: 0,
                background: 'none',
                border: 'none',
                fontFamily: MONO,
                fontSize: 12,
                color: 'var(--info)',
                cursor: 'pointer',
                textDecoration: 'underline',
                textUnderlineOffset: 3,
              }}
            >
              {fn.fileId}:{fn.startLine}
            </button>
          </div>

          <div
            style={{
              fontFamily: MONO,
              fontSize: 12,
              color: 'var(--text)',
              backgroundColor: 'var(--card-bg)',
              border: '1px solid var(--border-light)',
              borderRadius: 6,
              padding: '10px 12px',
              overflowX: 'auto',
              whiteSpace: 'nowrap',
            }}
          >
            {fn.signature}
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', gap: 8 }}>
            <Metric label="lines" value={fn.loc} />
            <Metric label="complexity" value={fn.complexity} />
            <Metric label="fan-in" value={fn.fanIn} />
            <Metric label="fan-out" value={fn.fanOut} />
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <RelationRow label="called by" empty="none in scope (entry point)">
              {callers.map((r) => (
                <RelationChip key={r.id} relation={r} onClick={() => select(r.id)} />
              ))}
            </RelationRow>
            <RelationRow label="calls" empty="no calls (leaf)">
              {callees.map((r) => (
                <RelationChip key={r.id} relation={r} onClick={() => select(r.id)} />
              ))}
              {externals.map((x) => (
                <span
                  key={x}
                  style={{
                    fontFamily: MONO,
                    fontSize: 11.5,
                    color: x.startsWith('?') ? 'var(--text)' : 'var(--text-secondary)',
                    border: `1px ${x.startsWith('?') ? 'dashed' : 'solid'} var(--border)`,
                    borderRadius: 999,
                    padding: '4px 10px',
                  }}
                >
                  {x}
                </span>
              ))}
            </RelationRow>
          </div>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
            <span style={{ fontFamily: MONO, fontSize: 15, fontWeight: 600, color: 'var(--text)', wordBreak: 'break-all' }}>{fileId}</span>
            <TagBadge colors={fileTag} />
          </div>
          <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
            {file?.lineCount ?? '?'} lines · {fileFns.length} {fileFns.length === 1 ? 'function' : 'functions'} · {importsCount}{' '}
            {importsCount === 1 ? 'import' : 'imports'}
          </span>
          <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 6 }}>
            <span style={{ fontSize: 11, color: 'var(--text-tertiary)', width: 82 }}>functions</span>
            {fileFns.map((f) => (
              <button
                key={f.id}
                type="button"
                onClick={() => select(f.id)}
                style={{ ...chipButton, backgroundColor: f.id === fn.id ? 'var(--info-bg)' : 'var(--bg-tertiary)' }}
              >
                ƒ {f.name}
              </button>
            ))}
          </div>
        </div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span style={sectionLabel}>{panelTab === 'file' ? 'Full file' : 'Function code'}</span>
          <span style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>click a reserved word</span>
        </div>
        <CodeView
          source={source}
          fromLine={panelTab === 'function' ? fn.startLine : undefined}
          toLine={panelTab === 'function' ? fn.endLine : undefined}
          highlight={panelTab === 'file' && fn.fileId === fileId ? { from: fn.startLine, to: fn.endLine } : undefined}
          selectedTerm={term}
          onTerm={selectTerm}
          maxHeight={panelTab === 'file' ? 520 : 420}
        />
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        <span style={sectionLabel}>Documentation</span>
        <KeywordDocCard term={term?.text ?? null} doc={term ? keywordDocs[term.text] : undefined} />
      </div>

      {term && (
        <TermExplanationCard
          term={term.text}
          functionName={fn.name}
          open={explainOpen}
          status={explainStatus}
          error={explainError}
          explanation={explanation}
          onToggle={toggleExplain}
          onCancel={cancelExplain}
          onRetry={retryExplain}
        />
      )}
    </aside>
  )
}

const panelStyle: React.CSSProperties = {
  flex: '1 1 400px',
  maxWidth: '100%',
  minWidth: 0,
  borderLeft: '1px solid var(--border)',
  backgroundColor: 'var(--sidebar-bg)',
  padding: '14px 18px 24px',
  display: 'flex',
  flexDirection: 'column',
  gap: 16,
  boxSizing: 'border-box',
  overflowY: 'auto',
}

function TagBadge({ colors }: { colors: ReturnType<typeof tagColors> }) {
  return (
    <span
      style={{
        fontFamily: MONO,
        fontSize: 11,
        color: colors.accent,
        backgroundColor: colors.bg,
        border: `1px solid ${colors.border}`,
        borderRadius: 99,
        padding: '2px 10px',
      }}
    >
      {colors.label}
    </span>
  )
}

function Metric({ label, value }: { label: string; value: number }) {
  return (
    <div
      style={{
        backgroundColor: 'var(--card-bg)',
        border: '1px solid var(--border-light)',
        borderRadius: 6,
        padding: '8px 10px',
        display: 'flex',
        flexDirection: 'column',
        gap: 2,
      }}
    >
      <span style={{ fontSize: 10.5, color: 'var(--text-tertiary)' }}>{label}</span>
      <span style={{ fontFamily: MONO, fontSize: 16, fontWeight: 600, color: 'var(--text)' }}>{value}</span>
    </div>
  )
}

function RelationRow({ label, empty, children }: { label: string; empty: string; children: React.ReactNode[] }) {
  const hasItems = children.some((group) => (Array.isArray(group) ? group.length > 0 : !!group))
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 6 }}>
      <span style={{ fontSize: 11, color: 'var(--text-tertiary)', width: 82 }}>{label}</span>
      {children}
      {!hasItems && <span style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>{empty}</span>}
    </div>
  )
}

function RelationChip({ relation, onClick }: { relation: Relation; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{ ...chipButton, borderColor: relation.http ? '#6b4fa8' : 'var(--border)' }}
    >
      {relation.http ? `${relation.name} · HTTP` : relation.name}
    </button>
  )
}
