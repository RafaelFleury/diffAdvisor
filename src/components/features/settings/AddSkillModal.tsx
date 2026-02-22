import { useState } from 'react'

interface AddSkillModalProps {
  onClose: () => void
  onAdd: (skill: { name: string; description: string; tags: string[]; enabled: boolean; content: string; detect: { files: string[]; contentPatterns: string[]; extensions: string[] } }) => void
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
  boxSizing: 'border-box',
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

export default function AddSkillModal({ onClose, onAdd }: AddSkillModalProps) {
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
            <input style={inputStyle} value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. GraphQL" />
          </div>
          <div>
            <label className="font-mono" style={{ fontSize: 11, color: 'var(--text-tertiary)', display: 'block', marginBottom: 6 }}>
              Description
            </label>
            <input style={inputStyle} value={description} onChange={(e) => setDescription(e.target.value)} placeholder="e.g. Schema design, N+1 queries, resolvers" />
          </div>
          <div>
            <label className="font-mono" style={{ fontSize: 11, color: 'var(--text-tertiary)', display: 'block', marginBottom: 6 }}>
              Tags (comma-separated)
            </label>
            <input style={inputStyle} value={tags} onChange={(e) => setTags(e.target.value)} placeholder="e.g. api, backend, graphql" />
          </div>
        </div>

        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 22 }}>
          <button onClick={onClose} className="font-mono" style={{ ...auxButtonStyle, padding: '8px 18px' }}>
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
