import type { Commit } from '@/types/index.ts'
import Badge from './Badge.tsx'
import { useState } from 'react'

interface CommitCardProps {
  commit: Commit
  onClick?: () => void
}

const GitCommitIcon = ({ color }: { color: string }) => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="4" />
    <line x1="1.05" y1="12" x2="7" y2="12" />
    <line x1="17.01" y1="12" x2="22.96" y2="12" />
  </svg>
)

const CheckIcon = ({ color }: { color: string }) => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="20,6 9,17 4,12" />
  </svg>
)

export default function CommitCard({ commit, onClick }: CommitCardProps) {
  const [hovered, setHovered] = useState(false)
  const isPending = commit.status === 'pending'

  return (
    <div
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        backgroundColor: hovered ? 'var(--bg-secondary)' : 'var(--card-bg)',
        border: `1px solid ${hovered ? 'var(--text-tertiary)' : 'var(--border)'}`,
        borderRadius: 8,
        padding: '14px 18px',
        display: 'flex',
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        cursor: onClick ? 'pointer' : 'default',
        opacity: isPending ? 1 : 0.7,
        transition: 'all 0.15s ease',
        ...(hovered && !isPending ? { opacity: 1 } : {}),
      }}
    >
      {/* Left side */}
      <div style={{ display: 'flex', flexDirection: 'row', alignItems: 'flex-start', gap: 12 }}>
        {isPending ? (
          <GitCommitIcon color="var(--warning)" />
        ) : (
          <CheckIcon color="var(--success)" />
        )}
        <div>
          <div
            className="font-mono"
            style={{
              fontSize: 13,
              fontWeight: 500,
              color: 'var(--text)',
            }}
          >
            {commit.message}
          </div>
          <div
            className="font-mono"
            style={{
              fontSize: 11,
              color: 'var(--text-tertiary)',
              marginTop: 4,
            }}
          >
            {commit.hash} · {commit.timestamp} · {commit.filesChanged} files ·{' '}
            <span style={{ color: 'var(--diff-add-text)' }}>+{commit.additions}</span>{' '}
            <span style={{ color: 'var(--diff-del-text)' }}>-{commit.deletions}</span>
          </div>
        </div>
      </div>

      {/* Right side */}
      <Badge variant={commit.status}>{commit.status}</Badge>
    </div>
  )
}
