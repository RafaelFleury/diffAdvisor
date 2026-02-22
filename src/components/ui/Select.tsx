import type { SelectHTMLAttributes } from 'react'

interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {}

export default function Select({ style, children, ...props }: SelectProps) {
  return (
    <select
      className="font-mono"
      style={{
        padding: '8px 12px',
        backgroundColor: 'var(--input-bg)',
        border: '1px solid var(--border)',
        borderRadius: 6,
        color: 'var(--text)',
        fontSize: 13,
        outline: 'none',
        width: '100%',
        fontFamily: "'JetBrains Mono', monospace",
        boxSizing: 'border-box',
        appearance: 'none' as const,
        backgroundImage: `url("data:image/svg+xml,%3Csvg width='10' height='6' viewBox='0 0 10 6' fill='none' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M1 1l4 4 4-4' stroke='%23737373' stroke-width='1.5' stroke-linecap='round' stroke-linejoin='round'/%3E%3C/svg%3E")`,
        backgroundRepeat: 'no-repeat',
        backgroundPosition: 'right 12px center',
        paddingRight: 32,
        ...style,
      }}
      {...props}
    >
      {children}
    </select>
  )
}
