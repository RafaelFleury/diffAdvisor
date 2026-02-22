import type { Gap } from '@/types/index.ts'
import GapAlert from './GapAlert.tsx'

interface GapsListProps {
  gaps: Gap[]
}

export default function GapsList({ gaps }: GapsListProps) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      {gaps.map((gap) => (
        <GapAlert key={gap.id} gap={gap} />
      ))}
    </div>
  )
}
