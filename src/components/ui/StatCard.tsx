interface StatCardProps {
  label: string
  value: number
  color: string
}

export default function StatCard({ label, value, color }: StatCardProps) {
  return (
    <div
      style={{
        backgroundColor: 'var(--card-bg)',
        border: '1px solid var(--border)',
        borderRadius: 8,
        padding: '18px 20px',
      }}
    >
      <div
        className="font-mono"
        style={{
          fontSize: 11,
          textTransform: 'uppercase',
          letterSpacing: '0.06em',
          color: 'var(--text-tertiary)',
          marginBottom: 8,
        }}
      >
        {label}
      </div>
      <div
        className="font-mono"
        style={{
          fontSize: 28,
          fontWeight: 700,
          color,
        }}
      >
        {value}
      </div>
    </div>
  )
}
