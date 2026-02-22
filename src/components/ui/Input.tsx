import type { InputHTMLAttributes } from 'react'

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {}

export default function Input({ style, ...props }: InputProps) {
  return (
    <input
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
        ...style,
      }}
      {...props}
    />
  )
}
