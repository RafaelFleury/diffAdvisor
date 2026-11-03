// Icons for the Code Graph page. Same style as the Sidebar icons: 24 viewBox, stroke, no fill.

interface IconProps {
  size?: number
  style?: React.CSSProperties
}

const base = {
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 2,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
  'aria-hidden': true,
}

export function GraphIcon({ size = 18, style }: IconProps) {
  return (
    <svg width={size} height={size} style={style} {...base}>
      <circle cx="5" cy="6" r="2.5" />
      <circle cx="19" cy="6" r="2.5" />
      <circle cx="12" cy="18" r="2.5" />
      <path d="M7.3 7.2 10.6 16M16.7 7.2 13.4 16M7.5 6h9" />
    </svg>
  )
}

export function FileIcon({ size = 12, style }: IconProps) {
  return (
    <svg width={size} height={size} style={style} {...base}>
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <path d="M14 2v6h6M8 13h8M8 17h6" />
    </svg>
  )
}

export function ChevronIcon({ size = 12, style }: IconProps) {
  return (
    <svg width={size} height={size} style={style} {...base} strokeWidth={2.5}>
      <path d="m6 9 6 6 6-6" />
    </svg>
  )
}

export function SearchIcon({ size = 14, style }: IconProps) {
  return (
    <svg width={size} height={size} style={style} {...base}>
      <circle cx="11" cy="11" r="7" />
      <path d="m20 20-3.5-3.5" />
    </svg>
  )
}
