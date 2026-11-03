import type { CodeGraph, CodeGraphStatus } from '@/types/codegraph.ts'
import { MONO } from './styles.ts'

interface StatusFooterProps {
  graph: CodeGraph | null
  status: CodeGraphStatus | null
}

export default function StatusFooter({ graph, status }: StatusFooterProps) {
  const lsp = graph?.analyzer.mode === 'lsp'
  let analyzer: React.ReactNode
  if (!status && !graph) analyzer = 'checking analyzer…'
  else if (lsp) analyzer = `typescript-language-server ${graph?.analyzer.lspVersion ?? ''} (Node ${graph?.analyzer.nodeVersion ?? '?'})`
  else if (status?.lsp === 'missing') analyzer = 'heuristic mode: Node.js not found, calls resolved by name'
  else if (status?.lsp === 'error') analyzer = 'heuristic mode: language server failed to start'
  else analyzer = 'heuristic mode'

  return (
    <footer
      style={{
        display: 'flex',
        flexWrap: 'wrap',
        gap: 18,
        padding: '7px 20px',
        borderTop: '1px solid var(--border)',
        backgroundColor: 'var(--sidebar-bg)',
        fontFamily: MONO,
        fontSize: 11,
        color: 'var(--text-tertiary)',
      }}
    >
      <span>
        <span style={{ color: lsp ? 'var(--success)' : 'var(--warning)' }}>●</span> {analyzer}
      </span>
      {graph && <span>parser: {graph.analyzer.parser}</span>}
      {graph && (
        <span>
          cache: {graph.cache.hits}/{graph.cache.files} files
        </span>
      )}
    </footer>
  )
}
