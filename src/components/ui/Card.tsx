import type { ReactNode } from 'react'

interface CardProps {
  children: ReactNode
  className?: string
  style?: React.CSSProperties
}

export default function Card({ children, className, style }: CardProps) {
  return (
    <div
      className={className}
      style={{
        backgroundColor: 'var(--card-bg)',
        border: '1px solid var(--border)',
        borderRadius: 8,
        overflow: 'hidden',
        ...style,
      }}
    >
      {children}
    </div>
  )
}
