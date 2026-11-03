import { beforeEach, describe, expect, it, vi } from 'vitest'
import { explanationKey, useCodeGraphStore } from '@/stores/codegraphStore.ts'
import { useProjectStore } from '@/stores/projectStore.ts'
import { codeGraphService } from '@/services/codegraph/index.ts'
import type { Project } from '@/types/index.ts'

const PAGE = 'app/dashboard/page.tsx'
const DB = 'lib/db.ts'
const initial = useCodeGraphStore.getState()

describe('codegraphStore', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
    useCodeGraphStore.setState(initial, true)
    useProjectStore.setState({ activeProject: null })
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

  it('shows string rejections from Tauri commands as the error', async () => {
    vi.spyOn(codeGraphService, 'analyze').mockRejectedValue('Command analyze_graph not found')
    await useCodeGraphStore.getState().analyze()
    const s = useCodeGraphStore.getState()
    expect(s.loading).toBe(false)
    expect(s.error).toBe('Command analyze_graph not found')
  })

  it('drops the previous project session when the active project changes', async () => {
    await useCodeGraphStore.getState().analyze()
    useCodeGraphStore.getState().setOffset(PAGE, 20, 10)
    useCodeGraphStore.getState().select(`${PAGE}#formatTotal`)
    useCodeGraphStore.setState({ entry: 'app/old-project-entry.tsx' })
    await vi.waitFor(() => expect(useCodeGraphStore.getState().sources[PAGE]).toBeDefined())

    useProjectStore.setState({ activeProject: { id: '2' } as Project })
    const analyze = vi.spyOn(codeGraphService, 'analyze')
    const getSource = vi.spyOn(codeGraphService, 'getSource')
    await useCodeGraphStore.getState().analyze()

    expect(analyze).toHaveBeenCalledWith('2', expect.objectContaining({ entry: null, depth: null }))
    const s = useCodeGraphStore.getState()
    expect(s.projectKey).toBe('2')
    expect(s.offsets).toEqual({})
    expect(s.history).toEqual([])
    // The cached source of the old project is dropped and fetched again for the new one.
    await vi.waitFor(() => expect(getSource).toHaveBeenCalledWith('2', PAGE))
  })

  it('keys explanations by the line text, not only the line number', () => {
    const before = explanationKey('f', { text: 'await', line: 9, lineText: 'await a()' })
    const after = explanationKey('f', { text: 'await', line: 9, lineText: 'await b()' })
    expect(before).not.toBe(after)
  })
})
