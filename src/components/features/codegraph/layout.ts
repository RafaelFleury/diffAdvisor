// Built-in layered layout for the Code Graph (docs/plans/codegraph.md, "Layout algorithm").
// Pure functions only: given a graph and the UI state, return boxes and edge paths in board
// coordinates (unscaled). The canvas applies zoom with a CSS transform.

import type { CodeGraph, ExternalCall, FileTag, GraphFunction, Scope } from '@/types/codegraph.ts'

export const CELL_W = 170
export const CELL_H = 58
export const CELL_H_EXPANDED = 168
export const CELL_GAP_X = 16
export const CELL_GAP_Y = 12
export const GRID_COLS = 2
export const FILE_W = 380
export const FILE_PAD_X = 16
export const FILE_HEADER_H = 40
export const FILE_PAD_BOTTOM = 16
export const COL_GAP = 44
export const ROW_GAP = 46
export const ORIGIN_X = 40
export const ORIGIN_Y = 50
export const CHIP_H = 24
export const CHIP_GAP = 8
export const CHIP_LINE_H = 30
/** Side anchors use the collapsed row center so expanding a cell does not move its edges. */
export const EDGE_ANCHOR_Y = 29
export const MIN_BOARD_W = 880
export const MIN_BOARD_H = 520

// Graph-specific colors (everything else uses var(--…) tokens).
export const HTTP_EDGE = '#b98cff'
export const CALL_EDGE = '#8a8a8a'
export const GHOST_EDGE = '#626262'

export type Offsets = Record<string, { dx: number; dy: number }>

export interface LayoutOptions {
  expanded: Record<string, boolean>
  showExternals: boolean
  offsets: Offsets
}

export interface FileBox {
  id: string
  path: string
  tag: FileTag
  scope: Scope
  level: number | null
  column: number
  x: number
  y: number
  w: number
  h: number
}

export interface CellBox {
  id: string
  fileId: string
  x: number
  y: number
  w: number
  h: number
  expanded: boolean
  scope: Scope
}

export interface ChipBox {
  key: string
  from: string
  x: number
  y: number
  w: number
  text: string
  unresolved: boolean
  pkg: string | null
}

export interface EdgePath {
  key: string
  /** Cell ids (callbacks folded into their parent cell). */
  from: string
  to: string
  kind: 'call' | 'http' | 'render'
  ghost: boolean
  d: string
  ex: number
  ey: number
  /** Midpoint, used for the HTTP pill. */
  mx: number
  my: number
}

export interface ChipEdgePath {
  key: string
  from: string
  unresolved: boolean
  d: string
  ex: number
  ey: number
}

export interface GraphLayout {
  files: FileBox[]
  cells: CellBox[]
  chips: ChipBox[]
  edges: EdgePath[]
  chipEdges: ChipEdgePath[]
  cellById: Record<string, CellBox>
  width: number
  height: number
}

export function chipText(x: ExternalCall): string {
  return x.unresolved ? `? ${x.label}` : `${x.label} · ${x.pkg ?? ''}`
}

export function chipWidth(text: string): number {
  return Math.round(text.length * 6.6 + 22)
}

/** Top-level functions of a file (callbacks are shown inside their parent cell), in source order. */
export function cellFunctions(graph: CodeGraph, fileId: string): GraphFunction[] {
  return graph.functions
    .filter((f) => f.fileId === fileId && f.kind !== 'callback')
    .sort((a, b) => a.startLine - b.startLine)
}

/** Ids of top-level functions whose name contains the query (case-insensitive), in file then source order. */
export function searchMatches(graph: CodeGraph, query: string): string[] {
  const q = query.trim().toLowerCase()
  if (!q) return []
  return graph.files
    .flatMap((f) => cellFunctions(graph, f.id))
    .filter((fn) => fn.name.toLowerCase().includes(q))
    .map((fn) => fn.id)
}

/** Follows parentId links so calls made inside callbacks are drawn from the parent cell. */
export function cellIdFor(graph: CodeGraph, fnId: string): string {
  const byId = new Map(graph.functions.map((f) => [f.id, f]))
  let cur = byId.get(fnId)
  while (cur && cur.parentId) cur = byId.get(cur.parentId)
  return cur ? cur.id : fnId
}

function rowHeights(fns: GraphFunction[], expanded: Record<string, boolean>): number[] {
  const rows: number[] = []
  fns.forEach((fn, i) => {
    const r = Math.floor(i / GRID_COLS)
    const h = expanded[fn.id] ? CELL_H_EXPANDED : CELL_H
    rows[r] = Math.max(rows[r] ?? 0, h)
  })
  return rows
}

function sum(values: number[]): number {
  return values.reduce((a, b) => a + b, 0)
}

function flowChips(texts: string[], startX: number, maxX: number): { x: number; line: number; w: number }[] {
  const out: { x: number; line: number; w: number }[] = []
  let x = startX
  let line = 0
  for (const t of texts) {
    const w = chipWidth(t)
    if (x > startX && x + w > maxX) {
      line++
      x = startX
    }
    out.push({ x, line, w })
    x += w + CHIP_GAP
  }
  return out
}

