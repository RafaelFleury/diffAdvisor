interface ArchitecturalOverviewProps {
  summary: string
  patterns: string[]
}

export default function ArchitecturalOverview({ summary, patterns }: ArchitecturalOverviewProps) {
  return (
    <>
      <p style={{ fontSize: 13, lineHeight: 1.7, color: 'var(--text-secondary)', margin: 0 }}>
        {summary}
      </p>
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 12 }}>
        {patterns.map((pattern) => (
          <span
            key={pattern}
            className="font-mono"
            style={{
              fontSize: 11,
              padding: '3px 10px',
              borderRadius: 4,
              backgroundColor: 'var(--bg-tertiary)',
              color: 'var(--text-secondary)',
              border: '1px solid var(--border)',
            }}
          >
            {pattern}
          </span>
        ))}
      </div>
    </>
  )
}
