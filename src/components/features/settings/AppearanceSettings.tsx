import type { AppSettings, Theme } from '@/types/index.ts'

interface AppearanceSettingsProps {
  settings: AppSettings
  theme: Theme
  onSetTheme: (theme: Theme) => void
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

export default function AppearanceSettings({ settings, theme, onSetTheme, onUpdate }: AppearanceSettingsProps) {
  return (
    <>
      <div style={rowStyle}>
        <span style={labelStyle}>Theme</span>
        <div style={{ display: 'flex', gap: 8 }}>
          {(['light', 'dark'] as Theme[]).map((t) => (
            <button
              key={t}
              onClick={() => onSetTheme(t)}
              className="font-mono"
              style={{
                padding: '7px 16px',
                fontSize: 12,
                borderRadius: 6,
                cursor: 'pointer',
                border: '1px solid var(--border)',
                backgroundColor: theme === t ? 'var(--text)' : 'transparent',
                color: theme === t ? 'var(--bg)' : 'var(--text-secondary)',
                transition: 'all 0.15s ease',
              }}
            >
              {t.charAt(0).toUpperCase() + t.slice(1)}
            </button>
          ))}
        </div>
      </div>
      <div style={{ ...rowStyle, borderBottom: 'none' }}>
        <span style={labelStyle}>Debrief Language</span>
        <select
          style={selectStyle}
          value={settings.appearance.debriefLanguage}
          onChange={(e) => onUpdate({ appearance: { ...settings.appearance, debriefLanguage: e.target.value as 'english' | 'portuguese' | 'auto' } })}
        >
          <option value="english">English</option>
          <option value="portuguese">Portugus</option>
          <option value="auto">Auto-detect</option>
        </select>
      </div>
    </>
  )
}