export function layoutGraph(graph: CodeGraph, opts: LayoutOptions): GraphLayout {
  const byFnId = new Map(graph.functions.map((f) => [f.id, f]))
  const rootId = (id: string) => {
    let cur = byFnId.get(id)
    while (cur && cur.parentId) cur = byFnId.get(cur.parentId)
    return cur ? cur.id : id
  }

  // 1. Column key per file.
  const colKey = new Map<string, number>()
  for (const file of graph.files) {
    if (graph.mode === 'file') {
      colKey.set(file.id, file.level ?? 0)
    } else {
      const ds = cellFunctions(graph, file.id).map((f) => f.distance ?? 0)
      colKey.set(file.id, ds.length ? Math.min(...ds) : 0)
    }
  }
  const keys = [...new Set(colKey.values())].sort((a, b) => a - b)
  const column = new Map([...colKey].map(([id, k]) => [id, keys.indexOf(k)]))

  // 2. Measure files.
  const visibleExternals = opts.showExternals ? graph.externals : []
  const measure = new Map<string, { rows: number[]; rowsTotal: number; chipLines: number; h: number }>()
  for (const file of graph.files) {
    const fns = cellFunctions(graph, file.id)
    const rows = rowHeights(fns, opts.expanded)
    const rowsTotal = sum(rows) + Math.max(0, rows.length - 1) * CELL_GAP_Y
    const ids = new Set(fns.map((f) => f.id))
    const texts = visibleExternals.filter((x) => ids.has(rootId(x.from))).map(chipText)
    const flowed = flowChips(texts, 0, FILE_W - FILE_PAD_X * 2)
    const chipLines = flowed.length ? Math.max(...flowed.map((c) => c.line)) + 1 : 0
    const h = FILE_HEADER_H + rowsTotal + FILE_PAD_BOTTOM + (chipLines ? chipLines * CHIP_LINE_H + 8 : 0)
    measure.set(file.id, { rows, rowsTotal, chipLines, h })
  }

  // 3. Predecessors (imports and edges between files) for barycenter ordering.
  const preds = new Map<string, Set<string>>()
  const addPred = (to: string, from: string) => {
    if (to === from) return
    const s = preds.get(to) ?? new Set<string>()
    s.add(from)
    preds.set(to, s)
  }
  for (const file of graph.files) for (const imp of file.imports) addPred(imp, file.id)
  for (const e of graph.edges) {
    const a = byFnId.get(e.from)
    const b = byFnId.get(e.to)
    if (a && b) addPred(b.fileId, a.fileId)
  }

  // 4. Place column by column.
  const base = new Map<string, { x: number; y: number }>()
  const centerY = new Map<string, number>()
  const columns = keys.map((_, c) => graph.files.filter((f) => column.get(f.id) === c))
  columns.forEach((files, c) => {
    const withBary = files.map((f) => {
      const ys = [...(preds.get(f.id) ?? [])].map((p) => centerY.get(p)).filter((y): y is number => y !== undefined)
      return { f, bary: ys.length ? sum(ys) / ys.length : Infinity }
    })
    withBary.sort((a, b) => a.bary - b.bary || a.f.path.localeCompare(b.f.path))
    let y = ORIGIN_Y
    for (const { f } of withBary) {
      const h = (measure.get(f.id) as { h: number }).h
      base.set(f.id, { x: ORIGIN_X + c * (FILE_W + COL_GAP), y })
      centerY.set(f.id, y + h / 2)
      y += h + ROW_GAP
    }
  })

  // 5. Boxes with drag offsets.
  const files: FileBox[] = []
  const cells: CellBox[] = []
  const chips: ChipBox[] = []
  const cellById: Record<string, CellBox> = {}
  for (const file of graph.files) {
    const m = measure.get(file.id) as { rows: number[]; rowsTotal: number; chipLines: number; h: number }
    const b = base.get(file.id) as { x: number; y: number }
    const o = opts.offsets[file.id] ?? { dx: 0, dy: 0 }
    const box: FileBox = {
      id: file.id,
      path: file.path,
      tag: file.tag,
      scope: file.scope,
      level: file.level,
      column: column.get(file.id) ?? 0,
      x: b.x + o.dx,
      y: b.y + o.dy,
      w: FILE_W,
      h: m.h,
    }
    files.push(box)

    const fns = cellFunctions(graph, file.id)
    fns.forEach((fn, i) => {
      const r = Math.floor(i / GRID_COLS)
      const c = i % GRID_COLS
      const expanded = !!opts.expanded[fn.id]
      const cell: CellBox = {
        id: fn.id,
        fileId: file.id,
        x: box.x + FILE_PAD_X + c * (CELL_W + CELL_GAP_X),
        y: box.y + FILE_HEADER_H + sum(m.rows.slice(0, r)) + r * CELL_GAP_Y,
        w: CELL_W,
        h: expanded ? CELL_H_EXPANDED : CELL_H,
        expanded,
        scope: fn.scope,
      }
      cells.push(cell)
      cellById[fn.id] = cell
    })

    const ids = new Set(fns.map((f) => f.id))
    const ext = visibleExternals.filter((x) => ids.has(rootId(x.from)))
    const startX = box.x + FILE_PAD_X
    const flowed = flowChips(ext.map(chipText), startX, box.x + FILE_W - FILE_PAD_X)
    const chipTop = box.y + FILE_HEADER_H + m.rowsTotal + 14
    ext.forEach((x, i) => {
      chips.push({
        key: `${x.from}|${x.label}|${x.line}`,
        from: rootId(x.from),
        x: flowed[i].x,
        y: chipTop + flowed[i].line * CHIP_LINE_H,
        w: flowed[i].w,
        text: chipText(x),
        unresolved: x.unresolved,
        pkg: x.pkg,
      })
    })
  }

  // 6. Edges between cells.
  const edges: EdgePath[] = []
  const seen = new Set<string>()
  for (const e of graph.edges) {
    const fromId = rootId(e.from)
    const toId = rootId(e.to)
    const A = cellById[fromId]
    const B = cellById[toId]
    if (!A || !B) continue
    const key = `${fromId}>${toId}|${e.kind}`
    if (seen.has(key)) continue
    seen.add(key)
    if (fromId === toId && e.from !== e.to) continue // call between a callback and its own parent
    const ghost = A.scope === 'ghost' || B.scope === 'ghost'
    edges.push({ key, from: fromId, to: toId, kind: e.kind, ghost, ...edgeGeometry(A, B) })
  }

  // 7. Edges from cells to their external chips.
  const chipEdges: ChipEdgePath[] = chips
    .filter((c) => cellById[c.from])
    .map((c) => {
      const A = cellById[c.from]
      const sx = A.x + A.w / 2
      const sy = A.y + A.h
      const ex = c.x + c.w / 2
      const ey = c.y
      const my = (sy + ey) / 2
      return { key: c.key, from: c.from, unresolved: c.unresolved, d: `M${sx} ${sy} C${sx} ${my}, ${ex} ${my}, ${ex} ${ey}`, ex, ey }
    })

  const width = Math.max(MIN_BOARD_W, ...files.map((f) => f.x + f.w + 40))
  const height = Math.max(MIN_BOARD_H, ...files.map((f) => f.y + f.h + 40))
  return { files, cells, chips, edges, chipEdges, cellById, width, height }
}

