import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import Header from './index'
import { ThemeContextProvider } from '../../contexts/ThemeContext'
import '../../i18n'
import i18n from '../../i18n'

const mockUseUser = vi.fn()
const mockUseClerk = vi.fn()
vi.mock('@clerk/clerk-react', () => ({
  useUser: () => mockUseUser(),
  useClerk: () => mockUseClerk(),
}))

const mockUseAuth = vi.fn()
vi.mock('../../context/AuthContext', () => ({
  useAuth: () => mockUseAuth(),
}))

vi.mock('../../hooks/usePushNotifications', () => ({
  usePushNotifications: () => ({
    isSupported: false,
    permission: 'default',
    isSubscribed: false,
    isLoading: false,
    subscribe: vi.fn(),
    unsubscribe: vi.fn(),
  }),
}))

function renderHeader(props: Partial<React.ComponentProps<typeof Header>> = {}) {
  return render(
    <ThemeContextProvider>
      <Header {...baseProps} {...props} />
    </ThemeContextProvider>
  )
}

const baseProps = {
  onAddClick: vi.fn(),
  searchQuery: '',
  onSearchChange: vi.fn(),
  onAboutClick: vi.fn(),
  currentView: 'pantry' as const,
  onViewChange: vi.fn(),
}

describe('Header', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockUseAuth.mockReturnValue({ partner: null, openLinkModal: vi.fn() })
  })

  it('shows the guest greeting and a sign-in button when signed out', () => {
    mockUseUser.mockReturnValue({ user: null, isSignedIn: false })
    mockUseClerk.mockReturnValue({ openSignIn: vi.fn(), signOut: vi.fn() })

    renderHeader()

    expect(screen.getByText(i18n.t('auth.signIn'))).toBeInTheDocument()
  })

  it('shows the username greeting when signed in', () => {
    mockUseUser.mockReturnValue({ user: { username: 'pat', firstName: null }, isSignedIn: true })
    mockUseClerk.mockReturnValue({ openSignIn: vi.fn(), signOut: vi.fn() })

    renderHeader()

    expect(screen.getByText(i18n.t('auth.greeting', { name: 'pat' }))).toBeInTheDocument()
  })

  it('switches to the shopping tab and calls onViewChange', async () => {
    mockUseUser.mockReturnValue({ user: null, isSignedIn: false })
    mockUseClerk.mockReturnValue({ openSignIn: vi.fn(), signOut: vi.fn() })
    const onViewChange = vi.fn()

    renderHeader({ onViewChange })

    await userEvent.click(screen.getByText(i18n.t('nav.shopping')))
    expect(onViewChange).toHaveBeenCalledWith('shopping')
  })

  it('opens the sign-out confirmation and calls signOut on confirm', async () => {
    mockUseUser.mockReturnValue({ user: { username: 'pat' }, isSignedIn: true })
    const signOut = vi.fn()
    mockUseClerk.mockReturnValue({ openSignIn: vi.fn(), signOut })

    renderHeader()

    await userEvent.click(screen.getByLabelText(i18n.t('auth.signOut')))
    expect(screen.getByText(i18n.t('auth.logoutConfirmTitle'))).toBeInTheDocument()

    const signOutButtons = screen.getAllByText(i18n.t('auth.signOut'))
    await userEvent.click(signOutButtons[signOutButtons.length - 1])
    expect(signOut).toHaveBeenCalledOnce()
  })

  it('calls onSearchChange when typing in the search box', async () => {
    mockUseUser.mockReturnValue({ user: null, isSignedIn: false })
    mockUseClerk.mockReturnValue({ openSignIn: vi.fn(), signOut: vi.fn() })
    const onSearchChange = vi.fn()

    renderHeader({ onSearchChange })

    const [searchBox] = screen.getAllByPlaceholderText(i18n.t('header.searchPlaceholder'))
    await userEvent.type(searchBox, 'a')
    expect(onSearchChange).toHaveBeenCalledWith('a')
  })
})
