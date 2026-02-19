import type { Gap } from '@/types/index.ts'

interface GapAlertProps {
  gap: Gap
}

const severityStyles = {
  critical: { bg: 'var(--critical-bg)', border: 'var(--critical-border)', color: 'var(--critical)' },
  warning: { bg: 'var(--warning-bg)', border: 'var(--warning-border)', color: 'var(--warning)' },
  info: { bg: 'var(--info-bg)', border: 'var(--info-border)', color: 'var(--info)' },
}

export default function GapAlert({ gap }: GapAlertProps) {
  const style = severityStyles[gap.severity]

  return (
    <div
      style={{
        backgroundColor: style.bg,
        border: `1px solid ${style.border}`,
        borderRadius: 6,
        padding: '12px 14px',
      }}
    >
      {/* Header */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 6, alignItems: 'center' }}>
        <span
          className="font-mono"
          style={{
            fontSize: 10,
            fontWeight: 700,
            letterSpacing: '0.05em',
            color: style.color,
          }}
        >
          {gap.severity.toUpperCase()}
        </span>
        <span className="font-mono" style={{ fontSize: 10, color: 'var(--text-tertiary)' }}>
          {gap.category}
        </span>
      </div>

      {/* Description */}
      <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--text)', marginBottom: 6 }}>
        {gap.description}
      </div>

      {/* Explanation */}
      <div style={{ fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.6, marginBottom: 8 }}>
        {gap.explanation}
      </div>

      {/* Suggestion */}
      <div
        style={{
          fontSize: 12,
          color: 'var(--text-secondary)',
          lineHeight: 1.6,
          padding: '8px 12px',
          backgroundColor: 'var(--code-bg)',
          borderRadius: 4,
          borderLeft: `2px solid ${style.color}`,
        }}
      >
        <span style={{ fontWeight: 500, color: 'var(--text)' }}>Suggestion: </span>
        {gap.suggestion}
      </div>
    </div>
  )
}
