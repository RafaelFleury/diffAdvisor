import type { TermExplanation } from '@/types/codegraph.ts'
import type { ExplainStatus } from '@/stores/codegraphStore.ts'
import Spinner from '@/components/ui/Spinner.tsx'
import { MONO } from './styles.ts'

interface TermExplanationCardProps {
  term: string
  functionName: string
  open: boolean
  status: ExplainStatus
  error: string | null
  explanation: TermExplanation | undefined
  onToggle: () => void
  onCancel: () => void
  onRetry: () => void
}

const heading: React.CSSProperties = {
  fontFamily: MONO,
  fontSize: 11,
  letterSpacing: '0.06em',
  textTransform: 'uppercase',
  color: 'var(--success)',
}

export default function TermExplanationCard({
  term,
  functionName,
  open,
  status,
  error,
  explanation,
  onToggle,
  onCancel,
  onRetry,
}: TermExplanationCardProps) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12, borderTop: '1px solid var(--border-light)', paddingTop: 14 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
        <button
          type="button"
          onClick={onToggle}
          aria-pressed={open}
          style={{
            height: 36,
            padding: '0 14px',
            backgroundColor: open ? 'var(--text)' : 'var(--bg-tertiary)',
            color: open ? 'var(--bg)' : 'var(--text)',
            border: '1px solid var(--border)',
            borderRadius: 6,
            fontFamily: MONO,
            fontSize: 12,
            fontWeight: 600,
            cursor: 'pointer',
          }}
        >
          {open ? 'Hide explanation' : `Explain ${term} with AI`}
        </button>
        <span style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>optional · uses the AI provider configured in Settings</span>
      </div>

      {open && status === 'loading' && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <Spinner size={16} />
          <span style={{ fontFamily: MONO, fontSize: 12, color: 'var(--text-secondary)' }}>Explaining {term}…</span>
          <button type="button" onClick={onCancel} style={linkButton}>
            Cancel
          </button>
        </div>
      )}

      {open && (status === 'error' || status === 'cancelled') && (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 12,
            border: `1px solid ${status === 'error' ? 'var(--critical-border)' : 'var(--border)'}`,
            backgroundColor: status === 'error' ? 'var(--critical-bg)' : 'transparent',
            borderRadius: 8,
            padding: '10px 12px',
            fontSize: 13,
            color: status === 'error' ? 'var(--critical)' : 'var(--text-secondary)',
          }}
        >
          <span style={{ flex: 1 }}>{status === 'error' ? error : 'Cancelled.'}</span>
          <button type="button" onClick={onRetry} style={linkButton}>
            Retry
          </button>
        </div>
      )}

      {open && status === 'done' && explanation && (
        <div
          style={{
            backgroundColor: 'var(--card-bg)',
            border: '1px solid var(--border)',
            borderRadius: 10,
            padding: 16,
            display: 'flex',
            flexDirection: 'column',
            gap: 14,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, flexWrap: 'wrap', fontSize: 12, color: 'var(--text-secondary)' }}>
            <span style={{ fontFamily: MONO, fontSize: 14, fontWeight: 600, color: '#ff7ab2' }}>{explanation.term}</span>
            in <span style={{ fontFamily: MONO, color: 'var(--text)' }}>{explanation.where}</span>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <span style={heading}>In one sentence</span>
            <p style={{ margin: 0, fontSize: 14, lineHeight: 1.55, color: 'var(--text)' }}>{explanation.summary}</p>
          </div>
          {explanation.example && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <span style={heading}>Simple use case</span>
              <div
                style={{
                  fontFamily: MONO,
                  fontSize: 12,
                  lineHeight: 1.6,
                  color: 'var(--text)',
                  backgroundColor: 'var(--code-bg)',
                  border: '1px solid var(--border-light)',
                  borderRadius: 6,
                  padding: '10px 12px',
                  whiteSpace: 'pre',
                  overflowX: 'auto',
                }}
              >
                {explanation.example}
              </div>
            </div>
          )}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <span style={heading}>Step by step</span>
            <ol style={{ margin: 0, paddingLeft: 20, display: 'flex', flexDirection: 'column', gap: 6, fontSize: 13, lineHeight: 1.55, color: 'var(--text)' }}>
              {explanation.steps.map((s) => (
                <li key={s}>{s}</li>
              ))}
            </ol>
          </div>
          <div
            style={{
              display: 'flex',
              gap: 10,
              backgroundColor: 'var(--warning-bg)',
              border: '1px solid var(--warning-border)',
              borderRadius: 8,
              padding: '10px 12px',
            }}
          >
            <span style={{ fontFamily: MONO, fontSize: 11, fontWeight: 600, color: 'var(--warning)', flexShrink: 0, paddingTop: 2 }}>WATCH OUT</span>
            <p style={{ margin: 0, fontSize: 13, lineHeight: 1.55, color: 'var(--text)' }}>{explanation.attention}</p>
          </div>
          <span style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>
            Context sent: the term, its line and the function {functionName}.
          </span>
        </div>
      )}
    </div>
  )
}

const linkButton: React.CSSProperties = {
  background: 'none',
  border: 'none',
  padding: 0,
  fontFamily: MONO,
  fontSize: 12,
  color: 'var(--text)',
  textDecoration: 'underline',
  textUnderlineOffset: 3,
  cursor: 'pointer',
}
