import { useState, type ReactNode } from 'react'

interface CollapsibleSectionProps {
  title: string
  icon: ReactNode
  defaultExpanded?: boolean
  children: ReactNode
}

export default function CollapsibleSection({
  title,
  icon,
  defaultExpanded = true,
  children,
}: CollapsibleSectionProps) {
  const [expanded, setExpanded] = useState(defaultExpanded)

  return (
    <div style={{ marginBottom: 16 }}>
      <button
        onClick={() => setExpanded(!expanded)}
        style={{
          display: 'flex',
          flexDirection: 'row',
          alignItems: 'center',
          gap: 8,
          width: '100%',
          padding: '8px 0',
          background: 'none',
          border: 'none',
          cursor: 'pointer',
          color: 'var(--text)',
          fontSize: 13,
          fontWeight: 600,
          fontFamily: "'JetBrains Mono', monospace",
          textAlign: 'left',
        }}
      >
        {/* Chevron */}
        <svg
          width="14"
          height="14"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          style={{
            transform: expanded ? 'rotate(0deg)' : 'rotate(-90deg)',
            transition: 'transform 0.15s ease',
            flexShrink: 0,
          }}
        >
          <polyline points="6,9 12,15 18,9" />
        </svg>
        {icon}
        {title}
      </button>
      {expanded && <div style={{ paddingLeft: 4, paddingTop: 4 }}>{children}</div>}
    </div>
  )
}
