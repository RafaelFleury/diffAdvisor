interface SpinnerProps {
  size?: number
  message?: string
}

export default function Spinner({ size = 18, message }: SpinnerProps) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10 }}>
      <div
        style={{
          width: size,
          height: size,
          border: '2px solid var(--border)',
          borderTopColor: 'var(--text-secondary)',
          borderRadius: '50%',
          animation: 'spin 0.6s linear infinite',
        }}
      />
      {message && (
        <span className="font-mono" style={{ fontSize: 13, color: 'var(--text-tertiary)' }}>
          {message}
        </span>
      )}
    </div>
  )
}
