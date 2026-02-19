import { type ReactNode } from 'react'
import Sidebar from './Sidebar.tsx'
import { useThemeStore } from '@/stores/themeStore.ts'

type Page = 'dashboard' | 'debrief' | 'knowledge' | 'settings'

interface LayoutProps {
  activePage: Page
  onNavigate: (page: Page) => void
  children: ReactNode
}

export default function Layout({ activePage, onNavigate, children }: LayoutProps) {
  const theme = useThemeStore((s) => s.theme)

  return (
    <div className={theme === 'light' ? 'light' : ''} style={{ display: 'flex', width: '100vw', height: '100vh', backgroundColor: 'var(--bg)', color: 'var(--text)', transition: 'background-color 0.2s ease, color 0.2s ease' }}>
      <Sidebar activePage={activePage} onNavigate={onNavigate} />
      <main style={{ flex: 1, overflow: 'auto' }}>
        {children}
      </main>
    </div>
  )
}
