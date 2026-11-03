import type { CodeGraph } from '@/types/codegraph.ts'
import { useCodeGraphStore } from '@/stores/codegraphStore.ts'
import { searchMatches, MIN_BOARD_W } from './layout.ts'
import { SearchIcon } from './icons.tsx'
import { MONO, smallButton } from './styles.ts'

interface GraphToolbarProps {
  graph: CodeGraph
  scrollRef: React.RefObject<HTMLDivElement | null>
  boardWidth: number
}

export default function GraphToolbar({ graph, scrollRef, boardWidth }: GraphToolbarProps) {
  const history = useCodeGraphStore((s) => s.history)
  const query = useCodeGraphStore((s) => s.query)
  const zoom = useCodeGraphStore((s) => s.zoom)
  const showExternals = useCodeGraphStore((s) => s.showExternals)
  const back = useCodeGraphStore((s) => s.back)
  const setQuery = useCodeGraphStore((s) => s.setQuery)
  const select = useCodeGraphStore((s) => s.select)
  const toggleExternals = useCodeGraphStore((s) => s.toggleExternals)
  const resetOffsets = useCodeGraphStore((s) => s.resetOffsets)
  const setZoom = useCodeGraphStore((s) => s.setZoom)

  const matches = searchMatches(graph, query)
  let info = ''
  if (query.trim()) {
    if (!matches.length) info = 'no matches'
    else info = matches.length === 1 ? '1 match · Enter opens' : `${matches.length} matches · Enter opens the 1st`
  }

  const fit = () => {
    const width = scrollRef.current?.clientWidth ?? MIN_BOARD_W
    setZoom(Math.min(1.2, (width - 40) / Math.max(boardWidth, 1)))
  }

  return (
    <div
      style={{
        display: 'flex',
        flexWrap: 'wrap',
        alignItems: 'center',
        gap: 8,
        padding: '10px 16px',
        borderBottom: '1px solid var(--border-light)',
      }}
    >
      <button
        type="button"
        onClick={back}
        disabled={!history.length}
        aria-label="Back to the previous selection"
        style={{ ...smallButton, opacity: history.length ? 1 : 0.45, cursor: history.length ? 'pointer' : 'default' }}
      >
        ← Back
      </button>

      <div style={{ position: 'relative', flex: '0 1 240px', minWidth: 160 }}>
        <SearchIcon style={{ position: 'absolute', left: 10, top: 9, color: 'var(--text-tertiary)' }} />
        <input
          type="search"
          aria-label="Search function"
          placeholder="Search function…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && matches.length) select(matches[0])
            if (e.key === 'Escape') setQuery('')
          }}
          style={{
            width: '100%',
            height: 32,
            boxSizing: 'border-box',
            backgroundColor: 'var(--input-bg)',
            color: 'var(--text)',
            border: '1px solid var(--border)',
            borderRadius: 6,
            padding: '0 10px 0 30px',
            fontFamily: MONO,
            fontSize: 12,
            outline: 'none',
          }}
        />
      </div>
      {info && <span style={{ fontFamily: MONO, fontSize: 11, color: 'var(--text-secondary)' }}>{info}</span>}

      <button
        type="button"
        onClick={toggleExternals}
        aria-pressed={showExternals}
        style={{
          ...smallButton,
          backgroundColor: showExternals ? 'var(--bg-hover)' : 'var(--card-bg)',
          color: showExternals ? 'var(--text)' : 'var(--text-secondary)',
        }}
      >
        Externals
      </button>
      <button type="button" onClick={resetOffsets} style={smallButton}>
        Reorganize
      </button>

      {graph.truncated && (
        <span
          className="font-mono"
          style={{
            fontSize: 11,
            padding: '4px 10px',
            borderRadius: 99,
            backgroundColor: 'var(--warning-bg)',
            color: 'var(--warning)',
            border: '1px solid var(--warning-border)',
          }}
        >
          Showing {graph.functions.filter((f) => f.scope === 'in' && f.kind !== 'callback').length} of {graph.totalFunctions} functions. Increase the
          cap or reduce depth.
        </span>
      )}

      <div style={{ flex: 1 }} />

      <button type="button" onClick={() => setZoom(zoom / 1.15)} aria-label="Zoom out" style={{ ...smallButton, width: 32, padding: 0, fontSize: 16 }}>
        −
      </button>
      <span style={{ fontFamily: MONO, fontSize: 12, color: 'var(--text-secondary)', minWidth: 44, textAlign: 'center' }}>
        {Math.round(zoom * 100)}%
      </span>
      <button type="button" onClick={() => setZoom(zoom * 1.15)} aria-label="Zoom in" style={{ ...smallButton, width: 32, padding: 0, fontSize: 16 }}>
        +
      </button>
      <button type="button" onClick={fit} style={smallButton}>
        Fit
      </button>
    </div>
  )
}
