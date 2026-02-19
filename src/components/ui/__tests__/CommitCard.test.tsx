import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import CommitCard from '../CommitCard.tsx'
import type { Commit } from '@/types/index.ts'

const pendingCommit: Commit = {
  hash: 'a3f7c2d',
  message: 'feat: add auth',
  author: 'dev',
  timestamp: '12 min ago',
  filesChanged: 3,
  additions: 87,
  deletions: 4,
  status: 'pending',
}

const reviewedCommit: Commit = {
  ...pendingCommit,
  hash: '7d2e5a1',
  message: 'feat: add product listing',
  status: 'reviewed',
}

describe('CommitCard', () => {
  it('renders commit message', () => {
    render(<CommitCard commit={pendingCommit} />)
    expect(screen.getByText('feat: add auth')).toBeInTheDocument()
  })

  it('renders commit hash', () => {
    render(<CommitCard commit={pendingCommit} />)
    expect(screen.getByText(/a3f7c2d/)).toBeInTheDocument()
  })

  it('renders additions and deletions', () => {
    render(<CommitCard commit={pendingCommit} />)
    expect(screen.getByText('+87')).toBeInTheDocument()
    expect(screen.getByText('-4')).toBeInTheDocument()
  })

  it('renders pending badge', () => {
    render(<CommitCard commit={pendingCommit} />)
    expect(screen.getByText('pending')).toBeInTheDocument()
  })

  it('renders reviewed badge', () => {
    render(<CommitCard commit={reviewedCommit} />)
    expect(screen.getByText('reviewed')).toBeInTheDocument()
  })

  it('calls onClick when clicked', () => {
    const onClick = vi.fn()
    render(<CommitCard commit={pendingCommit} onClick={onClick} />)
    fireEvent.click(screen.getByText('feat: add auth'))
    expect(onClick).toHaveBeenCalledOnce()
  })
})
