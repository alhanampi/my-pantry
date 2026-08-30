import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import AddProductModal from './index'
import '../../i18n'
import i18n from '../../i18n'

describe('AddProductModal', () => {
  it('validates required fields and does not call onAccept when name is empty', async () => {
    const onAccept = vi.fn()
    render(<AddProductModal open onAccept={onAccept} onCancel={vi.fn()} />)

    await userEvent.click(screen.getByText(i18n.t('modal.save')))

    expect(onAccept).not.toHaveBeenCalled()
    expect(screen.getByText(i18n.t('modal.nameRequired'))).toBeInTheDocument()
  })

  it('submits the trimmed form data when valid', async () => {
    const onAccept = vi.fn()
    render(<AddProductModal open onAccept={onAccept} onCancel={vi.fn()} />)

    await userEvent.type(screen.getByLabelText(i18n.t('modal.namePlaceholder')), '  Leche  ')
    await userEvent.click(screen.getByText(i18n.t('modal.save')))

    expect(onAccept).toHaveBeenCalledOnce()
    expect(onAccept.mock.calls[0][0]).toMatchObject({ name: 'Leche', quantity: '1' })
  })

  it('pre-fills the form in edit mode', () => {
    const initialData = { name: 'Arroz', quantity: '2', brand: 'Gallo', purchaseDate: '', expiryDate: '', location: '', details: '' }
    render(<AddProductModal open initialData={initialData} onAccept={vi.fn()} onCancel={vi.fn()} />)

    expect(screen.getByDisplayValue('Arroz')).toBeInTheDocument()
    expect(screen.getByText(i18n.t('modal.editPantry'))).toBeInTheDocument()
  })

  it('cancels immediately in edit mode without an exit-confirmation dialog', async () => {
    const onCancel = vi.fn()
    const initialData = { name: 'Arroz', quantity: '2', brand: '', purchaseDate: '', expiryDate: '', location: '', details: '' }
    render(<AddProductModal open initialData={initialData} onAccept={vi.fn()} onCancel={onCancel} />)

    await userEvent.click(screen.getByText(i18n.t('modal.cancel')))

    expect(onCancel).toHaveBeenCalledOnce()
  })

  it('asks for exit confirmation when canceling a dirty add-mode form', async () => {
    const onCancel = vi.fn()
    render(<AddProductModal open onAccept={vi.fn()} onCancel={onCancel} />)

    await userEvent.type(screen.getByLabelText(i18n.t('modal.namePlaceholder')), 'Leche')
    await userEvent.click(screen.getByText(i18n.t('modal.cancel')))

    expect(onCancel).not.toHaveBeenCalled()
    expect(screen.getByText(i18n.t('modal.exitTitle'))).toBeInTheDocument()

    await userEvent.click(screen.getByText(i18n.t('modal.exitConfirm')))
    expect(onCancel).toHaveBeenCalledOnce()
  })

  it('shows the shopping-context title when context is shopping', () => {
    render(<AddProductModal open context="shopping" onAccept={vi.fn()} onCancel={vi.fn()} />)
    expect(screen.getByText(i18n.t('modal.addShopping'))).toBeInTheDocument()
  })
})
