import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import StatCard from '../StatCard.tsx'

describe('StatCard', () => {
  it('renders label and value', () => {
    render(<StatCard label="Pending Reviews" value={5} color="var(--warning)" />)
    expect(screen.getByText('Pending Reviews')).toBeInTheDocument()
    expect(screen.getByText('5')).toBeInTheDocument()
  })
})
