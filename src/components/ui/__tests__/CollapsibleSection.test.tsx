import { describe, it, expect } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import CollapsibleSection from '../CollapsibleSection.tsx'

describe('CollapsibleSection', () => {
  it('renders title', () => {
    render(
      <CollapsibleSection title="Test Section" icon={<span>*</span>}>
        <p>Content</p>
      </CollapsibleSection>
    )
    expect(screen.getByText('Test Section')).toBeInTheDocument()
  })

  it('shows content when expanded by default', () => {
    render(
      <CollapsibleSection title="Test" icon={<span>*</span>} defaultExpanded={true}>
        <p>Visible Content</p>
      </CollapsibleSection>
    )
    expect(screen.getByText('Visible Content')).toBeInTheDocument()
  })

  it('hides content when collapsed by default', () => {
    render(
      <CollapsibleSection title="Test" icon={<span>*</span>} defaultExpanded={false}>
        <p>Hidden Content</p>
      </CollapsibleSection>
    )
    expect(screen.queryByText('Hidden Content')).not.toBeInTheDocument()
  })

  it('toggles content on click', () => {
    render(
      <CollapsibleSection title="Toggle Me" icon={<span>*</span>} defaultExpanded={false}>
        <p>Toggled Content</p>
      </CollapsibleSection>
    )
    expect(screen.queryByText('Toggled Content')).not.toBeInTheDocument()

    fireEvent.click(screen.getByText('Toggle Me'))
    expect(screen.getByText('Toggled Content')).toBeInTheDocument()

    fireEvent.click(screen.getByText('Toggle Me'))
    expect(screen.queryByText('Toggled Content')).not.toBeInTheDocument()
  })
})
