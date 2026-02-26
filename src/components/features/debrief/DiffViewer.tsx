import { useEffect, useState } from 'react'
import type { FileDiff } from '@/types/index.ts'

interface DiffViewerProps {
  files: FileDiff[]
}

export default function DiffViewer({ files }: DiffViewerProps) {
  const [activeFileIdx, setActiveFileIdx] = useState(0)

  useEffect(() => {
    if (files.length === 0) {
      setActiveFileIdx(0)
      return
    }

    setActiveFileIdx((idx) => Math.min(idx, files.length - 1))
  }, [files])

  const activeFile = files[activeFileIdx]

  if (!activeFile) {
    return (
      <div
        className="font-mono"
        style={{
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: 13,
          color: 'var(--text-tertiary)',
        }}
      >
        No diff content
      </div>
    )
  }

  const lines = activeFile.diff.split('\n')
  let lineNumber = 0

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', backgroundColor: 'var(--code-bg)' }}>
      {/* File tabs */}
      <div
        style={{
          display: 'flex',
          borderBottom: '1px solid var(--border)',
          overflowX: 'auto',
          flexShrink: 0,
        }}
      >
        {files.map((file, idx) => (
          <button
            key={file.fileName}
            onClick={() => setActiveFileIdx(idx)}
            className="font-mono"
            style={{
              padding: '8px 16px',
              fontSize: 12,
              border: 'none',
              borderBottom: idx === activeFileIdx ? '2px solid var(--text)' : '2px solid transparent',
              background: idx === activeFileIdx ? 'var(--bg-secondary)' : 'transparent',
              color: idx === activeFileIdx ? 'var(--text)' : 'var(--text-tertiary)',
              cursor: 'pointer',
              whiteSpace: 'nowrap',
              display: 'flex',
              alignItems: 'center',
              gap: 8,
            }}
          >
            <span>{file.fileName}</span>
            <span style={{ fontSize: 10, opacity: 0.7 }}>
              <span style={{ color: 'var(--diff-add-text)' }}>+{file.additions}</span>
              {' '}
              <span style={{ color: 'var(--diff-del-text)' }}>-{file.deletions}</span>
            </span>
          </button>
        ))}
      </div>

      {/* Active file diff */}
      <div style={{ flex: 1, overflow: 'auto' }}>
        {/* File header bar */}
        <div
          style={{
            padding: '10px 0',
            borderBottom: '1px solid var(--border)',
            position: 'sticky',
            top: 0,
            backgroundColor: 'var(--code-bg)',
            zIndex: 1,
          }}
        >
          <div
            style={{
              padding: '0 16px',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
            }}
          >
            <span className="font-mono" style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
              {activeFile.fileName}
            </span>
            <div className="font-mono" style={{ fontSize: 11, display: 'flex', gap: 8 }}>
              <span style={{ color: 'var(--diff-add-text)' }}>+{activeFile.additions}</span>
              <span style={{ color: 'var(--diff-del-text)' }}>-{activeFile.deletions}</span>
            </div>
          </div>
        </div>

        {/* Diff lines */}
        <div style={{ padding: '4px 0' }}>
          {lines.map((line, idx) => {
            const isAdd = line.startsWith('+')
            const isDel = line.startsWith('-')
            const isHunk = line.startsWith('@@')
            const isContext = !isAdd && !isDel && !isHunk

            if (isContext || isAdd) lineNumber++
            const displayLineNum = isHunk ? '' : isDel ? '' : lineNumber

            let bg = 'transparent'
            let textColor = 'var(--text-secondary)'
            let borderColor = 'transparent'

            if (isAdd) {
              bg = 'var(--diff-add)'
              textColor = 'var(--diff-add-text)'
              borderColor = 'var(--diff-add-border)'
            } else if (isDel) {
              bg = 'var(--diff-del)'
              textColor = 'var(--diff-del-text)'
              borderColor = 'var(--diff-del-border)'
            } else if (isHunk) {
              textColor = 'var(--info)'
            }

            return (
              <div
                key={idx}
                style={{
                  borderLeft: `3px solid ${borderColor}`,
                  padding: '1px 12px 1px 8px',
                  display: 'flex',
                  gap: 12,
                  backgroundColor: bg,
                }}
              >
                <span
                  className="font-mono"
                  style={{
                    color: 'var(--text-tertiary)',
                    userSelect: 'none',
                    minWidth: 28,
                    textAlign: 'right',
                    fontSize: 11,
                    lineHeight: '22px',
                  }}
                >
                  {displayLineNum}
                </span>
                <pre
                  className="font-mono"
                  style={{
                    margin: 0,
                    whiteSpace: 'pre-wrap',
                    wordBreak: 'break-all',
                    fontSize: 12.5,
                    lineHeight: '22px',
                    color: textColor,
                  }}
                >
                  {line}
                </pre>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
