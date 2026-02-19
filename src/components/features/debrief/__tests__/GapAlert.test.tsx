import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import GapAlert from '../GapAlert.tsx'
import type { Gap } from '@/types/index.ts'

const criticalGap: Gap = {
  id: 'gap-1',
  severity: 'critical',
  category: 'security',
  description: 'JWT secret hardcoded',
  explanation: 'Anyone can forge tokens',
  suggestion: 'Use environment variables',
}

const warningGap: Gap = {
  id: 'gap-2',
  severity: 'warning',
  category: 'reliability',
  description: 'No error handling',
  explanation: 'App may crash',
  suggestion: 'Add try/catch',
}

describe('GapAlert', () => {
  it('renders critical gap', () => {
    render(<GapAlert gap={criticalGap} />)
    expect(screen.getByText('CRITICAL')).toBeInTheDocument()
    expect(screen.getByText('security')).toBeInTheDocument()
    expect(screen.getByText('JWT secret hardcoded')).toBeInTheDocument()
  })

  it('renders warning gap', () => {
    render(<GapAlert gap={warningGap} />)
    expect(screen.getByText('WARNING')).toBeInTheDocument()
    expect(screen.getByText('reliability')).toBeInTheDocument()
  })

  it('renders description, explanation, and suggestion', () => {
    render(<GapAlert gap={criticalGap} />)
    expect(screen.getByText('JWT secret hardcoded')).toBeInTheDocument()
    expect(screen.getByText('Anyone can forge tokens')).toBeInTheDocument()
    expect(screen.getByText(/Use environment variables/)).toBeInTheDocument()
  })
})
