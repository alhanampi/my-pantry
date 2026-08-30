import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import ConfirmDialog from './index'
import '../../i18n'

describe('ConfirmDialog', () => {
  it('renders nothing meaningful when closed', () => {
    render(<ConfirmDialog open={false} type={null} data={null} onClose={vi.fn()} />)
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('shows success content and the product name when type is success', () => {
    const product = { id: 1, name: 'Leche', quantity: '', brand: '', purchaseDate: '', expiryDate: '', location: '', details: '' }
    render(<ConfirmDialog open type="success" data={product} onClose={vi.fn()} />)
    expect(screen.getByRole('dialog')).toBeInTheDocument()
    expect(screen.getByText(/Leche/)).toBeInTheDocument()
  })

  it('shows cancel content when type is cancel', () => {
    render(<ConfirmDialog open type="cancel" data={null} onClose={vi.fn()} />)
    expect(screen.getByRole('dialog')).toBeInTheDocument()
  })

  it('calls onClose when the OK button is clicked', async () => {
    const onClose = vi.fn()
    render(<ConfirmDialog open type="success" data={null} onClose={onClose} />)
    await userEvent.click(screen.getByRole('button'))
    expect(onClose).toHaveBeenCalledOnce()
  })
})
