import type { Decision } from '@/types/index.ts'

interface DecisionsListProps {
  decisions: Decision[]
}

export default function DecisionsList({ decisions }: DecisionsListProps) {
  return (
    <>
      {decisions.map((decision, i) => (
        <div key={i} style={{ marginBottom: i < decisions.length - 1 ? 16 : 0 }}>
          <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--text)', marginBottom: 6 }}>
            {decision.decision}
          </div>
          <div style={{ fontSize: 12, marginBottom: 4 }}>
            <span style={{ color: 'var(--text-secondary)' }}>Alternatives: </span>
            <span style={{ color: 'var(--text-tertiary)' }}>{decision.alternatives}</span>
          </div>
          <div style={{ fontSize: 12 }}>
            <span style={{ color: 'var(--text-secondary)' }}>Trade-offs: </span>
            <span style={{ color: 'var(--text-tertiary)' }}>{decision.tradeoffs}</span>
          </div>
        </div>
      ))}
    </>
  )
}
