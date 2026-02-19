import { useEffect } from 'react'
import { useDebriefStore } from '@/stores/debriefStore.ts'
import { useProjectStore } from '@/stores/projectStore.ts'
import StatCard from '@/components/ui/StatCard.tsx'
import CommitCard from '@/components/ui/CommitCard.tsx'
import type { Commit } from '@/types/index.ts'

interface DashboardProps {
  onCommitClick: (commit: Commit) => void
}

export default function Dashboard({ onCommitClick }: DashboardProps) {
  const { pendingCommits, reviewedCommits, gapCount, loading, loadCommits, loadGapCount } =
    useDebriefStore()
  const { activeProject, loadActiveProject } = useProjectStore()

  useEffect(() => {
    loadActiveProject()
    loadCommits('proj-1')
    loadGapCount('proj-1')
  }, [loadActiveProject, loadCommits, loadGapCount])

  return (
    <div style={{ padding: '32px 40px', maxWidth: 960, margin: '0 auto' }}>
      {/* Header */}
      <h1
        className="font-mono"
        style={{
          fontSize: 22,
          fontWeight: 600,
          color: 'var(--text)',
          letterSpacing: '-0.02em',
          margin: 0,
        }}
      >
        Dashboard
      </h1>
      <p
        className="font-mono"
        style={{
          fontSize: 13,
          color: 'var(--text-tertiary)',
          marginTop: 6,
        }}
      >
        {activeProject?.path ?? '~/projects/e-commerce-api'}
      </p>

      {/* Stat cards */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(3, 1fr)',
          gap: 12,
          marginTop: 24,
          marginBottom: 32,
        }}
      >
        <StatCard label="Pending Reviews" value={pendingCommits.length} color="var(--warning)" />
        <StatCard label="Reviewed" value={reviewedCommits.length} color="var(--success)" />
        <StatCard label="Gaps Found" value={gapCount} color="var(--critical)" />
      </div>

      {/* Pending commits */}
      {loading ? (
        <div className="font-mono" style={{ fontSize: 13, color: 'var(--text-tertiary)', padding: '20px 0' }}>
          Loading commits...
        </div>
      ) : (
        <>
          <h2
            className="font-mono"
            style={{
              fontSize: 13,
              fontWeight: 600,
              color: 'var(--text-secondary)',
              textTransform: 'uppercase',
              letterSpacing: '0.06em',
              marginBottom: 12,
            }}
          >
            Pending Review
          </h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 32 }}>
            {pendingCommits.length === 0 ? (
              <div className="font-mono" style={{ fontSize: 13, color: 'var(--text-tertiary)', padding: '12px 0' }}>
                No pending commits.
              </div>
            ) : (
              pendingCommits.map((commit) => (
                <CommitCard
                  key={commit.hash}
                  commit={commit}
                  onClick={() => onCommitClick(commit)}
                />
              ))
            )}
          </div>

          <h2
            className="font-mono"
            style={{
              fontSize: 13,
              fontWeight: 600,
              color: 'var(--text-secondary)',
              textTransform: 'uppercase',
              letterSpacing: '0.06em',
              marginBottom: 12,
            }}
          >
            Reviewed
          </h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {reviewedCommits.length === 0 ? (
              <div className="font-mono" style={{ fontSize: 13, color: 'var(--text-tertiary)', padding: '12px 0' }}>
                No reviewed commits yet.
              </div>
            ) : (
              reviewedCommits.map((commit) => (
                <CommitCard key={commit.hash} commit={commit} />
              ))
            )}
          </div>
        </>
      )}
    </div>
  )
}
