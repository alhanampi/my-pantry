import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import NewChatOnboarding from './index'
import '../../../i18n'
import i18n from '../../../i18n'

const mockUseAuth = vi.fn()
vi.mock('@clerk/clerk-react', () => ({
  useAuth: () => mockUseAuth(),
}))

function renderOnboarding(props: Partial<Parameters<typeof NewChatOnboarding>[0]> = {}) {
  return render(<NewChatOnboarding onStart={vi.fn()} {...props} />)
}

async function goToDetails() {
  await userEvent.click(screen.getByText(i18n.t('chat.onboardingGoal.quick')))
}

describe('NewChatOnboarding', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockUseAuth.mockReturnValue({ isSignedIn: true, isLoaded: true })
  })

  it('opens on a goal-choice step', () => {
    renderOnboarding()
    expect(screen.getByText(i18n.t('chat.onboardingGoal.title'))).toBeInTheDocument()
    expect(screen.queryByText(i18n.t('chat.onboardingTitle'))).not.toBeInTheDocument()
  })

  it('offers no "plan the week" goal — Mealprep is the only entry point for that', () => {
    renderOnboarding()
    expect(screen.queryByText(i18n.t('chat.onboardingGoal.weekly'))).not.toBeInTheDocument()
  })

  it('starts a chat with the default servings, no restrictions, and an empty query', async () => {
    const onStart = vi.fn()
    renderOnboarding({ onStart })
    await goToDetails()

    await userEvent.click(screen.getByText(i18n.t('chat.onboardingStart')))

    expect(onStart).toHaveBeenCalledWith({ dietaryRestrictions: [], servings: 2, initialQuery: '' })
  })

  it('includes the typed recipe/ingredient query, selected restrictions, and adjusted servings', async () => {
    const onStart = vi.fn()
    renderOnboarding({ onStart })
    await goToDetails()

    await userEvent.type(screen.getByPlaceholderText(i18n.t('chat.onboardingQueryPlaceholder')), 'pollo')
    await userEvent.click(screen.getByText(i18n.t('chat.dietary.vegetarian')))
    await userEvent.click(screen.getByLabelText('increase quantity'))
    await userEvent.click(screen.getByText(i18n.t('chat.onboardingStart')))

    expect(onStart).toHaveBeenCalledWith({ dietaryRestrictions: ['vegetarian'], servings: 3, initialQuery: 'pollo' })
  })

  it('does not offer a custom-restriction text field (that input is for the recipe/ingredient query instead)', async () => {
    renderOnboarding()
    await goToDetails()
    expect(screen.queryByPlaceholderText(i18n.t('chat.onboardingAddOtherPlaceholder'))).not.toBeInTheDocument()
  })

  it('disables the start button while pending', async () => {
    renderOnboarding({ isPending: true })
    await goToDetails()
    expect(screen.getByText(i18n.t('chat.onboardingStart'))).toBeDisabled()
  })

})
