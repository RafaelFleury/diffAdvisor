import { describe, expect, it } from 'vitest'
import { analyzeSample } from '@/services/codegraph/mock.ts'
import {
  CELL_H,
  CELL_H_EXPANDED,
  COL_GAP,
  FILE_W,
  ORIGIN_X,
  cellIdFor,
  edgeGeometry,
  layoutGraph,
  searchMatches,
} from '../layout.ts'

const PAGE = 'app/dashboard/page.tsx'
const TABLE = 'components/OrderTable.tsx'
const DB = 'lib/db.ts'

function graph(depth = 3) {
  return analyzeSample('p', { mode: 'file', entry: null, depth, maxNodes: 200 })
}

const noState = { expanded: {}, showExternals: true, offsets: {} }

describe('layoutGraph', () => {
  it('places files in columns by import level', () => {
    const layout = layoutGraph(graph(), noState)
    const x = (id: string) => layout.files.find((f) => f.id === id)?.x
    expect(x(PAGE)).toBe(ORIGIN_X)
    expect(x(TABLE)).toBe(ORIGIN_X + FILE_W + COL_GAP)
    // lib/db.ts is level 4 with depth 3: a ghost in the fifth column.
    const db = layout.files.find((f) => f.id === DB)
    expect(db?.scope).toBe('ghost')
    expect(db?.column).toBe(4)
  })

  it('grows the row and the file when a cell is expanded', () => {
    const g = graph()
    const collapsed = layoutGraph(g, noState)
    const expanded = layoutGraph(g, { ...noState, expanded: { [`${PAGE}#DashboardPage`]: true } })
    expect(collapsed.cellById[`${PAGE}#DashboardPage`].h).toBe(CELL_H)
    expect(expanded.cellById[`${PAGE}#DashboardPage`].h).toBe(CELL_H_EXPANDED)
    const h = (l: typeof collapsed) => l.files.find((f) => f.id === PAGE)?.h ?? 0
    expect(h(expanded) - h(collapsed)).toBe(CELL_H_EXPANDED - CELL_H)
  })

  it('draws calls made inside callbacks from the parent cell', () => {
    const g = graph()
    const layout = layoutGraph(g, noState)
    const edge = layout.edges.find((e) => e.to === `${TABLE}#StatusBadge`)
    expect(edge?.from).toBe(`${TABLE}#OrderTable`)
    const callback = g.functions.find((f) => f.kind === 'callback' && f.fileId === TABLE)
    expect(callback && cellIdFor(g, callback.id)).toBe(`${TABLE}#OrderTable`)
  })

  it('adds external chips only when externals are shown', () => {
    const g = graph()
    expect(layoutGraph(g, noState).chips.some((c) => c.text === 'fetch · web')).toBe(true)
    expect(layoutGraph(g, { ...noState, showExternals: false }).chips).toHaveLength(0)
  })

  it('keeps the unresolved call marked as such', () => {
    const chip = layoutGraph(graph(), noState).chips.find((c) => c.unresolved)
    expect(chip?.text.startsWith('?')).toBe(true)
  })

  it('applies drag offsets to the file and its cells', () => {
    const g = graph()
    const a = layoutGraph(g, noState)
    const b = layoutGraph(g, { ...noState, offsets: { [PAGE]: { dx: 30, dy: -10 } } })
    expect(b.cellById[`${PAGE}#formatTotal`].x - a.cellById[`${PAGE}#formatTotal`].x).toBe(30)
    expect(b.cellById[`${PAGE}#formatTotal`].y - a.cellById[`${PAGE}#formatTotal`].y).toBe(-10)
  })

  it('anchors edges on facing sides', () => {
    const A = { id: 'a', fileId: 'f1', x: 0, y: 0, w: 170, h: 58, expanded: false, scope: 'in' as const }
    const B = { ...A, id: 'b', fileId: 'f2', x: 400, y: 100 }
    const g = edgeGeometry(A, B)
    expect(g.d.startsWith('M170 29')).toBe(true)
    expect([g.ex, g.ey]).toEqual([400, 129])
  })
})

describe('searchMatches', () => {
  it('matches top-level functions case-insensitively', () => {
    expect(searchMatches(graph(), 'ORDER').map((id) => id.split('#')[1]).sort()).toEqual(['OrderTable', 'fetchOrders', 'listOrders'])
  })
})
