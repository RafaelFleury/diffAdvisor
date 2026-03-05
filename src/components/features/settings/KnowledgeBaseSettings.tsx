import { useState } from 'react'
import Toggle from '@/components/ui/Toggle.tsx'
import { useKnowledgeStore } from '@/stores/knowledgeStore.ts'
import type { AppSettings } from '@/types/index.ts'

interface KnowledgeBaseSettingsProps {
  settings: AppSettings
  onUpdate: (partial: Partial<AppSettings>) => Promise<void> | void
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
  const [browsing, setBrowsing] = useState(false)
  const [browseError, setBrowseError] = useState<string | null>(null)
  const loadNotes = useKnowledgeStore((state) => state.loadNotes)
  const isTauri = '__TAURI_INTERNALS__' in window

  const normalizePath = (value: string) => {
    const trimmed = value.trim()
    if (!trimmed) return ''
    if (trimmed === '/' || /^[A-Za-z]:[\\/]?$/.test(trimmed)) return trimmed
    return trimmed.replace(/[\\/]+$/, '')
  }

  const updateStoragePath = (storagePath: string) => {
    onUpdate({ knowledge: { storagePath } as AppSettings['knowledge'] })
  }

  const handleManualPathChange = (value: string) => {
    setBrowseError(null)
    updateStoragePath(value)
  }

  const handleManualPathBlur = (value: string) => {
    const normalized = normalizePath(value)
    void (async () => {
      if (normalized !== value) {
        await onUpdate({ knowledge: { storagePath: normalized } as AppSettings['knowledge'] })
      }
      await loadNotes()
    })()
  }

  const handleBrowse = async () => {
    if (!isTauri) return

    setBrowseError(null)
    setBrowsing(true)
    try {
      const { open } = await import('@tauri-apps/plugin-dialog')
      const selected = await open({ directory: true, multiple: false, title: 'Select Knowledge Base Directory' })
      if (!selected) return

      const path = Array.isArray(selected) ? selected[0] : selected
      if (path) {
        await onUpdate({ knowledge: { storagePath: normalizePath(path) } as AppSettings['knowledge'] })
        await loadNotes()
      }
    } catch (e) {
      setBrowseError((e as Error).message)
    } finally {
      setBrowsing(false)
    }
  }

  return (
    <>
      <div style={rowStyle}>
        <span style={labelStyle}>Storage Path</span>
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 6 }}>
          <div style={{ display: 'flex', gap: 8 }}>
            <input
              style={inputStyle}
              value={settings.knowledge.storagePath}
              onChange={(e) => handleManualPathChange(e.target.value)}
              onBlur={(e) => handleManualPathBlur(e.target.value)}
              placeholder="Select or type KB storage path..."
            />
            {isTauri && (
              <button style={auxButtonStyle} onClick={handleBrowse} disabled={browsing}>
                {browsing ? '...' : 'Browse'}
              </button>
            )}
          </div>
          {browseError && (
            <div className="font-mono" style={{ fontSize: 11, color: 'var(--critical)' }}>
              {browseError}
            </div>
          )}
        </div>
      </div>
      <div style={{ ...rowStyle, borderBottom: 'none' }}>
        <span style={labelStyle}>Auto-Generate Notes</span>
        <Toggle
          checked={settings.knowledge.autoGenerateNotes}
          onChange={(v) => onUpdate({ knowledge: { autoGenerateNotes: v } as AppSettings['knowledge'] })}
          label="Create .md notes from debriefs automatically"
        />
      </div>
    </>
  )
}
