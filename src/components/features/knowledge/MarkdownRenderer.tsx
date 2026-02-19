import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import rehypeHighlight from 'rehype-highlight'
import rehypeRaw from 'rehype-raw'
import type { Components } from 'react-markdown'

interface MarkdownRendererProps {
  content: string
  onWikilinkClick?: (title: string) => void
}

function processWikilinks(text: string): string {
  // Convert [[Title|Display]] and [[Title]] to HTML spans with data attributes
  return text.replace(/\[\[([^\]|]+)(?:\|([^\]]+))?\]\]/g, (_match, title, display) => {
    return `<span class="wikilink" data-target="${title}">${display || title}</span>`
  })
}

export default function MarkdownRenderer({ content, onWikilinkClick }: MarkdownRendererProps) {
  const processed = processWikilinks(content)

  const components: Components = {
    h1: ({ children }) => (
      <h1
        className="font-mono"
        style={{
          fontSize: 20,
          fontWeight: 700,
          color: 'var(--text)',
          margin: '20px 0 10px',
          letterSpacing: '-0.02em',
        }}
      >
        {children}
      </h1>
    ),
    h2: ({ children }) => (
      <h2
        className="font-mono"
        style={{
          fontSize: 15,
          fontWeight: 600,
          color: 'var(--text)',
          margin: '18px 0 8px',
        }}
      >
        {children}
      </h2>
    ),
    h3: ({ children }) => (
      <h3
        className="font-mono"
        style={{
          fontSize: 14,
          fontWeight: 600,
          color: 'var(--text)',
          margin: '14px 0 6px',
        }}
      >
        {children}
      </h3>
    ),
    p: ({ children }) => (
      <p style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.7, margin: '6px 0' }}>
        {children}
      </p>
    ),
    ul: ({ children }) => (
      <ul style={{ listStyle: 'none', padding: 0, margin: '4px 0' }}>{children}</ul>
    ),
    ol: ({ children }) => (
      <ol style={{ paddingLeft: 20, margin: '4px 0', color: 'var(--text-secondary)', fontSize: 13, lineHeight: 1.7 }}>{children}</ol>
    ),
    li: ({ children }) => (
      <li style={{ display: 'flex', gap: 8, fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.7, marginBottom: 4, paddingLeft: 4 }}>
        <span style={{ color: 'var(--text-tertiary)' }}>·</span>
        <span>{children}</span>
      </li>
    ),
    code: ({ className, children }) => {
      const isBlock = className?.startsWith('language-') || className?.startsWith('hljs')
      if (isBlock) {
        return <code className={className}>{children}</code>
      }
      return (
        <code
          className="font-mono"
          style={{
            padding: '1px 5px',
            backgroundColor: 'var(--bg-tertiary)',
            borderRadius: 3,
            fontSize: 12,
            color: 'var(--text)',
          }}
        >
          {children}
        </code>
      )
    },
    pre: ({ children }) => {
      // Extract language from child code element
      const codeEl = children as React.ReactElement<{ className?: string; children?: React.ReactNode }>
      const className = codeEl?.props?.className ?? ''
      const lang = className.replace('language-', '').replace('hljs ', '').split(' ')[0]

      return (
        <div style={{ margin: '12px 0', borderRadius: 6, overflow: 'hidden', border: '1px solid var(--border)' }}>
          {lang && (
            <div
              className="font-mono"
              style={{
                padding: '4px 12px',
                backgroundColor: 'var(--bg-tertiary)',
                fontSize: 10,
                color: 'var(--text-tertiary)',
                borderBottom: '1px solid var(--border)',
              }}
            >
              {lang}
            </div>
          )}
          <pre
            className="font-mono"
            style={{
              margin: 0,
              padding: '12px 14px',
              backgroundColor: 'var(--code-bg)',
              fontSize: 12,
              lineHeight: 1.7,
              color: 'var(--text-secondary)',
              overflowX: 'auto',
            }}
          >
            {children}
          </pre>
        </div>
      )
    },
    hr: () => (
      <hr style={{ border: 'none', borderTop: '1px solid var(--border)', margin: '16px 0' }} />
    ),
    strong: ({ children }) => (
      <strong style={{ fontWeight: 600, color: 'var(--text)' }}>{children}</strong>
    ),
    em: ({ children }) => (
      <em style={{ fontSize: 12, color: 'var(--text-tertiary)', lineHeight: 1.6, fontStyle: 'italic' }}>
        {children}
      </em>
    ),
    a: ({ children, href }) => (
      <a style={{ color: 'var(--info)', textDecoration: 'none' }} href={href}>
        {children}
      </a>
    ),
    // Handle wikilink spans
    span: ({ className, children, ...props }) => {
      if (className === 'wikilink') {
        const target = (props as Record<string, unknown>)['data-target'] as string | undefined
        return (
          <span
            onClick={() => target && onWikilinkClick?.(target)}
            style={{
              color: 'var(--info)',
              cursor: 'pointer',
              borderBottom: '1px dashed var(--info)',
              paddingBottom: 1,
            }}
          >
            {children}
          </span>
        )
      }
      return <span className={className}>{children}</span>
    },
  }

  return (
    <div>
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        rehypePlugins={[rehypeHighlight, rehypeRaw]}
        components={components}
      >
        {processed}
      </ReactMarkdown>
    </div>
  )
}
