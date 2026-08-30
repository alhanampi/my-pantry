import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import NotificationBell from './index'
import { usePushNotifications } from '../../hooks/usePushNotifications'
import '../../i18n'

vi.mock('../../hooks/usePushNotifications')

function mockState(overrides: Partial<ReturnType<typeof usePushNotifications>> = {}) {
  vi.mocked(usePushNotifications).mockReturnValue({
    isSupported: true,
    permission: 'default',
    isSubscribed: false,
    isLoading: false,
    subscribe: vi.fn(),
    unsubscribe: vi.fn(),
    ...overrides,
  })
}

describe('NotificationBell', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders nothing when push is not supported', () => {
    mockState({ isSupported: false })
    const { container } = render(<NotificationBell />)
    expect(container).toBeEmptyDOMElement()
  })

  it('shows a spinner while loading', () => {
    mockState({ isLoading: true })
    render(<NotificationBell />)
    expect(screen.getByRole('progressbar')).toBeInTheDocument()
  })

  it('shows a disabled bell when permission is denied', () => {
    mockState({ permission: 'denied' })
    render(<NotificationBell />)
    expect(screen.getByRole('button')).toBeDisabled()
  })

  it('calls subscribe when not subscribed and the bell is clicked', async () => {
    const subscribe = vi.fn()
    mockState({ isSubscribed: false, subscribe })
    render(<NotificationBell />)
    await userEvent.click(screen.getByRole('button'))
    expect(subscribe).toHaveBeenCalledOnce()
  })

  it('calls unsubscribe when subscribed and the bell is clicked', async () => {
    const unsubscribe = vi.fn()
    mockState({ isSubscribed: true, unsubscribe })
    render(<NotificationBell />)
    await userEvent.click(screen.getByRole('button'))
    expect(unsubscribe).toHaveBeenCalledOnce()
  })
})
