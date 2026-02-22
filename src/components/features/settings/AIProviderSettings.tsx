import Toggle from '@/components/ui/Toggle.tsx'
import type { AppSettings } from '@/types/index.ts'

interface AIProviderSettingsProps {
  settings: AppSettings
  connectionTestResult: { success: boolean; message: string } | null
  onUpdate: (partial: Partial<AppSettings>) => void
  onTestConnection: () => void
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

export default function AIProviderSettings({ settings, connectionTestResult, onUpdate, onTestConnection }: AIProviderSettingsProps) {
  return (
    <>
      <div style={rowStyle}>
        <span style={labelStyle}>Endpoint</span>
        <input
          style={inputStyle}
          value={settings.ai.endpointUrl}
          onChange={(e) => onUpdate({ ai: { ...settings.ai, endpointUrl: e.target.value } })}
          placeholder="https://api.anthropic.com/v1"
        />
      </div>
      <div style={rowStyle}>
        <span style={labelStyle}>Model</span>
        <input
          style={inputStyle}
          value={settings.ai.model}
          onChange={(e) => onUpdate({ ai: { ...settings.ai, model: e.target.value } })}
          placeholder="Claude Sonnet 4"
        />
      </div>
      <div style={rowStyle}>
        <span style={labelStyle}>API Key</span>
        <div style={{ flex: 1, display: 'flex', gap: 8 }}>
          <input style={inputStyle} type="password" value={settings.ai.apiKey} onChange={(e) => onUpdate({ ai: { ...settings.ai, apiKey: e.target.value } })} />
          <button style={auxButtonStyle} onClick={onTestConnection}>Test</button>
        </div>
      </div>
      {connectionTestResult && (
        <div style={{ ...rowStyle, borderBottom: 'none' }}>
          <span style={labelStyle} />
          <span className="font-mono" style={{ fontSize: 12, color: connectionTestResult.success ? 'var(--success)' : 'var(--critical)' }}>
            {connectionTestResult.message}
          </span>
        </div>
      )}
      <div style={{ ...rowStyle, borderBottom: 'none' }}>
        <span style={labelStyle}>Web Search</span>
        <Toggle
          checked={settings.ai.webSearch}
          onChange={(v) => onUpdate({ ai: { ...settings.ai, webSearch: v } })}
          label="Search for CVEs and best practices"
        />
      </div>
    </>
  )
}
