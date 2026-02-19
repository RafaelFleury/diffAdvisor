import type { DebriefResult, Evaluation } from '@/types/index.ts'
import CollapsibleSection from '@/components/ui/CollapsibleSection.tsx'
import GapAlert from './GapAlert.tsx'
import CheckpointSection from './CheckpointSection.tsx'

interface DebriefPanelProps {
  debrief: DebriefResult
  answers: Record<string, { text: string; evaluation: Evaluation | null }>
  onSubmitAnswer: (questionId: string, answer: string) => Promise<void>
}

const EyeIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
    <circle cx="12" cy="12" r="3" />
  </svg>
)

const AlertTriangleIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
    <line x1="12" y1="9" x2="12" y2="13" />
    <line x1="12" y1="17" x2="12.01" y2="17" />
  </svg>
)

export default function DebriefPanel({ debrief, answers, onSubmitAnswer }: DebriefPanelProps) {
  return (
    <div style={{ padding: 20, overflow: 'auto', height: '100%' }}>
      {/* Section 1: Architectural Overview */}
      <CollapsibleSection
        title="Architectural Overview"
        icon={<EyeIcon />}
        defaultExpanded={true}
      >
        <p style={{ fontSize: 13, lineHeight: 1.7, color: 'var(--text-secondary)', margin: 0 }}>
          {debrief.architecturalSummary}
        </p>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 12 }}>
          {debrief.patternsIdentified.map((pattern) => (
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
      </CollapsibleSection>

      {/* Section 2: Decisions Made */}
      <CollapsibleSection
        title="Decisions Made"
        icon={<span style={{ fontSize: 14 }}>{'\u2696'}</span>}
        defaultExpanded={false}
      >
        {debrief.decisionsMade.map((decision, i) => (
          <div key={i} style={{ marginBottom: i < debrief.decisionsMade.length - 1 ? 16 : 0 }}>
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
      </CollapsibleSection>

      {/* Section 3: Gaps Found */}
      <CollapsibleSection
        title={`Gaps Found (${debrief.gaps.length})`}
        icon={<AlertTriangleIcon />}
        defaultExpanded={true}
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {debrief.gaps.map((gap) => (
            <GapAlert key={gap.id} gap={gap} />
          ))}
        </div>
      </CollapsibleSection>

      {/* Section 4: Checkpoint */}
      <CollapsibleSection
        title="Checkpoint"
        icon={<span style={{ fontSize: 14 }}>{'\u2753'}</span>}
        defaultExpanded={true}
      >
        <CheckpointSection
          questions={debrief.checkpointQuestions}
          answers={answers}
          onSubmitAnswer={onSubmitAnswer}
        />
      </CollapsibleSection>
    </div>
  )
}
