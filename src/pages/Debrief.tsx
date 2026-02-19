import { useEffect, useState, useCallback, useRef } from 'react'
import { useDebriefStore } from '@/stores/debriefStore.ts'
import DiffViewer from '@/components/features/debrief/DiffViewer.tsx'
import DebriefPanel from '@/components/features/debrief/DebriefPanel.tsx'
import type { Commit } from '@/types/index.ts'
import toast from 'react-hot-toast'

interface DebriefProps {
  commit: Commit | null
  onBack: () => void
}

export default function Debrief({ commit, onBack }: DebriefProps) {
  const {
    currentDebrief,
    diffContent,
    debriefLoading,
    answers,
    loadDebrief,
    markReviewed,
    submitAnswer,
    clearDebrief,
  } = useDebriefStore()

  const [dividerPos, setDividerPos] = useState(55)
  const dragging = useRef(false)
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (commit) {
      loadDebrief(commit.hash)
    }
    return () => clearDebrief()
  }, [commit, loadDebrief, clearDebrief])

  const handleMouseDown = useCallback(() => {
    dragging.current = true
    document.body.style.cursor = 'col-resize'
    document.body.style.userSelect = 'none'
  }, [])

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!dragging.current || !containerRef.current) return
      const rect = containerRef.current.getBoundingClientRect()
      const pct = ((e.clientX - rect.left) / rect.width) * 100
      setDividerPos(Math.min(75, Math.max(30, pct)))
    }

    const handleMouseUp = () => {
      dragging.current = false
      document.body.style.cursor = ''
      document.body.style.userSelect = ''
    }

    document.addEventListener('mousemove', handleMouseMove)
    document.addEventListener('mouseup', handleMouseUp)
    return () => {
      document.removeEventListener('mousemove', handleMouseMove)
      document.removeEventListener('mouseup', handleMouseUp)
    }
  }, [])

  const handleMarkReviewed = async () => {
    if (currentDebrief) {
      await markReviewed(currentDebrief.id)
      toast.success('Marked as reviewed')
      onBack()
    }
  }

  const handleSaveToKB = () => {
    toast.success('Saved to Knowledge Base')
  }

  const handleSubmitAnswer = async (questionId: string, answer: string) => {
    if (currentDebrief) {
      await submitAnswer(currentDebrief.id, questionId, answer)
    }
  }

  // Empty state
  if (!commit) {
    return (
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          height: '100%',
          gap: 12,
        }}
      >
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="var(--text-tertiary)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" />
          <polyline points="14,2 14,8 20,8" />
          <line x1="16" y1="13" x2="8" y2="13" />
          <line x1="16" y1="17" x2="8" y2="17" />
        </svg>
        <span className="font-mono" style={{ fontSize: 13, color: 'var(--text-tertiary)' }}>
          Select a commit from the Dashboard to start a debrief
        </span>
      </div>
    )
  }

  if (debriefLoading) {
    return (
      <div
        className="font-mono"
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          height: '100%',
          fontSize: 13,
          color: 'var(--text-tertiary)',
        }}
      >
        Analyzing commit...
      </div>
    )
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* Header bar */}
      <div
        style={{
          padding: '12px 20px',
          borderBottom: '1px solid var(--border)',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexShrink: 0,
        }}
      >
        {/* Left */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <button
            onClick={onBack}
            className="font-mono"
            style={{
              background: 'none',
              border: 'none',
              color: 'var(--text-secondary)',
              fontSize: 13,
              cursor: 'pointer',
              padding: 0,
            }}
            onMouseEnter={(e) => { e.currentTarget.style.color = 'var(--text)' }}
            onMouseLeave={(e) => { e.currentTarget.style.color = 'var(--text-secondary)' }}
          >
            {'\u2190'} Dashboard
          </button>
          <span style={{ color: 'var(--border)' }}>|</span>
          <span className="font-mono" style={{ fontSize: 13, fontWeight: 500, color: 'var(--text)' }}>
            {commit.message}
          </span>
          <span className="font-mono" style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>
            {commit.hash}
          </span>
        </div>

        {/* Right */}
        <div style={{ display: 'flex', gap: 8 }}>
          <button
            onClick={handleSaveToKB}
            className="font-mono"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              backgroundColor: 'var(--bg-tertiary)',
              border: '1px solid var(--border)',
              color: 'var(--text-secondary)',
              padding: '6px 14px',
              borderRadius: 6,
              fontSize: 12,
              cursor: 'pointer',
            }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M4 19.5A2.5 2.5 0 016.5 17H20" />
              <path d="M6.5 2H20v20H6.5A2.5 2.5 0 014 19.5v-15A2.5 2.5 0 016.5 2z" />
            </svg>
            Save to KB
          </button>
          <button
            onClick={handleMarkReviewed}
            className="font-mono"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              backgroundColor: 'var(--text)',
              color: 'var(--bg)',
              border: 'none',
              padding: '6px 14px',
              borderRadius: 6,
              fontSize: 12,
              fontWeight: 500,
              cursor: 'pointer',
            }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="20,6 9,17 4,12" />
            </svg>
            Mark Reviewed
          </button>
        </div>
      </div>

      {/* Split view */}
      <div ref={containerRef} style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
        {/* Left: Diff */}
        <div style={{ width: `${dividerPos}%`, overflow: 'hidden' }}>
          <DiffViewer
            diff={diffContent}
            fileName="src/routes/auth.ts"
            additions={commit.additions}
            deletions={commit.deletions}
          />
        </div>

        {/* Divider */}
        <div
          onMouseDown={handleMouseDown}
          style={{
            width: 5,
            cursor: 'col-resize',
            backgroundColor: 'var(--border)',
            flexShrink: 0,
            zIndex: 10,
            transition: 'background-color 0.1s ease',
          }}
          onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = 'var(--text-tertiary)' }}
          onMouseLeave={(e) => {
            if (!dragging.current) e.currentTarget.style.backgroundColor = 'var(--border)'
          }}
        />

        {/* Right: Debrief */}
        <div style={{ width: `${100 - dividerPos}%`, overflow: 'auto' }}>
          {currentDebrief ? (
            <DebriefPanel
              debrief={currentDebrief}
              answers={answers}
              onSubmitAnswer={handleSubmitAnswer}
            />
          ) : (
            <div className="font-mono" style={{ padding: 20, fontSize: 13, color: 'var(--text-tertiary)' }}>
              Loading debrief...
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
