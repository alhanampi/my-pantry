import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import NewChatOnboarding from './index'
import { usePantryChatSuggestions } from '../../../hooks/useChat'
import '../../../i18n'
import i18n from '../../../i18n'

vi.mock('../../../hooks/useChat')

const mockUseAuth = vi.fn()
vi.mock('@clerk/clerk-react', () => ({
  useAuth: () => mockUseAuth(),
}))

function renderOnboarding(props: Partial<Parameters<typeof NewChatOnboarding>[0]> = {}) {
  return render(<NewChatOnboarding onStart={vi.fn()} onGoToMealprep={vi.fn()} {...props} />)
}

async function goToDetails() {
  await userEvent.click(screen.getByText(i18n.t('chat.onboardingGoal.quick')))
}

describe('NewChatOnboarding', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockUseAuth.mockReturnValue({ isSignedIn: true, isLoaded: true })
    vi.mocked(usePantryChatSuggestions).mockReturnValue({ data: [], isLoading: false } as never)
  })

  it('opens on a goal-choice step', () => {
    renderOnboarding()
    expect(screen.getByText(i18n.t('chat.onboardingGoal.title'))).toBeInTheDocument()
    expect(screen.queryByText(i18n.t('chat.onboardingTitle'))).not.toBeInTheDocument()
  })

  it('calls onGoToMealprep when "plan the week" is chosen, without touching onStart', async () => {
    const onStart = vi.fn()
    const onGoToMealprep = vi.fn()
    renderOnboarding({ onStart, onGoToMealprep })

    await userEvent.click(screen.getByText(i18n.t('chat.onboardingGoal.weekly')))

    expect(onGoToMealprep).toHaveBeenCalled()
    expect(onStart).not.toHaveBeenCalled()
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

  it('offers pantry-suggestion preset chips that skip straight to onStart', async () => {
    vi.mocked(usePantryChatSuggestions).mockReturnValue({
      data: [{ id: 1, title: 'Arroz con pollo', image: '', servings: 2, readyInMinutes: 20, ingredientNames: [], calories: 300 }],
      isLoading: false,
    } as never)
    const onStart = vi.fn()
    renderOnboarding({ onStart })
    await goToDetails()

    await userEvent.click(screen.getByText('Arroz con pollo'))

    expect(onStart).toHaveBeenCalledWith({ dietaryRestrictions: [], servings: 2, initialQuery: 'Arroz con pollo' })
  })
})
