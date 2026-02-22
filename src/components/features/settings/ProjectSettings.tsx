import type { AppSettings } from '@/types/index.ts'

interface ProjectSettingsProps {
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

export default function ProjectSettings({ settings, onUpdate }: ProjectSettingsProps) {
  return (
    <>
      <div style={rowStyle}>
        <span style={labelStyle}>Monitored Directory</span>
        <div style={{ flex: 1, display: 'flex', gap: 8 }}>
          <input style={inputStyle} value={settings.project.monitoredDirectory} readOnly />
          <button style={auxButtonStyle}>Browse</button>
        </div>
      </div>
      <div style={rowStyle}>
        <span style={labelStyle}>File Extensions</span>
        <input
          style={inputStyle}
          value={settings.project.fileExtensions}
          onChange={(e) => onUpdate({ project: { ...settings.project, fileExtensions: e.target.value } })}
        />
      </div>
      <div style={{ ...rowStyle, borderBottom: 'none', alignItems: 'flex-start' }}>
        <span style={{ ...labelStyle, paddingTop: 2 }}>Ignored Paths</span>
        <div style={{ flex: 1 }}>
          {settings.project.hasGitignore ? (
            <>
              <div
                className="font-mono"
                style={{
                  fontSize: 11,
                  color: 'var(--text-tertiary)',
                  marginBottom: 8,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                }}
              >
                <svg width="12" height="12" viewBox="0 0 16 16" fill="none" style={{ flexShrink: 0 }}>
                  <path d="M8 1C4.13 1 1 4.13 1 8s3.13 7 7 7 7-3.13 7-7-3.13-7-7-7zm0 12.5c-3.04 0-5.5-2.46-5.5-5.5S4.96 2.5 8 2.5s5.5 2.46 5.5 5.5-2.46 5.5-5.5 5.5z" fill="var(--success)" />
                  <path d="M6.5 7.5L7.5 8.5L9.5 6" stroke="var(--success)" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
                Synced from .gitignore
              </div>
              <div
                style={{
                  padding: '8px 12px',
                  backgroundColor: 'var(--code-bg)',
                  border: '1px solid var(--border-light)',
                  borderRadius: 6,
                  fontFamily: "'JetBrains Mono', monospace",
                  fontSize: 12,
                  color: 'var(--text-secondary)',
                  lineHeight: 1.7,
                  whiteSpace: 'pre-wrap',
                  maxHeight: 120,
                  overflowY: 'auto',
                }}
              >
                {settings.project.ignoredPaths}
              </div>
            </>
          ) : (
            <div
              style={{
                padding: '10px 14px',
                backgroundColor: 'var(--warning-bg)',
                border: '1px solid var(--warning-border)',
                borderRadius: 6,
                display: 'flex',
                alignItems: 'flex-start',
                gap: 10,
              }}
            >
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none" style={{ flexShrink: 0, marginTop: 1 }}>
                <path d="M8 1L1 14h14L8 1z" stroke="var(--warning)" strokeWidth="1.2" strokeLinejoin="round" />
                <path d="M8 6v3.5" stroke="var(--warning)" strokeWidth="1.2" strokeLinecap="round" />
                <circle cx="8" cy="11.5" r="0.6" fill="var(--warning)" />
              </svg>
              <div>
                <div className="font-mono" style={{ fontSize: 12, color: 'var(--warning)', fontWeight: 500, marginBottom: 3 }}>
                  No .gitignore found
                </div>
                <div className="font-mono" style={{ fontSize: 11, color: 'var(--text-tertiary)', lineHeight: 1.5 }}>
                  This project has no .gitignore file. Add one to your project root to configure which paths are excluded from analysis.
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  )
}
