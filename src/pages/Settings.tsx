import { useEffect, useState } from 'react'
import { useSettingsStore } from '@/stores/settingsStore.ts'
import { useThemeStore } from '@/stores/themeStore.ts'
import ProjectSettings from '@/components/features/settings/ProjectSettings.tsx'
import AIProviderSettings from '@/components/features/settings/AIProviderSettings.tsx'
import AnalysisSettings from '@/components/features/settings/AnalysisSettings.tsx'
import KnowledgeBaseSettings from '@/components/features/settings/KnowledgeBaseSettings.tsx'
import SkillManager from '@/components/features/settings/SkillManager.tsx'
import AppearanceSettings from '@/components/features/settings/AppearanceSettings.tsx'
import AddSkillModal from '@/components/features/settings/AddSkillModal.tsx'

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
          <SettingsSection title="Project">
            <ProjectSettings settings={settings} onUpdate={updateSettings} />
          </SettingsSection>

          <SettingsSection title="AI Provider">
            <AIProviderSettings
              settings={settings}
              connectionTestResult={connectionTestResult}
              onUpdate={updateSettings}
              onTestConnection={testConnection}
            />
          </SettingsSection>

          <SettingsSection title="Analysis">
            <AnalysisSettings settings={settings} onUpdate={updateSettings} />
          </SettingsSection>
        </div>

        {/* Column 2 */}
        <div>
          <SettingsSection title="Knowledge Base">
            <KnowledgeBaseSettings settings={settings} onUpdate={updateSettings} />
          </SettingsSection>

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
            <SkillManager skills={skills} onToggleSkill={toggleSkill} />
          </SettingsSection>

          <SettingsSection title="Appearance">
            <AppearanceSettings settings={settings} theme={theme} onSetTheme={setTheme} onUpdate={updateSettings} />
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
