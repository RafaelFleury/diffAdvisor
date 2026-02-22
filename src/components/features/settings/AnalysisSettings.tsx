import Toggle from '@/components/ui/Toggle.tsx'
import type { AppSettings } from '@/types/index.ts'

interface AnalysisSettingsProps {
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

const selectStyle: React.CSSProperties = {
  padding: '8px 12px',
  backgroundColor: 'var(--input-bg)',
  border: '1px solid var(--border)',
  borderRadius: 6,
  color: 'var(--text)',
  fontSize: 13,
  outline: 'none',
  width: '100%',
  fontFamily: "'JetBrains Mono', monospace",
  appearance: 'none' as const,
  backgroundImage: `url("data:image/svg+xml,%3Csvg width='10' height='6' viewBox='0 0 10 6' fill='none' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M1 1l4 4 4-4' stroke='%23737373' stroke-width='1.5' stroke-linecap='round' stroke-linejoin='round'/%3E%3C/svg%3E")`,
  backgroundRepeat: 'no-repeat',
  backgroundPosition: 'right 12px center',
  paddingRight: 32,
}

const rowStyle: React.CSSProperties = {
  padding: '14px 18px',
  borderBottom: '1px solid var(--border-light)',
  display: 'flex',
  flexDirection: 'row',
  alignItems: 'center',
  gap: 16,
}

export default function AnalysisSettings({ settings, onUpdate }: AnalysisSettingsProps) {
  return (
    <>
      <div style={rowStyle}>
        <span style={labelStyle}>Auto-Analyze on Commit</span>
        <Toggle
          checked={settings.analysis.autoAnalyze}
          onChange={(v) => onUpdate({ analysis: { ...settings.analysis, autoAnalyze: v } })}
        />
      </div>
      <div style={rowStyle}>
        <span style={labelStyle}>Checkpoint Mode</span>
        <select
          style={selectStyle}
          value={settings.analysis.checkpointMode}
          onChange={(e) => onUpdate({ analysis: { ...settings.analysis, checkpointMode: e.target.value as 'free_text' | 'multiple_choice' } })}
        >
          <option value="free_text">Free Text (deeper learning, uses more tokens)</option>
          <option value="multiple_choice">Multiple Choice (faster review)</option>
        </select>
      </div>
      <div style={{ ...rowStyle, borderBottom: 'none' }}>
        <span style={labelStyle}>Analysis Depth</span>
        <select
          style={selectStyle}
          value={settings.analysis.analysisDepth}
          onChange={(e) => onUpdate({ analysis: { ...settings.analysis, analysisDepth: e.target.value as 'quick' | 'balanced' | 'deep' } })}
        >
          <option value="quick">Quick</option>
          <option value="balanced">Balanced (recommended)</option>
          <option value="deep">Deep</option>
        </select>
      </div>
    </>
  )
}
