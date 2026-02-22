import Toggle from '@/components/ui/Toggle.tsx'
import type { Skill } from '@/types/index.ts'

interface SkillManagerProps {
  skills: Skill[]
  onToggleSkill: (skillId: string, enabled: boolean) => void
}

const rowStyle: React.CSSProperties = {
  padding: '14px 18px',
  borderBottom: '1px solid var(--border-light)',
  display: 'flex',
  flexDirection: 'row',
  alignItems: 'center',
  gap: 16,
  justifyContent: 'space-between',
}

export default function SkillManager({ skills, onToggleSkill }: SkillManagerProps) {
  return (
    <>
      {skills.map((skill, idx) => (
        <div
          key={skill.id}
          style={{
            ...rowStyle,
            borderBottom: idx === skills.length - 1 ? 'none' : rowStyle.borderBottom,
          }}
        >
          <div>
            <div className="font-mono" style={{ fontSize: 13, color: 'var(--text)', fontWeight: 500 }}>
              {skill.name}
            </div>
            <div className="font-mono" style={{ fontSize: 11, color: 'var(--text-tertiary)', marginTop: 2 }}>
              {skill.autoDetected ? 'auto-detected' : skill.enabled ? 'manually enabled' : 'disabled'}
              {skill.tags.length > 0 && ` · ${skill.tags.join(', ')}`}
            </div>
          </div>
          <Toggle checked={skill.enabled} onChange={(v) => onToggleSkill(skill.id, v)} />
        </div>
      ))}
    </>
  )
}
