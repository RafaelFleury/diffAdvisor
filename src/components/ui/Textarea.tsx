import type { TextareaHTMLAttributes } from 'react'

interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {}

export default function Textarea({ style, ...props }: TextareaProps) {
  return (
    <textarea
      className="font-mono"
      style={{
        padding: '10px 12px',
        backgroundColor: 'var(--input-bg)',
        border: '1px solid var(--border)',
        borderRadius: 6,
        color: 'var(--text)',
        fontSize: 13,
        lineHeight: 1.6,
        outline: 'none',
        width: '100%',
        fontFamily: "'JetBrains Mono', monospace",
        boxSizing: 'border-box',
        resize: 'vertical',
        ...style,
      }}
      {...props}
    />
  )
}
