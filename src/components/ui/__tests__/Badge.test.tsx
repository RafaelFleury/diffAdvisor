import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import Badge from '../Badge.tsx'

describe('Badge', () => {
  it('renders pending variant', () => {
    render(<Badge variant="pending">pending</Badge>)
    expect(screen.getByText('pending')).toBeInTheDocument()
  })

  it('renders reviewed variant', () => {
    render(<Badge variant="reviewed">reviewed</Badge>)
    expect(screen.getByText('reviewed')).toBeInTheDocument()
  })

  it('renders critical variant', () => {
    render(<Badge variant="critical">CRITICAL</Badge>)
    expect(screen.getByText('CRITICAL')).toBeInTheDocument()
  })

  it('renders warning variant', () => {
    render(<Badge variant="warning">WARNING</Badge>)
    expect(screen.getByText('WARNING')).toBeInTheDocument()
  })

  it('renders info variant', () => {
    render(<Badge variant="info">INFO</Badge>)
    expect(screen.getByText('INFO')).toBeInTheDocument()
  })
})
