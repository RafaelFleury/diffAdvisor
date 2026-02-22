import Toggle from '@/components/ui/Toggle.tsx'
import type { AppSettings } from '@/types/index.ts'

interface KnowledgeBaseSettingsProps {
  settings: AppSettings
  onUpdate: (partial: Partial<AppSettings>) => void
}

const labelStyle: React.CSSProperties = {
  fontSize: 13,
  color: 'var(--text)',
  minWidth: 180,
  flexShrink: 0,
  fontFamily: "'JetBrains Mono', monospace",
}

const inputStyle: React.CSSProperties = {
  padding: '8px 12px',
  backgroundColor: 'var(--input-bg)',
  border: '1px solid var(--border)',
  borderRadius: 6,
  color: 'var(--text)',
  fontSize: 13,
  outline: 'none',
  width: '100%',
  fontFamily: "'JetBrains Mono', monospace",
}

const auxButtonStyle: React.CSSProperties = {
  padding: '8px 14px',
  backgroundColor: 'var(--bg-tertiary)',
  border: '1px solid var(--border)',
  borderRadius: 6,
  color: 'var(--text-secondary)',
  fontSize: 12,
  cursor: 'pointer',
  fontFamily: "'JetBrains Mono', monospace",
  whiteSpace: 'nowrap',
}

const rowStyle: React.CSSProperties = {
  padding: '14px 18px',
  borderBottom: '1px solid var(--border-light)',
  display: 'flex',
  flexDirection: 'row',
  alignItems: 'center',
  gap: 16,
}

export default function KnowledgeBaseSettings({ settings, onUpdate }: KnowledgeBaseSettingsProps) {
  return (
    <>
      <div style={rowStyle}>
        <span style={labelStyle}>Storage Path</span>
        <div style={{ flex: 1, display: 'flex', gap: 8 }}>
          <input
            style={inputStyle}
            value={settings.knowledge.storagePath}
            onChange={(e) => onUpdate({ knowledge: { ...settings.knowledge, storagePath: e.target.value } })}
          />
          <button style={auxButtonStyle}>Browse</button>
        </div>
      </div>
      <div style={{ ...rowStyle, borderBottom: 'none' }}>
        <span style={labelStyle}>Auto-Generate Notes</span>
        <Toggle
          checked={settings.knowledge.autoGenerateNotes}
          onChange={(v) => onUpdate({ knowledge: { ...settings.knowledge, autoGenerateNotes: v } })}
          label="Create .md notes from debriefs automatically"
        />
      </div>
    </>
  )
}
