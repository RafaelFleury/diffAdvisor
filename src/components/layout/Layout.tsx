import { Outlet } from 'react-router-dom'
import Sidebar from './Sidebar.tsx'
import { useThemeStore } from '@/stores/themeStore.ts'

export default function Layout() {
  const theme = useThemeStore((s) => s.theme)

  return (
    <div className={theme === 'light' ? 'light' : ''} style={{ display: 'flex', width: '100vw', height: '100vh', backgroundColor: 'var(--bg)', color: 'var(--text)', transition: 'background-color 0.2s ease, color 0.2s ease' }}>
      <Sidebar />
      <main style={{ flex: 1, overflow: 'auto' }}>
        <Outlet />
      </main>
    </div>
  )
}
