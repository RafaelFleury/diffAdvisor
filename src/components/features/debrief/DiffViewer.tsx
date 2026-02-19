interface DiffViewerProps {
  diff: string
  fileName: string
  additions: number
  deletions: number
}

export default function DiffViewer({ diff, fileName, additions, deletions }: DiffViewerProps) {
  const lines = diff.split('\n')
  let lineNumber = 0

  return (
    <div style={{ height: '100%', overflow: 'auto', backgroundColor: 'var(--code-bg)' }}>
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
            {fileName}
          </span>
          <div className="font-mono" style={{ fontSize: 11, display: 'flex', gap: 8 }}>
            <span style={{ color: 'var(--diff-add-text)' }}>+{additions}</span>
            <span style={{ color: 'var(--diff-del-text)' }}>-{deletions}</span>
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
  )
}
