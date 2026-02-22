import type { ReactNode } from 'react'

interface EmptyStateProps {
  icon?: ReactNode
  message: string
  action?: ReactNode
}

export default function EmptyState({ icon, message, action }: EmptyStateProps) {
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 12,
        padding: '40px 20px',
        color: 'var(--text-tertiary)',
      }}
    >
      {icon && <div>{icon}</div>}
      <span className="font-mono" style={{ fontSize: 13 }}>
        {message}
      </span>
      {action && <div style={{ marginTop: 4 }}>{action}</div>}
    </div>
  )
}
