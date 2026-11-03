import type { ChipEdgePath, EdgePath } from './layout.ts'
import { CALL_EDGE, GHOST_EDGE, HTTP_EDGE } from './layout.ts'
import { MONO } from './styles.ts'

interface GraphEdgesProps {
  edges: EdgePath[]
  chipEdges: ChipEdgePath[]
  selectedId: string | null
  width: number
  height: number
}

/** One SVG layer behind the cells. Decorative for assistive tech: the same relations are listed in the details panel. */
export default function GraphEdges({ edges, chipEdges, selectedId, width, height }: GraphEdgesProps) {
  return (
    <>
      <svg
        width={width}
        height={height}
        aria-hidden="true"
        style={{ position: 'absolute', left: 0, top: 0, overflow: 'visible', pointerEvents: 'none' }}
      >
        {chipEdges.map((e) => {
          const hot = e.from === selectedId
          const color = hot ? 'var(--text)' : GHOST_EDGE
          return (
            <g key={`chip:${e.key}`}>
              <path d={e.d} fill="none" stroke={color} strokeWidth={hot ? 1.6 : 1.1} strokeDasharray={e.unresolved ? '3 3' : undefined} />
              <circle cx={e.ex} cy={e.ey} r={2.5} fill={color} />
            </g>
          )
        })}
        {edges.map((e) => {
          const hot = e.from === selectedId || e.to === selectedId
          const http = e.kind === 'http'
          const color = hot ? 'var(--text)' : e.ghost ? GHOST_EDGE : http ? HTTP_EDGE : CALL_EDGE
          const dash = http ? '6 5' : e.ghost ? '3 4' : undefined
          return (
            <g key={e.key}>
              <path d={e.d} fill="none" stroke={color} strokeWidth={hot ? 1.8 : 1.3} strokeDasharray={dash} />
              <circle cx={e.ex} cy={e.ey} r={3} fill={color} />
            </g>
          )
        })}
      </svg>
      {edges
        .filter((e) => e.kind === 'http')
        .map((e) => (
          <span
            key={`pill:${e.key}`}
            style={{
              position: 'absolute',
              left: e.mx - 18,
              top: e.my - 9,
              fontFamily: MONO,
              fontSize: 10,
              fontWeight: 600,
              color: '#0a0a0a',
              backgroundColor: HTTP_EDGE,
              borderRadius: 4,
              padding: '2px 6px',
              pointerEvents: 'none',
            }}
          >
            HTTP
          </span>
        ))}
    </>
  )
}
