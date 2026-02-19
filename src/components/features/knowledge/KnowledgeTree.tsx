import { useState } from 'react'
import type { KnowledgeNote } from '@/types/index.ts'

interface TreeNode {
  name: string
  path: string
  children: TreeNode[]
  notes: KnowledgeNote[]
}

interface KnowledgeTreeProps {
  notes: KnowledgeNote[]
  selectedNoteId: string | null
  onSelectNote: (noteId: string) => void
  searchQuery: string
  onSearchChange: (query: string) => void
  onNewNote: () => void
}

function buildTreeFromNotes(notes: KnowledgeNote[]): TreeNode[] {
  const categoryMap: Record<string, KnowledgeNote[]> = {}

  for (const note of notes) {
    if (!categoryMap[note.categoryPath]) {
      categoryMap[note.categoryPath] = []
    }
    categoryMap[note.categoryPath].push(note)
  }

  // Build hierarchical tree
  const topLevel: Record<string, TreeNode> = {}

  for (const [path, pathNotes] of Object.entries(categoryMap)) {
    const parts = path.split('/')

    // Ensure all parent nodes exist
    let currentLevel = topLevel
    for (let i = 0; i < parts.length; i++) {
      const part = parts[i]
      if (!currentLevel[part]) {
        currentLevel[part] = {
          name: part,
          path: parts.slice(0, i + 1).join('/'),
          children: [],
          notes: [],
        }
      }
      if (i === parts.length - 1) {
        currentLevel[part].notes = pathNotes
      }
      // Convert children array to map for next level
      const childMap: Record<string, TreeNode> = {}
      for (const child of currentLevel[part].children) {
        childMap[child.name] = child
      }
      if (i < parts.length - 1) {
        const nextPart = parts[i + 1]
        if (!childMap[nextPart]) {
          const newNode: TreeNode = {
            name: nextPart,
            path: parts.slice(0, i + 2).join('/'),
            children: [],
            notes: [],
          }
          currentLevel[part].children.push(newNode)
          childMap[nextPart] = newNode
        }
      }
      currentLevel = childMap
    }
  }

  return Object.values(topLevel)
}

function FolderIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M22 19a2 2 0 01-2 2H4a2 2 0 01-2-2V5a2 2 0 012-2h5l2 3h9a2 2 0 012 2z" />
    </svg>
  )
}

function FileIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" />
      <polyline points="14,2 14,8 20,8" />
    </svg>
  )
}

function TreeFolder({
  node,
  depth,
  selectedNoteId,
  onSelectNote,
  defaultExpanded,
}: {
  node: TreeNode
  depth: number
  selectedNoteId: string | null
  onSelectNote: (noteId: string) => void
  defaultExpanded?: boolean
}) {
  const [expanded, setExpanded] = useState(defaultExpanded ?? false)

  return (
    <div>
      <div
        onClick={() => setExpanded(!expanded)}
        className="font-mono"
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 6,
          padding: '5px 8px',
          paddingLeft: 8 + depth * 16,
          fontSize: 12,
          color: 'var(--text-secondary)',
          borderRadius: 4,
          cursor: 'pointer',
          transition: 'background-color 0.1s ease',
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.backgroundColor = 'var(--bg-hover)'
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.backgroundColor = 'transparent'
        }}
      >
        <svg
          width="14"
          height="14"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          style={{ flexShrink: 0 }}
        >
          {expanded ? <polyline points="6,9 12,15 18,9" /> : <polyline points="9,6 15,12 9,18" />}
        </svg>
        <FolderIcon />
        <span>{node.name}</span>
      </div>
      {expanded && (
        <>
          {node.children.map((child) => (
            <TreeFolder
              key={child.path}
              node={child}
              depth={depth + 1}
              selectedNoteId={selectedNoteId}
              onSelectNote={onSelectNote}
              defaultExpanded={
                child.name === 'security' || child.name === 'javascript'
              }
            />
          ))}
          {node.notes.map((note) => (
            <div
              key={note.id}
              onClick={() => onSelectNote(note.id)}
              className="font-mono"
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                padding: '5px 8px',
                paddingLeft: 26 + (depth + 1) * 16,
                fontSize: 12,
                color: selectedNoteId === note.id ? 'var(--text)' : 'var(--text-tertiary)',
                backgroundColor: selectedNoteId === note.id ? 'var(--bg-hover)' : 'transparent',
                borderRadius: 4,
                cursor: 'pointer',
                transition: 'all 0.1s ease',
              }}
              onMouseEnter={(e) => {
                if (selectedNoteId !== note.id) {
                  e.currentTarget.style.backgroundColor = 'var(--bg-hover)'
                }
              }}
              onMouseLeave={(e) => {
                if (selectedNoteId !== note.id) {
                  e.currentTarget.style.backgroundColor = 'transparent'
                }
              }}
            >
              <FileIcon />
              <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {note.title}
              </span>
            </div>
          ))}
        </>
      )}
    </div>
  )
}

export default function KnowledgeTree({
  notes,
  selectedNoteId,
  onSelectNote,
  searchQuery,
  onSearchChange,
  onNewNote,
}: KnowledgeTreeProps) {
  const tree = buildTreeFromNotes(notes)

  // Default expanded: languages, concepts, checklists at top level
  const defaultExpanded = ['languages', 'concepts', 'checklists']

  return (
    <div
      style={{
        width: 260,
        flexShrink: 0,
        borderRight: '1px solid var(--border)',
        display: 'flex',
        flexDirection: 'column',
        backgroundColor: 'var(--sidebar-bg)',
      }}
    >
      {/* Search */}
      <div style={{ padding: '12px 12px 8px' }}>
        <div
          style={{
            display: 'flex',
            gap: 8,
            padding: '7px 10px',
            backgroundColor: 'var(--input-bg)',
            border: '1px solid var(--border)',
            borderRadius: 6,
            alignItems: 'center',
          }}
        >
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="var(--text-tertiary)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="11" cy="11" r="8" />
            <line x1="21" y1="21" x2="16.65" y2="16.65" />
          </svg>
          <input
            className="font-mono"
            style={{
              border: 'none',
              backgroundColor: 'transparent',
              outline: 'none',
              color: 'var(--text)',
              fontSize: 12,
              width: '100%',
            }}
            placeholder="Search notes..."
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
          />
        </div>
      </div>

      {/* New Note */}
      <div style={{ padding: '4px 12px 8px' }}>
        <button
          onClick={onNewNote}
          className="font-mono"
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            width: '100%',
            padding: '6px 10px',
            background: 'none',
            border: '1px dashed var(--border)',
            borderRadius: 6,
            cursor: 'pointer',
            color: 'var(--text-tertiary)',
            fontSize: 12,
            transition: 'all 0.15s ease',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.borderColor = 'var(--text-secondary)'
            e.currentTarget.style.color = 'var(--text-secondary)'
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.borderColor = 'var(--border)'
            e.currentTarget.style.color = 'var(--text-tertiary)'
          }}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <line x1="12" y1="5" x2="12" y2="19" />
            <line x1="5" y1="12" x2="19" y2="12" />
          </svg>
          New Note
        </button>
      </div>

      {/* Tree */}
      <div style={{ flex: 1, overflow: 'auto', padding: '4px 6px' }}>
        {tree.map((node) => (
          <TreeFolder
            key={node.path}
            node={node}
            depth={0}
            selectedNoteId={selectedNoteId}
            onSelectNote={onSelectNote}
            defaultExpanded={defaultExpanded.includes(node.name)}
          />
        ))}
      </div>
    </div>
  )
}

export { buildTreeFromNotes }
