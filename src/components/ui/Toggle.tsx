interface ToggleProps {
  checked: boolean
  onChange: (value: boolean) => void
  label?: string
}

export default function Toggle({ checked, onChange, label }: ToggleProps) {
  return (
    <div style={{ display: 'flex', alignItems: 'center' }}>
      <div
        onClick={() => onChange(!checked)}
        style={{
          width: 38,
          height: 22,
          borderRadius: 11,
          cursor: 'pointer',
          position: 'relative',
          backgroundColor: checked ? 'var(--text)' : 'var(--bg-tertiary)',
          border: `1px solid ${checked ? 'var(--text)' : 'var(--border)'}`,
          transition: 'all 0.2s ease',
          flexShrink: 0,
        }}
      >
        <div
          style={{
            width: 16,
            height: 16,
            borderRadius: 8,
            position: 'absolute',
            top: 2,
            left: checked ? 19 : 2,
            backgroundColor: checked ? 'var(--bg)' : 'var(--text-tertiary)',
            transition: 'all 0.2s ease',
          }}
        />
      </div>
      {label && (
        <span className="font-mono" style={{ fontSize: 11, color: 'var(--text-tertiary)', marginLeft: 8 }}>
          {label}
        </span>
      )}
    </div>
  )
}
