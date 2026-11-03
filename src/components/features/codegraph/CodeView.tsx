import { useMemo } from 'react'
import type { SourceFile, SourceToken, TokenKind } from '@/types/codegraph.ts'
import { useThemeStore } from '@/stores/themeStore.ts'
import type { SelectedTerm } from '@/stores/codegraphStore.ts'
import { MONO } from './styles.ts'

const DARK: Record<TokenKind, string> = {
  keyword: '#ff7ab2',
  type: '#e0af68',
  string: '#9ece6a',
  number: '#ff9e64',
  comment: 'var(--text-tertiary)',
  function: '#7dcfff',
  punctuation: '#b0b0b0',
  plain: 'var(--text)',
}

const LIGHT: Record<TokenKind, string> = {
  keyword: '#c0266d',
  type: '#8a5a00',
  string: '#3f7d1f',
  number: '#b4541a',
  comment: 'var(--text-tertiary)',
  function: '#0b6e99',
  punctuation: '#555555',
  plain: 'var(--text)',
}

interface CodeViewProps {
  source: SourceFile | undefined
  /** 1-based inclusive range to show. Omit for the whole file. */
  fromLine?: number
  toLine?: number
  /** Lines to highlight (the selected function inside the full file). */
  highlight?: { from: number; to: number }
  selectedTerm: SelectedTerm | null
  onTerm: (term: SelectedTerm) => void
  maxHeight: number
}

interface Segment {
  text: string
  kind: TokenKind
}

function segmentsFor(lineText: string, tokens: SourceToken[]): Segment[] {
  const out: Segment[] = []
  let col = 0
  for (const t of [...tokens].sort((a, b) => a.start - b.start)) {
    if (t.start < col) continue
    if (t.start > col) out.push({ text: lineText.slice(col, t.start), kind: 'plain' })
    out.push({ text: lineText.slice(t.start, t.end), kind: t.kind })
    col = t.end
  }
  if (col < lineText.length) out.push({ text: lineText.slice(col), kind: 'plain' })
  return out
}

export default function CodeView({ source, fromLine, toLine, highlight, selectedTerm, onTerm, maxHeight }: CodeViewProps) {
  const theme = useThemeStore((s) => s.theme)
  const colors = theme === 'light' ? LIGHT : DARK

  const lines = useMemo(() => {
    if (!source) return []
    const all = source.text.split('\n')
    const byLine = new Map<number, SourceToken[]>()
    for (const t of source.tokens) {
      const list = byLine.get(t.line) ?? []
      list.push(t)
      byLine.set(t.line, list)
    }
    const start = fromLine ?? 1
    const end = Math.min(toLine ?? all.length, all.length)
    const out: { no: number; segments: Segment[] }[] = []
    for (let n = start; n <= end; n++) out.push({ no: n, segments: segmentsFor(all[n - 1] ?? '', byLine.get(n) ?? []) })
    return out
  }, [source, fromLine, toLine])

  if (!source) {
    return (
      <div style={{ ...frame(maxHeight), padding: 14, fontFamily: MONO, fontSize: 12, color: 'var(--text-tertiary)' }}>Loading source…</div>
    )
  }

  return (
    <div style={frame(maxHeight)}>
      {lines.map(({ no, segments }) => {
        const hl = highlight && no >= highlight.from && no <= highlight.to
        return (
          <div
            key={no}
            style={{
              display: 'flex',
              paddingRight: 14,
              backgroundColor: hl ? 'var(--info-bg)' : 'transparent',
              boxShadow: hl ? 'inset 2px 0 0 var(--info)' : 'none',
            }}
          >
            <span style={{ flex: '0 0 40px', textAlign: 'right', paddingRight: 14, color: 'var(--text-tertiary)', userSelect: 'none' }}>{no}</span>
            <span style={{ whiteSpace: 'pre' }}>
              {segments.map((seg, i) => {
                if (seg.kind !== 'keyword') {
                  return (
                    <span key={i} style={{ color: colors[seg.kind] }}>
                      {seg.text}
                    </span>
                  )
                }
                const on = selectedTerm?.text === seg.text && selectedTerm.line === no
                return (
                  <button
                    key={i}
                    type="button"
                    onClick={() => onTerm({ text: seg.text, line: no })}
                    style={{
                      font: 'inherit',
                      color: colors.keyword,
                      backgroundColor: on ? 'rgba(255,122,178,0.2)' : 'transparent',
                      border: 'none',
                      borderBottom: `1px dotted ${on ? colors.keyword : 'rgba(255,122,178,0.5)'}`,
                      padding: 0,
                      margin: 0,
                      cursor: 'pointer',
                      borderRadius: 2,
                    }}
                  >
                    {seg.text}
                  </button>
                )
              })}
            </span>
          </div>
        )
      })}
    </div>
  )
}

function frame(maxHeight: number): React.CSSProperties {
  return {
    backgroundColor: 'var(--code-bg)',
    border: '1px solid var(--border-light)',
    borderRadius: 8,
    padding: '12px 0',
    overflow: 'auto',
    maxHeight,
    fontFamily: MONO,
    fontSize: 12.5,
    lineHeight: 1.75,
  }
}
