import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import QuickReplies from './index'
import '../../../i18n'
import i18n from '../../../i18n'

describe('QuickReplies', () => {
  it('calls onPickPhrase with the phrase for the tapped time chip', async () => {
    const onPickPhrase = vi.fn()
    render(
      <QuickReplies
        pantryItemNames={[]}
        aiIngredientSuggestions={[]}
        onPickPhrase={onPickPhrase}
        onPickIngredient={vi.fn()}
      />,
    )

    await userEvent.click(screen.getByText(i18n.t('chat.quickReplies.time30Label')))

    expect(onPickPhrase).toHaveBeenCalledWith(i18n.t('chat.quickReplies.time30Phrase'))
  })

  it('calls onPickPhrase with the translated label for a tapped dietary chip', async () => {
    const onPickPhrase = vi.fn()
    render(
      <QuickReplies
        pantryItemNames={[]}
        aiIngredientSuggestions={[]}
        onPickPhrase={onPickPhrase}
        onPickIngredient={vi.fn()}
      />,
    )

    await userEvent.click(screen.getByText(i18n.t('chat.dietary.vegetarian')))

    expect(onPickPhrase).toHaveBeenCalledWith(i18n.t('chat.dietary.vegetarian'))
  })

  it('calls onPickPhrase with the phrase for a tapped servings chip', async () => {
    const onPickPhrase = vi.fn()
    render(
      <QuickReplies
        pantryItemNames={[]}
        aiIngredientSuggestions={[]}
        onPickPhrase={onPickPhrase}
        onPickIngredient={vi.fn()}
      />,
    )

    await userEvent.click(screen.getByText(i18n.t('chat.quickReplies.servings4Label')))

    expect(onPickPhrase).toHaveBeenCalledWith(i18n.t('chat.quickReplies.servings4Phrase'))
  })

  it('renders no ingredient chips when the pantry is empty', () => {
    render(
      <QuickReplies
        pantryItemNames={[]}
        aiIngredientSuggestions={[]}
        onPickPhrase={vi.fn()}
        onPickIngredient={vi.fn()}
      />,
    )
    expect(screen.queryByLabelText(i18n.t('chat.quickReplies.ingredientsGroupLabel'))).not.toBeInTheDocument()
  })

  it('renders up to 8 pantry-item chips and calls onPickIngredient with the tapped name', async () => {
    const onPickIngredient = vi.fn()
    const names = ['Arroz', 'Pollo', 'Leche', 'Huevos', 'Manzana', 'Pan', 'Queso', 'Tomate', 'Cebolla']
    render(
      <QuickReplies
        pantryItemNames={names}
        aiIngredientSuggestions={[]}
        onPickPhrase={vi.fn()}
        onPickIngredient={onPickIngredient}
      />,
    )

    expect(screen.getByText('Arroz')).toBeInTheDocument()
    expect(screen.queryByText('Cebolla')).not.toBeInTheDocument() // 9th item, past the cap

    await userEvent.click(screen.getByText('Pollo'))
    expect(onPickIngredient).toHaveBeenCalledWith('Pollo')
  })

  it('renders no AI-suggested chips when there are none', () => {
    render(
      <QuickReplies
        pantryItemNames={[]}
        aiIngredientSuggestions={[]}
        onPickPhrase={vi.fn()}
        onPickIngredient={vi.fn()}
      />,
    )
    expect(screen.queryByLabelText(i18n.t('chat.quickReplies.aiIngredientsGroupLabel'))).not.toBeInTheDocument()
  })

  it('renders AI-suggested ingredient chips and calls onPickIngredient with the tapped name', async () => {
    const onPickIngredient = vi.fn()
    render(
      <QuickReplies
        pantryItemNames={[]}
        aiIngredientSuggestions={['Jengibre', 'Ajo', 'Salsa de soja']}
        onPickPhrase={vi.fn()}
        onPickIngredient={onPickIngredient}
      />,
    )

    expect(screen.getByLabelText(i18n.t('chat.quickReplies.aiIngredientsGroupLabel'))).toBeInTheDocument()
    expect(screen.getByText('Jengibre')).toBeInTheDocument()

    await userEvent.click(screen.getByText('Ajo'))
    expect(onPickIngredient).toHaveBeenCalledWith('Ajo')
  })
})
