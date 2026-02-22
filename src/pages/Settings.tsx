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

function SettingsSection({ title, children, headerRight }: { title: string; children: React.ReactNode; headerRight?: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 28 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
        <h2
          className="font-mono"
          style={{
            fontSize: 12,
            fontWeight: 600,
            color: 'var(--text-tertiary)',
            textTransform: 'uppercase',
            letterSpacing: '0.06em',
          }}
        >
          {title}
        </h2>
        {headerRight}
      </div>
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

// ── Add Skill Modal ──

function AddSkillModal({ onClose, onAdd }: { onClose: () => void; onAdd: (skill: { name: string; description: string; tags: string[]; enabled: boolean; content: string; detect: { files: string[]; contentPatterns: string[]; extensions: string[] } }) => void }) {
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [tags, setTags] = useState('')

  const handleSubmit = () => {
    if (!name.trim()) return
    onAdd({
      name: name.trim(),
      description: description.trim(),
      tags: tags.split(',').map((t) => t.trim()).filter(Boolean),
      enabled: true,
      content: '',
      detect: { files: [], contentPatterns: [], extensions: [] },
    })
    onClose()
  }

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.6)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1000,
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          backgroundColor: 'var(--card-bg)',
          border: '1px solid var(--border)',
          borderRadius: 10,
          padding: 24,
          width: 420,
          maxWidth: '90vw',
        }}
      >
        <h3
          className="font-mono"
          style={{
            fontSize: 14,
            fontWeight: 600,
            color: 'var(--text)',
            marginBottom: 20,
          }}
        >
          Add Custom Skill
        </h3>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div>
            <label className="font-mono" style={{ fontSize: 11, color: 'var(--text-tertiary)', display: 'block', marginBottom: 6 }}>
              Name
            </label>
            <input
              style={inputStyle}
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. GraphQL"
            />
          </div>
          <div>
            <label className="font-mono" style={{ fontSize: 11, color: 'var(--text-tertiary)', display: 'block', marginBottom: 6 }}>
              Description
            </label>
            <input
              style={inputStyle}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="e.g. Schema design, N+1 queries, resolvers"
            />
          </div>
          <div>
            <label className="font-mono" style={{ fontSize: 11, color: 'var(--text-tertiary)', display: 'block', marginBottom: 6 }}>
              Tags (comma-separated)
            </label>
            <input
              style={inputStyle}
              value={tags}
              onChange={(e) => setTags(e.target.value)}
              placeholder="e.g. api, backend, graphql"
            />
          </div>
        </div>

        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 22 }}>
          <button
            onClick={onClose}
            className="font-mono"
            style={{
              ...auxButtonStyle,
              padding: '8px 18px',
            }}
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            className="font-mono"
            style={{
              padding: '8px 18px',
              backgroundColor: name.trim() ? 'var(--text)' : 'var(--bg-tertiary)',
              border: '1px solid var(--border)',
              borderRadius: 6,
              color: name.trim() ? 'var(--bg)' : 'var(--text-tertiary)',
              fontSize: 12,
              cursor: name.trim() ? 'pointer' : 'default',
              fontFamily: "'JetBrains Mono', monospace",
              fontWeight: 500,
              transition: 'all 0.15s ease',
            }}
          >
            Add Skill
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Main Settings Page ──

export default function Settings() {
  const { settings, skills, connectionTestResult, loadSettings, loadSkills, updateSettings, toggleSkill, addSkill, testConnection } = useSettingsStore()
  const { theme, setTheme } = useThemeStore()
  const [showAddSkill, setShowAddSkill] = useState(false)

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

  return (
    <div style={{ padding: '32px 40px', maxWidth: 1200, margin: '0 auto' }}>
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

      <div className="settings-grid">
        {/* Column 1 */}
        <div>
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
          </SettingsSection>

          {/* AI PROVIDER */}
          <SettingsSection title="AI Provider">
            <div style={rowStyle}>
              <span style={labelStyle}>Endpoint</span>
              <input
                style={inputStyle}
                value={settings.ai.endpointUrl}
                onChange={(e) => updateSettings({ ai: { ...settings.ai, endpointUrl: e.target.value } })}
                placeholder="https://api.anthropic.com/v1"
              />
            </div>
            <div style={rowStyle}>
              <span style={labelStyle}>Model</span>
              <input
                style={inputStyle}
                value={settings.ai.model}
                onChange={(e) => updateSettings({ ai: { ...settings.ai, model: e.target.value } })}
                placeholder="Claude Sonnet 4"
              />
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
        </div>

        {/* Column 2 */}
        <div>
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
          <SettingsSection
            title="Skills"
            headerRight={
              <button
                onClick={() => setShowAddSkill(true)}
                className="font-mono"
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 5,
                  padding: '5px 12px',
                  backgroundColor: 'transparent',
                  border: '1px solid var(--border)',
                  borderRadius: 6,
                  color: 'var(--text-secondary)',
                  fontSize: 11,
                  cursor: 'pointer',
                  fontFamily: "'JetBrains Mono', monospace",
                  transition: 'all 0.15s ease',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.borderColor = 'var(--text-tertiary)'
                  e.currentTarget.style.color = 'var(--text)'
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.borderColor = 'var(--border)'
                  e.currentTarget.style.color = 'var(--text-secondary)'
                }}
              >
                <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                  <path d="M6 2v8M2 6h8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                </svg>
                Add Skill
              </button>
            }
          >
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
      </div>

      {showAddSkill && (
        <AddSkillModal
          onClose={() => setShowAddSkill(false)}
          onAdd={(skill) => addSkill(skill)}
        />
      )}
    </div>
  )
}
