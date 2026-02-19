import { useEffect, useState } from 'react'
import { useSettingsStore } from '@/stores/settingsStore.ts'
import { useThemeStore } from '@/stores/themeStore.ts'
import type { Theme } from '@/types/index.ts'

// ── Reusable styles ──

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

const selectStyle: React.CSSProperties = {
  ...inputStyle,
  appearance: 'none' as const,
  backgroundImage: `url("data:image/svg+xml,%3Csvg width='10' height='6' viewBox='0 0 10 6' fill='none' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M1 1l4 4 4-4' stroke='%23737373' stroke-width='1.5' stroke-linecap='round' stroke-linejoin='round'/%3E%3C/svg%3E")`,
  backgroundRepeat: 'no-repeat',
  backgroundPosition: 'right 12px center',
  paddingRight: 32,
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

// ── Toggle component ──

function Toggle({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label?: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center' }}>
      <div
        onClick={() => onChange(!checked)}
        style={{
          width: 38,
          height: 22,
          borderRadius: 11,
          cursor: 'pointer',
          position: 'relative',
          backgroundColor: checked ? 'var(--text)' : 'var(--bg-tertiary)',
          border: `1px solid ${checked ? 'var(--text)' : 'var(--border)'}`,
          transition: 'all 0.2s ease',
          flexShrink: 0,
        }}
      >
        <div
          style={{
            width: 16,
            height: 16,
            borderRadius: 8,
            position: 'absolute',
            top: 2,
            left: checked ? 19 : 2,
            backgroundColor: checked ? 'var(--bg)' : 'var(--text-tertiary)',
            transition: 'all 0.2s ease',
          }}
        />
      </div>
      {label && (
        <span className="font-mono" style={{ fontSize: 11, color: 'var(--text-tertiary)', marginLeft: 8 }}>
          {label}
        </span>
      )}
    </div>
  )
}

// ── Section component ──

function SettingsSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 28 }}>
      <h2
        className="font-mono"
        style={{
          fontSize: 12,
          fontWeight: 600,
          color: 'var(--text-tertiary)',
          textTransform: 'uppercase',
          letterSpacing: '0.06em',
          marginBottom: 14,
        }}
      >
        {title}
      </h2>
      <div
        style={{
          backgroundColor: 'var(--card-bg)',
          border: '1px solid var(--border)',
          borderRadius: 8,
          overflow: 'hidden',
        }}
      >
        {children}
      </div>
    </div>
  )
}

// ── Main Settings Page ──

