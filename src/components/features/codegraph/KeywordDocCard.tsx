import { useNavigate } from 'react-router-dom'
import type { KeywordDoc } from '@/types/codegraph.ts'
import { MONO } from './styles.ts'

interface KeywordDocCardProps {
  term: string | null
  /** undefined: still loading. null: no installed pack has this term. */
  doc: KeywordDoc | null | undefined
}

export default function KeywordDocCard({ term, doc }: KeywordDocCardProps) {
  const navigate = useNavigate()

  if (!term) {
    return (
      <div style={emptyBox}>
        Select an underlined term in the code, like <code style={kw}>async</code> or <code style={kw}>await</code>, to see its explanation
        here.
      </div>
    )
  }
  if (doc === undefined) return <div style={emptyBox}>Looking up {term}…</div>
  if (doc === null) {
    return (
      <div style={{ ...emptyBox, display: 'flex', flexDirection: 'column', gap: 10, alignItems: 'flex-start' }}>
        <span>
          No offline documentation for <code style={kw}>{term}</code>. Install the TypeScript documentation pack to see explanations offline.
        </span>
        <button
          type="button"
          onClick={() => navigate('/settings#docs')}
          style={{
            height: 30,
            padding: '0 12px',
            backgroundColor: 'var(--bg-tertiary)',
            color: 'var(--text)',
            border: '1px solid var(--border)',
            borderRadius: 6,
            fontFamily: MONO,
            fontSize: 12,
            cursor: 'pointer',
          }}
        >
          Open Settings
        </button>
      </div>
    )
  }

  return (
    <div
      style={{
        backgroundColor: 'var(--card-bg)',
        border: '1px solid var(--border)',
        borderRadius: 8,
        padding: 14,
        display: 'flex',
        flexDirection: 'column',
        gap: 10,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, flexWrap: 'wrap' }}>
        <span style={{ fontFamily: MONO, fontSize: 16, fontWeight: 600, color: '#ff7ab2' }}>{doc.term}</span>
        <span style={{ fontSize: 11, color: 'var(--text-secondary)' }}>{doc.category}</span>
      </div>
      <p style={{ margin: 0, fontSize: 13, lineHeight: 1.6, color: 'var(--text)' }}>{doc.text}</p>
      {doc.example && (
        <div
          style={{
            fontFamily: MONO,
            fontSize: 12,
            color: 'var(--text)',
            backgroundColor: 'var(--code-bg)',
            border: '1px solid var(--border-light)',
            borderRadius: 6,
            padding: '8px 10px',
            whiteSpace: 'pre',
            overflowX: 'auto',
          }}
        >
          {doc.example}
        </div>
      )}
      <span style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>Offline source: {doc.source}</span>
    </div>
  )
}

const emptyBox: React.CSSProperties = {
  border: '1px dashed var(--border)',
  borderRadius: 8,
  padding: 14,
  fontSize: 13,
  color: 'var(--text-tertiary)',
  lineHeight: 1.5,
}

const kw: React.CSSProperties = { fontFamily: MONO, color: '#ff7ab2' }