/** Anchors and bezier for an edge between two cells (docs/plans/codegraph.md, "Edges"). */
export function edgeGeometry(A: CellBox, B: CellBox): { d: string; ex: number; ey: number; mx: number; my: number } {
  if (A.id === B.id) {
    // Recursion: a loop on the right side of the cell.
    const x = A.x + A.w
    const y1 = A.y + 18
    const y2 = A.y + 42
    return { d: `M${x} ${y1} C${x + 40} ${y1 - 18}, ${x + 40} ${y2 + 18}, ${x} ${y2}`, ex: x, ey: y2, mx: x + 30, my: (y1 + y2) / 2 }
  }
  let sx: number, sy: number, ex: number, ey: number, d: string
  if (Math.abs(A.x - B.x) < 5 && A.fileId !== B.fileId) {
    sx = A.x
    sy = A.y + EDGE_ANCHOR_Y
    ex = B.x
    ey = B.y + EDGE_ANCHOR_Y
    const o = 18 + Math.abs(ey - sy) / 14
    d = `M${sx} ${sy} C${sx - o} ${sy}, ${ex - o} ${ey}, ${ex} ${ey}`
  } else if (B.x >= A.x + A.w) {
    sx = A.x + A.w
    sy = A.y + EDGE_ANCHOR_Y
    ex = B.x
    ey = B.y + EDGE_ANCHOR_Y
    const mx = (sx + ex) / 2
    d = `M${sx} ${sy} C${mx} ${sy}, ${mx} ${ey}, ${ex} ${ey}`
  } else if (A.x >= B.x + B.w) {
    sx = A.x
    sy = A.y + EDGE_ANCHOR_Y
    ex = B.x + B.w
    ey = B.y + EDGE_ANCHOR_Y
    const mx = (sx + ex) / 2
    d = `M${sx} ${sy} C${mx} ${sy}, ${mx} ${ey}, ${ex} ${ey}`
  } else {
    const down = B.y > A.y
    sx = A.x + A.w / 2
    sy = down ? A.y + A.h : A.y
    ex = B.x + B.w / 2
    ey = down ? B.y : B.y + B.h
    const my = (sy + ey) / 2
    d = `M${sx} ${sy} C${sx} ${my}, ${ex} ${my}, ${ex} ${ey}`
  }
  return { d, ex, ey, mx: (sx + ex) / 2, my: (sy + ey) / 2 }
}
