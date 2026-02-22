import type { DebriefResult, Evaluation } from '@/types/index.ts'
import CollapsibleSection from '@/components/ui/CollapsibleSection.tsx'
import ArchitecturalOverview from './ArchitecturalOverview.tsx'
import DecisionsList from './DecisionsList.tsx'
import GapsList from './GapsList.tsx'
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
      <CollapsibleSection
        title="Architectural Overview"
        icon={<EyeIcon />}
        defaultExpanded={true}
      >
        <ArchitecturalOverview summary={debrief.architecturalSummary} patterns={debrief.patternsIdentified} />
      </CollapsibleSection>

      <CollapsibleSection
        title="Decisions Made"
        icon={<span style={{ fontSize: 14 }}>{'\u2696'}</span>}
        defaultExpanded={false}
      >
        <DecisionsList decisions={debrief.decisionsMade} />
      </CollapsibleSection>

      <CollapsibleSection
        title={`Gaps Found (${debrief.gaps.length})`}
        icon={<AlertTriangleIcon />}
        defaultExpanded={true}
      >
        <GapsList gaps={debrief.gaps} />
      </CollapsibleSection>

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
