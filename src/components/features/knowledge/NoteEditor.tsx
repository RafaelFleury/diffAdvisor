import { useState, useEffect, useRef } from 'react'
import type { KnowledgeNote } from '@/types/index.ts'

interface NoteEditorProps {
  note?: KnowledgeNote | null
  onSave: (note: { title: string; content: string; categoryPath: string; tags: string[] }) => void
  onCancel: () => void
}

const CATEGORIES = [
  'concepts/security',
  'concepts/architecture',
  'languages/javascript',
  'languages/python',
  'checklists',
]

export default function NoteEditor({ note, onSave, onCancel }: NoteEditorProps) {
  const [title, setTitle] = useState(note?.title ?? '')
  const [content, setContent] = useState(note?.content ?? '')
  const [categoryPath, setCategoryPath] = useState(note?.categoryPath ?? CATEGORIES[0])
  const [customCategory, setCustomCategory] = useState('')
  const [useCustomCategory, setUseCustomCategory] = useState(false)
  const [tags, setTags] = useState(note?.tags.join(', ') ?? '')
  const [saving, setSaving] = useState(false)
  const titleRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    titleRef.current?.focus()
  }, [])

  // If editing a note whose category isn't in the preset list
  useEffect(() => {
    if (note && !CATEGORIES.includes(note.categoryPath)) {
      setUseCustomCategory(true)
      setCustomCategory(note.categoryPath)
    }
  }, [note])

  const handleSave = async () => {
    if (!title.trim() || !content.trim()) return
    setSaving(true)
    try {
      const resolvedCategory = useCustomCategory ? customCategory.trim() : categoryPath
      onSave({
        title: title.trim(),
        content: content.trim(),
        categoryPath: resolvedCategory || CATEGORIES[0],
        tags: tags
          .split(',')
          .map((t) => t.trim())
          .filter(Boolean),
      })
    } finally {
      setSaving(false)
    }
  }

  const isValid = title.trim().length > 0 && content.trim().length > 0

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', gap: 16 }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <span className="font-mono" style={{ fontSize: 14, fontWeight: 600, color: 'var(--text)' }}>
          {note ? 'Edit Note' : 'New Note'}
        </span>
        <div style={{ display: 'flex', gap: 8 }}>
          <button
            onClick={onCancel}
            className="font-mono"
            style={{
              padding: '5px 14px',
              fontSize: 12,
              background: 'none',
              border: '1px solid var(--border)',
              borderRadius: 5,
              color: 'var(--text-secondary)',
              cursor: 'pointer',
            }}
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={!isValid || saving}
            className="font-mono"
            style={{
              padding: '5px 14px',
              fontSize: 12,
              backgroundColor: isValid && !saving ? 'var(--text)' : 'var(--bg-tertiary)',
              border: 'none',
              borderRadius: 5,
              color: isValid && !saving ? 'var(--bg)' : 'var(--text-tertiary)',
              cursor: isValid && !saving ? 'pointer' : 'not-allowed',
            }}
          >
            {saving ? 'Saving...' : 'Save'}
          </button>
        </div>
      </div>

      {/* Title */}
      <div>
        <label
          className="font-mono"
          style={{ display: 'block', fontSize: 11, color: 'var(--text-tertiary)', marginBottom: 4 }}
        >
          Title
        </label>
        <input
          ref={titleRef}
          className="font-mono"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="e.g. JWT Authentication"
          style={{
            width: '100%',
            padding: '7px 10px',
            fontSize: 13,
            backgroundColor: 'var(--input-bg)',
            border: '1px solid var(--border)',
            borderRadius: 6,
            color: 'var(--text)',
            outline: 'none',
            boxSizing: 'border-box',
          }}
        />
      </div>

      {/* Category + Tags row */}
      <div style={{ display: 'flex', gap: 12 }}>
        <div style={{ flex: 1 }}>
          <label
            className="font-mono"
            style={{ display: 'block', fontSize: 11, color: 'var(--text-tertiary)', marginBottom: 4 }}
          >
            Category
          </label>
          {useCustomCategory ? (
            <div style={{ display: 'flex', gap: 6 }}>
              <input
                className="font-mono"
                value={customCategory}
                onChange={(e) => setCustomCategory(e.target.value)}
                placeholder="e.g. frameworks/express"
                style={{
                  flex: 1,
                  padding: '7px 10px',
                  fontSize: 12,
                  backgroundColor: 'var(--input-bg)',
                  border: '1px solid var(--border)',
                  borderRadius: 6,
                  color: 'var(--text)',
                  outline: 'none',
                }}
              />
              <button
                onClick={() => { setUseCustomCategory(false); setCustomCategory('') }}
                className="font-mono"
                style={{
                  padding: '4px 8px',
                  fontSize: 11,
                  background: 'none',
                  border: '1px solid var(--border)',
                  borderRadius: 5,
                  color: 'var(--text-tertiary)',
                  cursor: 'pointer',
                  whiteSpace: 'nowrap',
                }}
              >
                Presets
              </button>
            </div>
          ) : (
            <div style={{ display: 'flex', gap: 6 }}>
              <select
                className="font-mono"
                value={categoryPath}
                onChange={(e) => setCategoryPath(e.target.value)}
                style={{
                  flex: 1,
                  padding: '7px 10px',
                  fontSize: 12,
                  backgroundColor: 'var(--input-bg)',
                  border: '1px solid var(--border)',
                  borderRadius: 6,
                  color: 'var(--text)',
                  outline: 'none',
                }}
              >
                {CATEGORIES.map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
              <button
                onClick={() => setUseCustomCategory(true)}
                className="font-mono"
                style={{
                  padding: '4px 8px',
                  fontSize: 11,
                  background: 'none',
                  border: '1px solid var(--border)',
                  borderRadius: 5,
                  color: 'var(--text-tertiary)',
                  cursor: 'pointer',
                  whiteSpace: 'nowrap',
                }}
              >
                Custom
              </button>
            </div>
          )}
        </div>

        <div style={{ flex: 1 }}>
          <label
            className="font-mono"
            style={{ display: 'block', fontSize: 11, color: 'var(--text-tertiary)', marginBottom: 4 }}
          >
            Tags (comma-separated)
          </label>
          <input
            className="font-mono"
            value={tags}
            onChange={(e) => setTags(e.target.value)}
            placeholder="e.g. security, auth, jwt"
            style={{
              width: '100%',
              padding: '7px 10px',
              fontSize: 12,
              backgroundColor: 'var(--input-bg)',
              border: '1px solid var(--border)',
              borderRadius: 6,
              color: 'var(--text)',
              outline: 'none',
              boxSizing: 'border-box',
            }}
          />
        </div>
      </div>

      {/* Content */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
        <label
          className="font-mono"
          style={{ display: 'block', fontSize: 11, color: 'var(--text-tertiary)', marginBottom: 4 }}
        >
          Content (Markdown · supports [[wikilinks]])
        </label>
        <textarea
          className="font-mono"
          value={content}
          onChange={(e) => setContent(e.target.value)}
          placeholder={'# Note Title\n\nWrite your note here using markdown.\n\nLink to other notes with [[Note Title]].'}
          style={{
            flex: 1,
            padding: '10px 12px',
            fontSize: 12,
            lineHeight: 1.7,
            backgroundColor: 'var(--input-bg)',
            border: '1px solid var(--border)',
            borderRadius: 6,
            color: 'var(--text)',
            outline: 'none',
            resize: 'none',
            boxSizing: 'border-box',
            fontFamily: 'inherit',
          }}
        />
      </div>
    </div>
  )
}
