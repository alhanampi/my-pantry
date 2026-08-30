import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import { AuthProvider } from './AuthContext'
import '../i18n'
import i18n from '../i18n'

const mockUseUser = vi.fn()
const mockUseClerkAuth = vi.fn()
vi.mock('@clerk/clerk-react', () => ({
  useUser: () => mockUseUser(),
  useAuth: () => mockUseClerkAuth(),
}))

const mockMigrationMutate = vi.fn()
let migrationState = { isError: false, mutate: mockMigrationMutate, reset: vi.fn() }
vi.mock('../hooks/useGuestMigration', () => ({
  useGuestMigration: () => migrationState,
}))

vi.mock('../api/authApi', () => ({
  apiSyncUser: vi.fn().mockResolvedValue({ partner: null }),
  apiGetInviteInfo: vi.fn(),
  apiSendInvite: vi.fn(),
  apiConfirmInvite: vi.fn(),
  apiDeclineInvite: vi.fn(),
  apiGetPendingInvites: vi.fn().mockResolvedValue({ invites: [] }),
}))

vi.mock('../components/AuthModal', () => ({
  default: () => null,
}))

import * as authApi from '../api/authApi'

describe('AuthProvider', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    migrationState = { isError: false, mutate: mockMigrationMutate, reset: vi.fn() }
    mockUseUser.mockReturnValue({ user: null, isSignedIn: false, isLoaded: true })
    mockUseClerkAuth.mockReturnValue({ getToken: vi.fn().mockResolvedValue('token-123') })
    window.history.replaceState({}, '', '/')
  })

  it('renders children', () => {
    render(
      <AuthProvider>
        <div>child content</div>
      </AuthProvider>
    )
    expect(screen.getByText('child content')).toBeInTheDocument()
  })

  it('shows the migration-error snackbar when the guest migration fails', () => {
    migrationState = { ...migrationState, isError: true }
    render(
      <AuthProvider>
        <div />
      </AuthProvider>
    )
    expect(screen.getByText(i18n.t('auth.errorGeneric'))).toBeInTheDocument()
  })

  it('parses ?invite=<token> from the URL, shows the confirm dialog, and cleans the URL', async () => {
    window.history.replaceState({}, '', '/?invite=abc123')
    mockUseUser.mockReturnValue({ user: { id: 'u1' }, isSignedIn: true, isLoaded: true })
    vi.mocked(authApi.apiGetInviteInfo).mockResolvedValue({ senderUsername: 'sam', expiresAt: '2026-01-01' })

    render(
      <AuthProvider>
        <div />
      </AuthProvider>
    )

    await waitFor(() => expect(screen.getByText(i18n.t('invite.confirmTitle'))).toBeInTheDocument())
    expect(screen.getByText(i18n.t('invite.confirmBody', { username: 'sam' }))).toBeInTheDocument()
    expect(window.location.search).toBe('')
  })

  it('triggers guest migration once signed in', () => {
    mockUseUser.mockReturnValue({ user: { id: 'u1' }, isSignedIn: true, isLoaded: true })
    render(
      <AuthProvider>
        <div />
      </AuthProvider>
    )
    expect(mockMigrationMutate).toHaveBeenCalled()
  })
})
