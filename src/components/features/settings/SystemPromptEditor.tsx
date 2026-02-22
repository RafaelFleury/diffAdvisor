// Placeholder for system prompt editor — will be wired to settings in Phase 3
// when the backend can persist the custom prompt

interface SystemPromptEditorProps {
  prompt: string
  onChange: (prompt: string) => void
  onReset: () => void
}

export default function SystemPromptEditor({ prompt, onChange, onReset }: SystemPromptEditorProps) {
  return (
    <div style={{ padding: 18, display: 'flex', flexDirection: 'column', gap: 12 }}>
      <textarea
        className="font-mono"
        value={prompt}
        onChange={(e) => onChange(e.target.value)}
        style={{
          width: '100%',
          minHeight: 200,
          padding: '10px 12px',
          fontSize: 12,
          lineHeight: 1.7,
          backgroundColor: 'var(--input-bg)',
          border: '1px solid var(--border)',
          borderRadius: 6,
          color: 'var(--text)',
          outline: 'none',
          boxSizing: 'border-box',
          resize: 'vertical',
          fontFamily: "'JetBrains Mono', monospace",
        }}
      />
      <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
        <button
          onClick={onReset}
          className="font-mono"
          style={{
            padding: '7px 14px',
            fontSize: 12,
            backgroundColor: 'var(--bg-tertiary)',
            border: '1px solid var(--border)',
            borderRadius: 6,
            color: 'var(--text-secondary)',
            cursor: 'pointer',
          }}
        >
          Reset to Default
        </button>
        <button
          className="font-mono"
          style={{
            padding: '7px 14px',
            fontSize: 12,
            backgroundColor: 'var(--text)',
            border: 'none',
            borderRadius: 6,
            color: 'var(--bg)',
            cursor: 'pointer',
            fontWeight: 500,
          }}
        >
          Save
        </button>
      </div>
    </div>
  )
}
