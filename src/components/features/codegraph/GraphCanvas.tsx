import { useEffect, useMemo, useRef } from 'react'
import type { CodeGraph } from '@/types/codegraph.ts'
import { useCodeGraphStore } from '@/stores/codegraphStore.ts'
import type { GraphLayout } from './layout.ts'
import { searchMatches } from './layout.ts'
import FileContainer from './FileContainer.tsx'
import FunctionCell from './FunctionCell.tsx'
import GraphEdges from './GraphEdges.tsx'
import { MONO, tagColors } from './styles.ts'

interface GraphCanvasProps {
  graph: CodeGraph
  layout: GraphLayout
  scrollRef: React.RefObject<HTMLDivElement | null>
}

const DRAG_THRESHOLD = 4

export default function GraphCanvas({ graph, layout, scrollRef }: GraphCanvasProps) {
  const selectedId = useCodeGraphStore((s) => s.selectedId)
  const zoom = useCodeGraphStore((s) => s.zoom)
  const query = useCodeGraphStore((s) => s.query)
  const panelTab = useCodeGraphStore((s) => s.panelTab)
  const fileTabId = useCodeGraphStore((s) => s.fileTabId)
  const select = useCodeGraphStore((s) => s.select)
  const openFile = useCodeGraphStore((s) => s.openFile)
  const toggleExpanded = useCodeGraphStore((s) => s.toggleExpanded)
  const setOffset = useCodeGraphStore((s) => s.setOffset)
  const setZoom = useCodeGraphStore((s) => s.setZoom)

  /** True between a drag that moved and the click event that follows it. */
  const draggedRef = useRef(false)

  const fnById = useMemo(() => new Map(graph.functions.map((f) => [f.id, f])), [graph])
  const tagByFile = useMemo(() => new Map(graph.files.map((f) => [f.id, f.tag])), [graph])

  const related = useMemo(() => {
    const set = new Set<string>()
    if (!selectedId) return set
    for (const e of layout.edges) {
      if (e.from === selectedId) set.add(e.to)
      if (e.to === selectedId) set.add(e.from)
    }
    return set
  }, [layout, selectedId])

  const q = query.trim().toLowerCase()
  const hits = useMemo(() => new Set(searchMatches(graph, q)), [graph, q])

  // Ctrl/Cmd + wheel zoom. Native listener because React wheel listeners are passive.
  useEffect(() => {
    const el = scrollRef.current
    if (!el) return
    const onWheel = (ev: WheelEvent) => {
      if (!(ev.ctrlKey || ev.metaKey)) return
      ev.preventDefault()
      const { zoom: z, setZoom: apply } = useCodeGraphStore.getState()
      apply(z * (ev.deltaY < 0 ? 1.1 : 0.9))
    }
    el.addEventListener('wheel', onWheel, { passive: false })
    return () => el.removeEventListener('wheel', onWheel)
  }, [scrollRef, setZoom])

  function startDrag(fileId: string, e: React.PointerEvent) {
    e.stopPropagation()
    if (e.button !== 0) return
    const startX = e.clientX
    const startY = e.clientY
    const base = useCodeGraphStore.getState().offsets[fileId] ?? { dx: 0, dy: 0 }
    const scale = useCodeGraphStore.getState().zoom
    let moved = false
    draggedRef.current = false
    const onMove = (ev: PointerEvent) => {
      const dx = (ev.clientX - startX) / scale
      const dy = (ev.clientY - startY) / scale
      if (!moved && Math.abs(dx) + Math.abs(dy) < DRAG_THRESHOLD) return
      moved = true
      draggedRef.current = true
      setOffset(fileId, base.dx + dx, base.dy + dy)
    }
    const onUp = () => {
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
      // The click that follows a drag is dispatched before this timeout runs.
      setTimeout(() => {
        draggedRef.current = false
      }, 0)
    }
    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
  }

  function startPan(e: React.PointerEvent) {
    const el = scrollRef.current
    if (!el || e.button !== 0) return
    const startX = e.clientX
    const startY = e.clientY
    const left = el.scrollLeft
    const top = el.scrollTop
    const onMove = (ev: PointerEvent) => {
      el.scrollLeft = left - (ev.clientX - startX)
      el.scrollTop = top - (ev.clientY - startY)
    }
    const onUp = () => {
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
    }
    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
  }

  const unlessDragged = (fn: () => void) => () => {
    if (draggedRef.current) return
    fn()
  }

  return (
    <div
      ref={scrollRef}
      onPointerDown={startPan}
      style={{
        overflow: 'auto',
        flex: 1,
        minHeight: 420,
        cursor: 'grab',
        touchAction: 'none',
        backgroundColor: 'var(--bg)',
        backgroundImage: 'radial-gradient(var(--border-light) 1px, transparent 1px)',
        backgroundSize: '20px 20px',
      }}
    >
      <div style={{ position: 'relative', width: layout.width * zoom, height: layout.height * zoom, margin: '28px auto' }}>
        <div
          style={{
            position: 'absolute',
            left: 0,
            top: 0,
            width: layout.width,
            height: layout.height,
            transform: `scale(${zoom})`,
            transformOrigin: '0 0',
          }}
        >
          {layout.files.map((box) => (
            <FileContainer
              key={box.id}
              box={box}
              mode={graph.mode}
              active={panelTab === 'file' && fileTabId === box.id}
              onOpen={unlessDragged(() => openFile(box.id))}
              onPointerDown={(e) => startDrag(box.id, e)}
            />
          ))}

          <GraphEdges
            edges={layout.edges}
            chipEdges={layout.chipEdges}
            selectedId={selectedId}
            width={layout.width}
            height={layout.height}
          />

          {layout.chips.map((c) => (
            <span
              key={c.key}
              title={c.unresolved ? 'Dynamic call the analyzer could not resolve' : `Call outside the project (${c.pkg})`}
              style={{
                position: 'absolute',
                left: c.x,
                top: c.y,
                width: c.w,
                height: 24,
                boxSizing: 'border-box',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                border: `1px ${c.unresolved ? 'dashed' : 'solid'} ${c.unresolved ? 'var(--text-secondary)' : 'var(--border)'}`,
                borderRadius: 999,
                backgroundColor: 'var(--bg)',
                fontFamily: MONO,
                fontSize: 10.5,
                color: c.unresolved ? 'var(--text)' : 'var(--text-secondary)',
                whiteSpace: 'nowrap',
                opacity: q ? 0.35 : 1,
              }}
            >
              {c.text}
            </span>
          ))}

          {layout.cells.map((box) => {
            const fn = fnById.get(box.id)
            if (!fn) return null
            const callbackLabels = fn.callbackIds.map((id) => fnById.get(id)?.name).filter((n): n is string => !!n)
            return (
              <FunctionCell
                key={box.id}
                fn={fn}
                box={box}
                accent={tagColors(tagByFile.get(fn.fileId) ?? null).accent}
                callbackLabels={callbackLabels}
                selected={fn.id === selectedId}
                related={related.has(fn.id)}
                searchActive={!!q}
                searchHit={hits.has(fn.id)}
                onSelect={unlessDragged(() => select(fn.id))}
                onToggle={unlessDragged(() => toggleExpanded(fn.id))}
                onPointerDown={(e) => startDrag(fn.fileId, e)}
              />
            )
          })}

          {layout.cells.length === 0 && (
            <div style={{ position: 'absolute', left: 40, top: 50, fontFamily: MONO, fontSize: 13, color: 'var(--text-tertiary)' }}>
              No functions in scope. Increase the depth or pick another entry.
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