export default function Settings() {
  const { settings, skills, connectionTestResult, loadSettings, loadSkills, updateSettings, toggleSkill, testConnection } = useSettingsStore()
  const { theme, setTheme } = useThemeStore()
  const [provider, setProvider] = useState<'anthropic' | 'openai'>('anthropic')

  useEffect(() => {
    loadSettings()
    loadSkills()
  }, [loadSettings, loadSkills])

  if (!settings) {
    return (
      <div className="font-mono" style={{ padding: '32px 40px', fontSize: 13, color: 'var(--text-tertiary)' }}>
        Loading settings...
      </div>
    )
  }

  const modelOptions = provider === 'anthropic'
    ? ['Claude Sonnet 4', 'Claude Opus 4']
    : ['GPT-4.1', 'GPT-4.1 Mini']

  return (
    <div style={{ padding: '32px 40px', maxWidth: 640 }}>
      <h1
        className="font-mono"
        style={{
          fontSize: 22,
          fontWeight: 600,
          color: 'var(--text)',
          letterSpacing: '-0.02em',
          marginBottom: 32,
        }}
      >
        Settings
      </h1>

      {/* PROJECT */}
      <SettingsSection title="Project">
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
            onChange={(e) => updateSettings({ project: { ...settings.project, fileExtensions: e.target.value } })}
          />
        </div>
        <div style={{ ...rowStyle, borderBottom: 'none' }}>
          <span style={labelStyle}>Ignored Paths</span>
          <input
            style={inputStyle}
            value={settings.project.ignoredPaths}
            onChange={(e) => updateSettings({ project: { ...settings.project, ignoredPaths: e.target.value } })}
          />
        </div>
      </SettingsSection>

      {/* AI PROVIDER */}
      <SettingsSection title="AI Provider">
        <div style={rowStyle}>
          <span style={labelStyle}>Provider</span>
          <select
            style={selectStyle}
            value={provider}
            onChange={(e) => {
              const v = e.target.value as 'anthropic' | 'openai'
              setProvider(v)
              updateSettings({ ai: { ...settings.ai, provider: v } })
            }}
          >
            <option value="anthropic">Anthropic</option>
            <option value="openai">OpenAI</option>
          </select>
        </div>
        <div style={rowStyle}>
          <span style={labelStyle}>Model</span>
          <select
            style={selectStyle}
            value={settings.ai.model}
            onChange={(e) => updateSettings({ ai: { ...settings.ai, model: e.target.value } })}
          >
            {modelOptions.map((m) => (
              <option key={m} value={m}>{m}</option>
            ))}
          </select>
        </div>
        <div style={rowStyle}>
          <span style={labelStyle}>API Key</span>
          <div style={{ flex: 1, display: 'flex', gap: 8 }}>
            <input style={inputStyle} type="password" value={settings.ai.apiKey} onChange={(e) => updateSettings({ ai: { ...settings.ai, apiKey: e.target.value } })} />
            <button style={auxButtonStyle} onClick={testConnection}>Test</button>
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
            onChange={(v) => updateSettings({ ai: { ...settings.ai, webSearch: v } })}
            label="Search for CVEs and best practices"
          />
        </div>
      </SettingsSection>

      {/* ANALYSIS */}
      <SettingsSection title="Analysis">
        <div style={rowStyle}>
          <span style={labelStyle}>Auto-Analyze on Commit</span>
          <Toggle
            checked={settings.analysis.autoAnalyze}
            onChange={(v) => updateSettings({ analysis: { ...settings.analysis, autoAnalyze: v } })}
          />
        </div>
        <div style={rowStyle}>
          <span style={labelStyle}>Checkpoint Mode</span>
          <select
            style={selectStyle}
            value={settings.analysis.checkpointMode}
            onChange={(e) => updateSettings({ analysis: { ...settings.analysis, checkpointMode: e.target.value as 'free_text' | 'multiple_choice' } })}
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
            onChange={(e) => updateSettings({ analysis: { ...settings.analysis, analysisDepth: e.target.value as 'quick' | 'balanced' | 'deep' } })}
          >
            <option value="quick">Quick</option>
            <option value="balanced">Balanced (recommended)</option>
            <option value="deep">Deep</option>
          </select>
        </div>
      </SettingsSection>

      {/* KNOWLEDGE BASE */}
      <SettingsSection title="Knowledge Base">
        <div style={rowStyle}>
          <span style={labelStyle}>Storage Path</span>
          <div style={{ flex: 1, display: 'flex', gap: 8 }}>
            <input
              style={inputStyle}
              value={settings.knowledge.storagePath}
              onChange={(e) => updateSettings({ knowledge: { ...settings.knowledge, storagePath: e.target.value } })}
            />
            <button style={auxButtonStyle}>Browse</button>
          </div>
        </div>
        <div style={{ ...rowStyle, borderBottom: 'none' }}>
          <span style={labelStyle}>Auto-Generate Notes</span>
          <Toggle
            checked={settings.knowledge.autoGenerateNotes}
            onChange={(v) => updateSettings({ knowledge: { ...settings.knowledge, autoGenerateNotes: v } })}
            label="Create .md notes from debriefs automatically"
          />
        </div>
      </SettingsSection>

      {/* SKILLS */}
      <SettingsSection title="Skills">
        {skills.map((skill, idx) => (
          <div
            key={skill.id}
            style={{
              ...rowStyle,
              borderBottom: idx === skills.length - 1 ? 'none' : rowStyle.borderBottom,
              justifyContent: 'space-between',
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
            <Toggle checked={skill.enabled} onChange={(v) => toggleSkill(skill.id, v)} />
          </div>
        ))}
      </SettingsSection>

      {/* APPEARANCE */}
      <SettingsSection title="Appearance">
        <div style={rowStyle}>
          <span style={labelStyle}>Theme</span>
          <div style={{ display: 'flex', gap: 8 }}>
            {(['light', 'dark'] as Theme[]).map((t) => (
              <button
                key={t}
                onClick={() => setTheme(t)}
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
            onChange={(e) => updateSettings({ appearance: { ...settings.appearance, debriefLanguage: e.target.value as 'english' | 'portuguese' | 'auto' } })}
          >
            <option value="english">English</option>
            <option value="portuguese">Portugus</option>
            <option value="auto">Auto-detect</option>
          </select>
        </div>
      </SettingsSection>
    </div>
  )
}
