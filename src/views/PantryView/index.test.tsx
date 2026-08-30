import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import PantryView from './index'
import '../../i18n'
import i18n from '../../i18n'
import type { Product, SortConfig } from '../../utils/types'

const product: Product = {
  id: 1,
  name: 'Leche',
  quantity: '2',
  brand: '',
  purchaseDate: '',
  expiryDate: '',
  location: '',
  details: '',
}

const sortConfig: SortConfig = { key: null, direction: 'asc' }

function stubMatchMedia(matches: boolean) {
  window.matchMedia = ((query: string) =>
    ({
      matches,
      media: query,
      onchange: null,
      addEventListener: () => {},
      removeEventListener: () => {},
      addListener: () => {},
      removeListener: () => {},
      dispatchEvent: () => false,
    }) as MediaQueryList) as typeof window.matchMedia
}

const baseProps = {
  products: [product],
  sortConfig,
  onSort: vi.fn(),
  onDelete: vi.fn(),
  onEdit: vi.fn(),
  onAddToCart: vi.fn(),
  onAddClick: vi.fn(),
  onQuantityChange: vi.fn(),
}

describe('PantryView', () => {
  afterEach(() => {
    stubMatchMedia(false)
  })

  it('renders a table with SortableHeader columns on desktop', () => {
    stubMatchMedia(false)
    render(<PantryView {...baseProps} />)
    expect(screen.getByText(i18n.t('table.name'))).toBeInTheDocument()
    expect(screen.getByRole('list')).toBeInTheDocument()
    expect(screen.getByText('Leche')).toBeInTheDocument()
  })

  it('calls onSort when a column header is clicked on desktop', async () => {
    stubMatchMedia(false)
    const onSort = vi.fn()
    render(<PantryView {...baseProps} onSort={onSort} />)
    await userEvent.click(screen.getByText(i18n.t('table.name')))
    expect(onSort).toHaveBeenCalledWith('name')
  })

  it('renders cards instead of a table on mobile', () => {
    stubMatchMedia(true)
    render(<PantryView {...baseProps} />)
    expect(screen.queryByRole('columnheader')).not.toBeInTheDocument()
    expect(screen.getByText('Leche')).toBeInTheDocument()
  })

  it('shows the empty state when there are no products', () => {
    stubMatchMedia(false)
    render(<PantryView {...baseProps} products={[]} />)
    expect(screen.getByText(i18n.t('table.emptyTitle'))).toBeInTheDocument()
  })

  it('calls onAddClick from the add button', async () => {
    stubMatchMedia(false)
    const onAddClick = vi.fn()
    render(<PantryView {...baseProps} onAddClick={onAddClick} />)
    await userEvent.click(screen.getByLabelText(i18n.t('header.addProduct')))
    expect(onAddClick).toHaveBeenCalledOnce()
  })
})
