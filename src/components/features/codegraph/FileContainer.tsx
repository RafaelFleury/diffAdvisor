import type { FileBox } from './layout.ts'
import { FileIcon } from './icons.tsx'
import { MONO, tagColors } from './styles.ts'

interface FileContainerProps {
  box: FileBox
  mode: 'file' | 'function'
  active: boolean
  onOpen: () => void
  onPointerDown: (e: React.PointerEvent) => void
}

export default function FileContainer({ box, mode, active, onOpen, onPointerDown }: FileContainerProps) {
  const ghost = box.scope === 'ghost'
  const tag = tagColors(box.tag)
  let badge: string
  if (mode === 'file') badge = box.level === 0 ? 'entry' : ghost ? `L${box.level} · ghost` : `L${box.level}`
  else badge = ghost ? 'ghost' : tag.label

  return (
    <div
      onPointerDown={onPointerDown}
      style={{
        position: 'absolute',
        left: box.x,
        top: box.y,
        width: box.w,
        height: box.h,
        boxSizing: 'border-box',
        border: `1px ${ghost ? 'dashed' : 'solid'} ${active ? 'var(--text)' : 'var(--border)'}`,
        borderRadius: 10,
        backgroundColor: 'var(--bg-secondary)',
        opacity: ghost ? 0.8 : 1,
        cursor: 'move',
        touchAction: 'none',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 8px 6px 12px' }}>
        <span style={{ width: 6, height: 6, borderRadius: 2, backgroundColor: tag.accent, flexShrink: 0 }} />
        <span
          style={{
            fontFamily: MONO,
            fontSize: 11,
            color: 'var(--text-secondary)',
            flex: 1,
            minWidth: 0,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
        >
          {box.path}
        </span>
        <span style={{ fontFamily: MONO, fontSize: 10, color: 'var(--text-secondary)' }}>{badge}</span>
        <button
          type="button"
          onClick={onOpen}
          aria-label={`Show full file ${box.path}`}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 5,
            height: 24,
            padding: '0 8px',
            backgroundColor: 'var(--bg-tertiary)',
            color: 'var(--text)',
            border: '1px solid var(--border)',
            borderRadius: 5,
            fontFamily: MONO,
            fontSize: 10.5,
            cursor: 'pointer',
          }}
        >
          <FileIcon />
          file
        </button>
      </div>
    </div>
  )
}
