import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useCodeGraphStore } from '@/stores/codegraphStore.ts'

const PAGE = 'app/dashboard/page.tsx'
const DB = 'lib/db.ts'
const initial = useCodeGraphStore.getState()

describe('codegraphStore', () => {
  beforeEach(() => {
    useCodeGraphStore.setState(initial, true)
  })

  it('analyzes with the recommended depth and selects the entry function', async () => {
    await useCodeGraphStore.getState().analyze()
    const s = useCodeGraphStore.getState()
    expect(s.graph).not.toBeNull()
    expect(s.depth).toBe(s.graph?.recommendedDepth)
    expect(s.selectedId).toBe(`${PAGE}#DashboardPage`)
  })

  it('expands the depth when a ghost function is selected', async () => {
    useCodeGraphStore.setState({ depth: 3, depthText: '3' })
    await useCodeGraphStore.getState().analyze()
    expect(useCodeGraphStore.getState().graph?.functions.find((f) => f.id === `${DB}#query`)?.scope).toBe('ghost')

    useCodeGraphStore.getState().select(`${DB}#query`)
    await vi.waitFor(() => {
      const s = useCodeGraphStore.getState()
      expect(s.depth).toBe(4)
      expect(s.graph?.functions.find((f) => f.id === `${DB}#query`)?.scope).toBe('in')
    })
  })

  it('keeps a selection history and goes back', async () => {
    await useCodeGraphStore.getState().analyze()
    const { select } = useCodeGraphStore.getState()
    select(`${PAGE}#formatTotal`)
    select('components/OrderTable.tsx#OrderTable')
    expect(useCodeGraphStore.getState().history).toEqual([`${PAGE}#DashboardPage`, `${PAGE}#formatTotal`])
    useCodeGraphStore.getState().back()
    expect(useCodeGraphStore.getState().selectedId).toBe(`${PAGE}#formatTotal`)
  })

  it('keeps drag offsets across re-analysis only for files that still exist', async () => {
    await useCodeGraphStore.getState().analyze()
    useCodeGraphStore.getState().setOffset(PAGE, 20, 10)
    useCodeGraphStore.getState().setOffset('gone/file.ts', 5, 5)
    await useCodeGraphStore.getState().analyze()
    expect(useCodeGraphStore.getState().offsets).toEqual({ [PAGE]: { dx: 20, dy: 10 } })
  })

  it('switching to Function mode uses the selected function as entry', async () => {
    await useCodeGraphStore.getState().analyze()
    useCodeGraphStore.getState().setMode('function')
    await vi.waitFor(() => expect(useCodeGraphStore.getState().graph?.mode).toBe('function'))
    expect(useCodeGraphStore.getState().graph?.entry).toBe(`${PAGE}#DashboardPage`)
  })
})
