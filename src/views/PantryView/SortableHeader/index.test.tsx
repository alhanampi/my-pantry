import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import SortableHeader from './index'
import type { SortConfig } from '../../../utils/types'

describe('SortableHeader', () => {
  it('renders the label and calls onSort with its column key when clicked', async () => {
    const onSort = vi.fn()
    const sortConfig: SortConfig = { key: null, direction: 'asc' }
    render(<SortableHeader label="Name" columnKey="name" sortConfig={sortConfig} onSort={onSort} />)

    await userEvent.click(screen.getByText('Name'))

    expect(onSort).toHaveBeenCalledWith('name')
  })

  it('marks aria-sort ascending when active and ascending', () => {
    const sortConfig: SortConfig = { key: 'name', direction: 'asc' }
    render(<SortableHeader label="Name" columnKey="name" sortConfig={sortConfig} onSort={vi.fn()} />)
    expect(screen.getByRole('columnheader')).toHaveAttribute('aria-sort', 'ascending')
  })

  it('marks aria-sort descending when active and descending', () => {
    const sortConfig: SortConfig = { key: 'name', direction: 'desc' }
    render(<SortableHeader label="Name" columnKey="name" sortConfig={sortConfig} onSort={vi.fn()} />)
    expect(screen.getByRole('columnheader')).toHaveAttribute('aria-sort', 'descending')
  })

  it('marks aria-sort none for an inactive column', () => {
    const sortConfig: SortConfig = { key: 'brand', direction: 'asc' }
    render(<SortableHeader label="Name" columnKey="name" sortConfig={sortConfig} onSort={vi.fn()} />)
    expect(screen.getByRole('columnheader')).toHaveAttribute('aria-sort', 'none')
  })
})
