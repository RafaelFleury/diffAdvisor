import { CALL_EDGE, GHOST_EDGE, HTTP_EDGE } from './layout.ts'

const item: React.CSSProperties = { display: 'flex', alignItems: 'center', gap: 8 }

export default function GraphLegend() {
  return (
    <div
      style={{
        display: 'flex',
        flexWrap: 'wrap',
        alignItems: 'center',
        gap: 18,
        padding: '10px 16px',
        borderTop: '1px solid var(--border-light)',
        fontSize: 12,
        color: 'var(--text-secondary)',
      }}
    >
      <span style={item}>
        <svg width="28" height="6" aria-hidden="true">
          <line x1="0" y1="3" x2="28" y2="3" stroke={CALL_EDGE} strokeWidth={1.6} />
        </svg>
        call
      </span>
      <span style={item}>
        <svg width="28" height="6" aria-hidden="true">
          <line x1="0" y1="3" x2="28" y2="3" stroke={HTTP_EDGE} strokeWidth={1.4} strokeDasharray="6 5" />
        </svg>
        HTTP route
      </span>
      <span style={item}>
        <span style={{ width: 18, height: 10, border: `1px solid ${GHOST_EDGE}`, borderRadius: 99 }} />
        external
      </span>
      <span style={item}>
        <span style={{ width: 18, height: 10, border: '1px dashed var(--text-secondary)', borderRadius: 99 }} />
        unresolved (?)
      </span>
      <span style={item}>
        <span style={{ width: 16, height: 10, border: '1px dashed var(--text-tertiary)', borderRadius: 3 }} />
        out of scope
      </span>
      <span style={item}>
        <span style={{ width: 8, height: 8, borderRadius: 2, backgroundColor: 'var(--info)' }} />
        client
      </span>
      <span style={item}>
        <span style={{ width: 8, height: 8, borderRadius: 2, backgroundColor: 'var(--warning)' }} />
        server
      </span>
    </div>
  )
}
