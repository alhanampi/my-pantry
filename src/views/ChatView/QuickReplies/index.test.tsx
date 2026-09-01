import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import QuickReplies from './index'
import '../../../i18n'
import i18n from '../../../i18n'

describe('QuickReplies', () => {
  it('calls onPickTime with the phrase for the tapped time chip', async () => {
    const onPickTime = vi.fn()
    render(<QuickReplies pantryItemNames={[]} onPickTime={onPickTime} onPickIngredient={vi.fn()} />)

    await userEvent.click(screen.getByText(i18n.t('chat.quickReplies.time30Label')))

    expect(onPickTime).toHaveBeenCalledWith(i18n.t('chat.quickReplies.time30Phrase'))
  })

  it('renders no ingredient chips when the pantry is empty', () => {
    render(<QuickReplies pantryItemNames={[]} onPickTime={vi.fn()} onPickIngredient={vi.fn()} />)
    expect(screen.queryByLabelText(i18n.t('chat.quickReplies.ingredientsGroupLabel'))).not.toBeInTheDocument()
  })

  it('renders up to 8 pantry-item chips and calls onPickIngredient with the tapped name', async () => {
    const onPickIngredient = vi.fn()
    const names = ['Arroz', 'Pollo', 'Leche', 'Huevos', 'Manzana', 'Pan', 'Queso', 'Tomate', 'Cebolla']
    render(<QuickReplies pantryItemNames={names} onPickTime={vi.fn()} onPickIngredient={onPickIngredient} />)

    expect(screen.getByText('Arroz')).toBeInTheDocument()
    expect(screen.queryByText('Cebolla')).not.toBeInTheDocument() // 9th item, past the cap

    await userEvent.click(screen.getByText('Pollo'))
    expect(onPickIngredient).toHaveBeenCalledWith('Pollo')
  })
})
