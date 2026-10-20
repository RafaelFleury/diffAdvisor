import Button from '@/components/ui/Button.tsx'

interface DebriefProgressProps {
  steps: string[]
  onCancel: () => void
}

const VISIBLE_STEPS = 12

export default function DebriefProgress({ steps, onCancel }: DebriefProgressProps) {
  const visible = steps.slice(-VISIBLE_STEPS)
  const hidden = steps.length - visible.length

  return (
    <div className="font-mono" style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
        <span style={{ fontSize: 13, color: 'var(--text-secondary)' }}>Analyzing commit...</span>
        <Button variant="secondary" size="sm" onClick={onCancel}>
          Cancel
        </Button>
      </div>
      {steps.length > 0 && (
        <ul
          style={{
            listStyle: 'none',
            margin: 0,
            padding: 0,
            display: 'flex',
            flexDirection: 'column',
            gap: 6,
            fontSize: 12,
            color: 'var(--text-tertiary)',
          }}
        >
          {hidden > 0 && <li>... {hidden} earlier steps</li>}
          {visible.map((step, i) => (
            <li
              key={hidden + i}
              style={{
                color: i === visible.length - 1 ? 'var(--text-secondary)' : undefined,
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}
            >
              {step}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
