import type { ButtonHTMLAttributes, ReactNode } from 'react'

type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger'
type ButtonSize = 'sm' | 'md' | 'lg'

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant
  size?: ButtonSize
  loading?: boolean
  icon?: ReactNode
}

const sizeStyles: Record<ButtonSize, React.CSSProperties> = {
  sm: { padding: '4px 10px', fontSize: 11 },
  md: { padding: '7px 16px', fontSize: 12 },
  lg: { padding: '9px 20px', fontSize: 13 },
}

function getVariantStyles(variant: ButtonVariant, disabled: boolean): React.CSSProperties {
  const base: React.CSSProperties = {
    border: 'none',
    cursor: disabled ? 'not-allowed' : 'pointer',
    opacity: disabled ? 0.5 : 1,
    transition: 'all 0.15s ease',
  }

  switch (variant) {
    case 'primary':
      return { ...base, backgroundColor: 'var(--text)', color: 'var(--bg)', fontWeight: 500 }
    case 'secondary':
      return { ...base, backgroundColor: 'var(--bg-tertiary)', color: 'var(--text-secondary)', border: '1px solid var(--border)' }
    case 'ghost':
      return { ...base, backgroundColor: 'transparent', color: 'var(--text-secondary)' }
    case 'danger':
      return { ...base, backgroundColor: 'var(--critical)', color: '#fff', fontWeight: 500 }
  }
}

export default function Button({
  variant = 'secondary',
  size = 'md',
  loading = false,
  icon,
  children,
  disabled,
  style,
  ...props
}: ButtonProps) {
  const isDisabled = disabled || loading

  return (
    <button
      className="font-mono"
      disabled={isDisabled}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 6,
        borderRadius: 6,
        whiteSpace: 'nowrap',
        fontFamily: "'JetBrains Mono', monospace",
        ...sizeStyles[size],
        ...getVariantStyles(variant, isDisabled),
        ...style,
      }}
      {...props}
    >
      {loading ? (
        <span style={{ display: 'inline-block', width: 12, height: 12, border: '2px solid currentColor', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 0.6s linear infinite' }} />
      ) : icon ? (
        icon
      ) : null}
      {children}
    </button>
  )
}
