// Shared inline styles for the Code Graph components. Colors come from the tokens in src/index.css.

import type { FileTag } from '@/types/codegraph.ts'

export const MONO = "'JetBrains Mono', monospace"

export const sectionLabel: React.CSSProperties = {
  fontFamily: MONO,
  fontSize: 11,
  letterSpacing: '0.06em',
  textTransform: 'uppercase',
  color: 'var(--text-tertiary)',
}

export const fieldStyle: React.CSSProperties = {
  height: 36,
  boxSizing: 'border-box',
  backgroundColor: 'var(--input-bg)',
  color: 'var(--text)',
  border: '1px solid var(--border)',
  borderRadius: 6,
  padding: '0 10px',
  fontFamily: MONO,
  fontSize: 12,
  outline: 'none',
}

export const smallButton: React.CSSProperties = {
  height: 32,
  padding: '0 10px',
  backgroundColor: 'var(--card-bg)',
  color: 'var(--text)',
  border: '1px solid var(--border)',
  borderRadius: 6,
  cursor: 'pointer',
  fontFamily: MONO,
  fontSize: 12,
  whiteSpace: 'nowrap',
}

export function segmentButton(active: boolean): React.CSSProperties {
  return {
    height: 32,
    border: 'none',
    borderRadius: 6,
    backgroundColor: active ? 'var(--bg-hover)' : 'transparent',
    color: active ? 'var(--text)' : 'var(--text-secondary)',
    fontFamily: MONO,
    fontSize: 12,
    fontWeight: 600,
    cursor: 'pointer',
  }
}

export const segmentGroup: React.CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
  gap: 4,
  backgroundColor: 'var(--card-bg)',
  border: '1px solid var(--border-light)',
  borderRadius: 8,
  padding: 4,
}

export function tagColors(tag: FileTag): { accent: string; bg: string; border: string; label: string } {
  if (tag === 'client') return { accent: 'var(--info)', bg: 'var(--info-bg)', border: 'var(--info-border)', label: 'client' }
  if (tag === 'server') return { accent: 'var(--warning)', bg: 'var(--warning-bg)', border: 'var(--warning-border)', label: 'server' }
  return { accent: 'var(--text-tertiary)', bg: 'var(--bg-tertiary)', border: 'var(--border)', label: 'untagged' }
}

export const chipButton: React.CSSProperties = {
  fontFamily: MONO,
  fontSize: 11.5,
  color: 'var(--text)',
  backgroundColor: 'var(--bg-tertiary)',
  border: '1px solid var(--border)',
  borderRadius: 999,
  padding: '4px 10px',
  cursor: 'pointer',
}
