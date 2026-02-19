import type { CommitStatus, Severity } from '@/types/index.ts'

type BadgeVariant = CommitStatus | Severity

interface BadgeProps {
  variant: BadgeVariant
  children: React.ReactNode
}

const variantStyles: Record<BadgeVariant, { bg: string; color: string }> = {
  pending: { bg: 'var(--badge-pending)', color: 'var(--badge-pending-text)' },
  reviewed: { bg: 'var(--badge-reviewed)', color: 'var(--badge-reviewed-text)' },
  critical: { bg: 'var(--critical-bg)', color: 'var(--critical)' },
  warning: { bg: 'var(--warning-bg)', color: 'var(--warning)' },
  info: { bg: 'var(--info-bg)', color: 'var(--info)' },
}

export default function Badge({ variant, children }: BadgeProps) {
  const style = variantStyles[variant]
  return (
    <span
      className="font-mono"
      style={{
        fontSize: 11,
        padding: '3px 10px',
        borderRadius: 99,
        backgroundColor: style.bg,
        color: style.color,
        whiteSpace: 'nowrap',
      }}
    >
      {children}
    </span>
  )
}
