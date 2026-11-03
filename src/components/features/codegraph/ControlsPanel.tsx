import type { CodeGraph } from '@/types/codegraph.ts'
import { useCodeGraphStore } from '@/stores/codegraphStore.ts'
import Button from '@/components/ui/Button.tsx'
import { MONO, fieldStyle, sectionLabel, segmentButton, segmentGroup, tagColors } from './styles.ts'

interface ControlsPanelProps {
  graph: CodeGraph | null
}

export default function ControlsPanel({ graph }: ControlsPanelProps) {
  const mode = useCodeGraphStore((s) => s.mode)
  const entry = useCodeGraphStore((s) => s.entry)
  const depthText = useCodeGraphStore((s) => s.depthText)
  const maxNodesText = useCodeGraphStore((s) => s.maxNodesText)
  const loading = useCodeGraphStore((s) => s.loading)
  const selectedId = useCodeGraphStore((s) => s.selectedId)
  const panelTab = useCodeGraphStore((s) => s.panelTab)
  const fileTabId = useCodeGraphStore((s) => s.fileTabId)
  const setMode = useCodeGraphStore((s) => s.setMode)
  const setEntry = useCodeGraphStore((s) => s.setEntry)
  const setDepthText = useCodeGraphStore((s) => s.setDepthText)
  const applyRecommendedDepth = useCodeGraphStore((s) => s.applyRecommendedDepth)
  const setMaxNodesText = useCodeGraphStore((s) => s.setMaxNodesText)
  const analyze = useCodeGraphStore((s) => s.analyze)
  const openFile = useCodeGraphStore((s) => s.openFile)
  const select = useCodeGraphStore((s) => s.select)

  const allFiles = graph?.allFiles ?? []
  const entryOptions =
    mode === 'file'
      ? allFiles.map((f) => ({ value: f.id, label: f.path }))
      : allFiles.flatMap((f) => f.functionNames.map((fn) => ({ value: fn.id, label: `${fn.name}  ·  ${f.path}` })))

  const graphFiles = new Map((graph?.files ?? []).map((f) => [f.id, f]))
  const graphFns = new Map((graph?.functions ?? []).map((f) => [f.id, f]))

  return (
    <aside
      style={{
        flex: '1 1 260px',
        maxWidth: '100%',
        borderRight: '1px solid var(--border)',
        backgroundColor: 'var(--sidebar-bg)',
        padding: '18px 16px',
        display: 'flex',
        flexDirection: 'column',
        gap: 20,
        boxSizing: 'border-box',
        overflowY: 'auto',
      }}
    >
      <section style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        <div style={sectionLabel}>Exploration mode</div>
        <div role="group" aria-label="Exploration mode" style={segmentGroup}>
          <button type="button" aria-pressed={mode === 'file'} onClick={() => setMode('file')} style={segmentButton(mode === 'file')}>
            File
          </button>
          <button type="button" aria-pressed={mode === 'function'} onClick={() => setMode('function')} style={segmentButton(mode === 'function')}>
            Function
          </button>
        </div>
        <p style={{ margin: 0, fontSize: 12, lineHeight: 1.5, color: 'var(--text-tertiary)' }}>
          {mode === 'file'
            ? 'From a file: each import is one level. Files in scope are shown with all their functions.'
            : 'From a function: each call is one level. Only reached functions are shown.'}
        </p>
      </section>

      <section style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        <label htmlFor="cg-entry" style={sectionLabel}>
          {mode === 'file' ? 'Entry file' : 'Entry function'}
        </label>
        <select id="cg-entry" value={entry ?? ''} onChange={(e) => setEntry(e.target.value)} style={{ ...fieldStyle, padding: '0 8px' }}>
          {entryOptions.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      </section>

      <section style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        <label htmlFor="cg-depth" style={sectionLabel}>
          {mode === 'file' ? 'Import depth' : 'Call depth'}
        </label>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <input
            id="cg-depth"
            type="number"
            min={1}
            max={10}
            value={depthText}
            onChange={(e) => setDepthText(e.target.value)}
            style={{ ...fieldStyle, flex: 1, minWidth: 0, fontSize: 13 }}
          />
          <button
            type="button"
            onClick={applyRecommendedDepth}
            disabled={!graph}
            style={{ ...fieldStyle, flexShrink: 0, cursor: 'pointer', backgroundColor: 'var(--bg-tertiary)' }}
          >
            Use {graph?.recommendedDepth ?? '–'}
          </button>
        </div>
        {graph && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: 'var(--text-secondary)' }}>
            <span style={{ width: 6, height: 6, borderRadius: '50%', backgroundColor: 'var(--success)' }} />
            Recommended: {graph.recommendedDepth} ({graph.recommendedReason})
          </div>
        )}
      </section>

      <section style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        <label htmlFor="cg-cap" style={sectionLabel}>
          Node cap
        </label>
        <input
          id="cg-cap"
          type="number"
          min={10}
          value={maxNodesText}
          onChange={(e) => setMaxNodesText(e.target.value)}
          style={fieldStyle}
        />
      </section>

      <Button variant="primary" size="lg" loading={loading} onClick={() => void analyze()} style={{ justifyContent: 'center' }}>
        Analyze
      </Button>

      <section style={{ display: 'flex', flexDirection: 'column', gap: 6, borderTop: '1px solid var(--border-light)', paddingTop: 16 }}>
        <div style={{ ...sectionLabel, marginBottom: 4 }}>Explorer</div>
        {[...allFiles]
          .sort((a, b) => a.path.localeCompare(b.path))
          .map((f) => {
            const gf = graphFiles.get(f.id)
            const inScope = gf?.scope === 'in'
            let badge: string
            if (mode === 'file') {
              if (!gf) badge = 'out'
              else badge = gf.scope === 'ghost' ? `L${gf.level} ghost` : `L${gf.level}`
            } else {
              const reached = f.functionNames.filter((fn) => graphFns.get(fn.id)?.scope === 'in').length
              badge = `${reached}/${f.functionNames.length}`
            }
            const active = panelTab === 'file' && fileTabId === f.id
            return (
              <div key={f.id} style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                <button
                  type="button"
                  onClick={() => gf && openFile(f.id)}
                  disabled={!gf}
                  aria-label={`Show full file ${f.path}`}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                    padding: '5px 4px',
                    backgroundColor: active ? 'var(--bg-hover)' : 'transparent',
                    border: 'none',
                    borderRadius: 4,
                    cursor: gf ? 'pointer' : 'default',
                    textAlign: 'left',
                  }}
                >
                  <span style={{ width: 7, height: 7, borderRadius: 2, backgroundColor: tagColors(f.tag).accent, flexShrink: 0 }} />
                  <span
                    style={{
                      fontFamily: MONO,
                      fontSize: 12,
                      color: inScope ? 'var(--text)' : 'var(--text-tertiary)',
                      flex: 1,
                      minWidth: 0,
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {f.path}
                  </span>
                  <span
                    style={{
                      fontFamily: MONO,
                      fontSize: 10,
                      color: 'var(--text-secondary)',
                      border: '1px solid var(--border)',
                      borderRadius: 4,
                      padding: '1px 5px',
                    }}
                  >
                    {badge}
                  </span>
                </button>
                {f.functionNames.map((fn) => {
                  const present = graphFns.has(fn.id)
                  const on = fn.id === selectedId && panelTab === 'function'
                  return (
                    <button
                      key={fn.id}
                      type="button"
                      onClick={() => present && select(fn.id)}
                      disabled={!present}
                      style={{
                        textAlign: 'left',
                        marginLeft: 15,
                        padding: '5px 8px',
                        backgroundColor: on ? 'var(--bg-hover)' : 'transparent',
                        color: on ? 'var(--text)' : present ? 'var(--text-secondary)' : 'var(--text-tertiary)',
                        border: 'none',
                        borderRadius: 4,
                        fontFamily: MONO,
                        fontSize: 12,
                        cursor: present ? 'pointer' : 'default',
                      }}
                    >
                      ƒ {fn.name}
                    </button>
                  )
                })}
              </div>
            )
          })}
      </section>
    </aside>
  )
}
