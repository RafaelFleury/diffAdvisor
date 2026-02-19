import { useState } from 'react'
import Layout from '@/components/layout/Layout.tsx'
import Dashboard from '@/pages/Dashboard.tsx'
import Debrief from '@/pages/Debrief.tsx'
import KnowledgeBase from '@/pages/KnowledgeBase.tsx'
import Settings from '@/pages/Settings.tsx'
import type { Commit } from '@/types/index.ts'
import { Toaster } from 'react-hot-toast'

type Page = 'dashboard' | 'debrief' | 'knowledge' | 'settings'

export default function App() {
  const [page, setPage] = useState<Page>('dashboard')
  const [selectedCommit, setSelectedCommit] = useState<Commit | null>(null)

  const handleCommitClick = (commit: Commit) => {
    setSelectedCommit(commit)
    setPage('debrief')
  }

  const handleBackToDashboard = () => {
    setSelectedCommit(null)
    setPage('dashboard')
  }

  return (
    <>
      <Toaster
        position="bottom-right"
        toastOptions={{
          style: {
            background: 'var(--card-bg)',
            color: 'var(--text)',
            border: '1px solid var(--border)',
            fontFamily: "'JetBrains Mono', monospace",
            fontSize: 12,
          },
        }}
      />
      <Layout activePage={page} onNavigate={setPage}>
        {page === 'dashboard' && <Dashboard onCommitClick={handleCommitClick} />}
        {page === 'debrief' && (
          <Debrief commit={selectedCommit} onBack={handleBackToDashboard} />
        )}
        {page === 'knowledge' && <KnowledgeBase />}
        {page === 'settings' && <Settings />}
      </Layout>
    </>
  )
}
