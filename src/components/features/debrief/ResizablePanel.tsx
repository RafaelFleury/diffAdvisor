import { useState, useCallback, useEffect, useRef, type ReactNode } from 'react'

interface ResizablePanelProps {
  left: ReactNode
  right: ReactNode
  defaultPosition?: number
  minPosition?: number
  maxPosition?: number
}

export default function ResizablePanel({
  left,
  right,
  defaultPosition = 55,
  minPosition = 30,
  maxPosition = 75,
}: ResizablePanelProps) {
  const [dividerPos, setDividerPos] = useState(defaultPosition)
  const dragging = useRef(false)
  const containerRef = useRef<HTMLDivElement>(null)

  const handleMouseDown = useCallback(() => {
    dragging.current = true
    document.body.style.cursor = 'col-resize'
    document.body.style.userSelect = 'none'
  }, [])

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!dragging.current || !containerRef.current) return
      const rect = containerRef.current.getBoundingClientRect()
      const pct = ((e.clientX - rect.left) / rect.width) * 100
      setDividerPos(Math.min(maxPosition, Math.max(minPosition, pct)))
    }

    const handleMouseUp = () => {
      dragging.current = false
      document.body.style.cursor = ''
      document.body.style.userSelect = ''
    }

    document.addEventListener('mousemove', handleMouseMove)
    document.addEventListener('mouseup', handleMouseUp)
    return () => {
      document.removeEventListener('mousemove', handleMouseMove)
      document.removeEventListener('mouseup', handleMouseUp)
    }
  }, [minPosition, maxPosition])

  return (
    <div ref={containerRef} style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
      <div style={{ width: `${dividerPos}%`, overflow: 'hidden' }}>
        {left}
      </div>

      <div
        onMouseDown={handleMouseDown}
        style={{
          width: 5,
          cursor: 'col-resize',
          backgroundColor: 'var(--border)',
          flexShrink: 0,
          zIndex: 10,
          transition: 'background-color 0.1s ease',
        }}
        onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = 'var(--text-tertiary)' }}
        onMouseLeave={(e) => {
          if (!dragging.current) e.currentTarget.style.backgroundColor = 'var(--border)'
        }}
      />

      <div style={{ width: `${100 - dividerPos}%`, overflow: 'auto' }}>
        {right}
      </div>
    </div>
  )
}
