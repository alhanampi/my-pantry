import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import NewChatOnboarding from './index'
import '../../../i18n'
import i18n from '../../../i18n'

describe('NewChatOnboarding', () => {
  it('starts a chat with the default servings, no restrictions, and an empty query', async () => {
    const onStart = vi.fn()
    render(<NewChatOnboarding onStart={onStart} />)

    await userEvent.click(screen.getByText(i18n.t('chat.onboardingStart')))

    expect(onStart).toHaveBeenCalledWith({ dietaryRestrictions: [], servings: 2, initialQuery: '' })
  })

  it('includes the typed recipe/ingredient query, selected restrictions, and adjusted servings', async () => {
    const onStart = vi.fn()
    render(<NewChatOnboarding onStart={onStart} />)

    await userEvent.type(screen.getByPlaceholderText(i18n.t('chat.onboardingQueryPlaceholder')), 'pollo')
    await userEvent.click(screen.getByText(i18n.t('chat.dietary.vegetarian')))
    await userEvent.click(screen.getByLabelText('increase quantity'))
    await userEvent.click(screen.getByText(i18n.t('chat.onboardingStart')))

    expect(onStart).toHaveBeenCalledWith({ dietaryRestrictions: ['vegetarian'], servings: 3, initialQuery: 'pollo' })
  })

  it('does not offer a custom-restriction text field (that input is for the recipe/ingredient query instead)', () => {
    render(<NewChatOnboarding onStart={vi.fn()} />)
    expect(screen.queryByPlaceholderText(i18n.t('chat.onboardingAddOtherPlaceholder'))).not.toBeInTheDocument()
  })

  it('disables the start button while pending', () => {
    render(<NewChatOnboarding onStart={vi.fn()} isPending />)
    expect(screen.getByText(i18n.t('chat.onboardingStart'))).toBeDisabled()
  })
})
