import type { GraphFunction } from '@/types/codegraph.ts'
import type { CellBox } from './layout.ts'
import { ChevronIcon } from './icons.tsx'
import { MONO } from './styles.ts'

interface FunctionCellProps {
  fn: GraphFunction
  box: CellBox
  accent: string
  callbackLabels: string[]
  selected: boolean
  related: boolean
  searchActive: boolean
  searchHit: boolean
  onSelect: () => void
  onToggle: () => void
  onPointerDown: (e: React.PointerEvent) => void
}

export default function FunctionCell({
  fn,
  box,
  accent,
  callbackLabels,
  selected,
  related,
  searchActive,
  searchHit,
  onSelect,
  onToggle,
  onPointerDown,
}: FunctionCellProps) {
  const ghost = fn.scope === 'ghost'
  let opacity = ghost ? 0.75 : related || selected ? 1 : 0.85
  if (searchActive && !searchHit) opacity = 0.35

  let meta = ghost ? 'out of scope · expand' : `in ${fn.fanIn} · out ${fn.fanOut} · ${fn.loc} loc`
  if (!ghost && callbackLabels.length && !box.expanded) meta += ` · +${callbackLabels.length} cb`

  const ring = searchHit
    ? '0 0 0 2px var(--warning)'
    : selected
      ? '0 0 0 1px var(--text), 0 10px 28px rgba(0,0,0,0.5)'
      : 'none'

  return (
    <div
      onPointerDown={onPointerDown}
      style={{ position: 'absolute', left: box.x, top: box.y, width: box.w, height: box.h, opacity, touchAction: 'none' }}
    >
      <button
        type="button"
        onClick={onSelect}
        aria-label={`Open function ${fn.name}`}
        style={{
          position: 'absolute',
          inset: 0,
          boxSizing: 'border-box',
          padding: '9px 30px 8px 14px',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'flex-start',
          gap: 4,
          textAlign: 'left',
          backgroundColor: selected ? 'var(--bg-hover)' : 'var(--bg-tertiary)',
          border: `1px ${ghost ? 'dashed' : 'solid'} ${selected ? 'var(--text)' : 'var(--border)'}`,
          borderRadius: 8,
          boxShadow: ring,
          cursor: 'pointer',
          overflow: 'hidden',
          color: 'var(--text)',
        }}
      >
        <span style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: 3, backgroundColor: accent }} />
        <span style={{ fontFamily: MONO, fontSize: 13, fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '100%' }}>
          {fn.name}
        </span>
        <span style={{ fontFamily: MONO, fontSize: 10.5, color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>{meta}</span>
        {box.expanded && (
          <span
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: 3,
              marginTop: 4,
              paddingTop: 6,
              borderTop: '1px solid var(--border-light)',
              width: '100%',
            }}
          >
            {(fn.params.length ? fn.params : ['no parameters']).map((p) => (
              <span key={p} style={expandedLine('var(--text)')}>
                {p}
              </span>
            ))}
            <span style={expandedLine('var(--text-secondary)')}>→ {fn.returns ?? 'void'}</span>
            {fn.docSummary && (
              <span style={{ fontSize: 11, lineHeight: 1.35, color: 'var(--text-secondary)', whiteSpace: 'normal' }}>{fn.docSummary}</span>
            )}
            {callbackLabels.map((cb) => (
              <span key={cb} style={expandedLine('var(--info)')}>
                ↳ {cb}
              </span>
            ))}
          </span>
        )}
      </button>
      <button
        type="button"
        onClick={onToggle}
        aria-label={`${box.expanded ? 'Collapse' : 'Expand'} ${fn.name}`}
        aria-expanded={box.expanded}
        style={{
          position: 'absolute',
          right: 5,
          top: 6,
          width: 22,
          height: 22,
          padding: 0,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: 'var(--bg-hover)',
          color: 'var(--text)',
          border: '1px solid var(--border)',
          borderRadius: 5,
          cursor: 'pointer',
        }}
      >
        <ChevronIcon style={{ transform: `rotate(${box.expanded ? 180 : 0}deg)`, transition: 'transform 0.15s ease' }} />
      </button>
    </div>
  )
}

function expandedLine(color: string): React.CSSProperties {
  return { fontFamily: MONO, fontSize: 10.5, color, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }
}
