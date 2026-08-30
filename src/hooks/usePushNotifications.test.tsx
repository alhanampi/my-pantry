import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, waitFor, act } from '@testing-library/react'

const mockUseAuth = vi.fn()
vi.mock('@clerk/clerk-react', () => ({ useAuth: () => mockUseAuth() }))
vi.mock('../api/notificationsApi')

function fakeSubscription(overrides: Partial<{ endpoint: string }> = {}) {
  return {
    endpoint: overrides.endpoint ?? 'https://push.example.com/abc',
    getKey: (name: string) => new TextEncoder().encode(name === 'p256dh' ? 'p256dh-key' : 'auth-key').buffer,
    unsubscribe: vi.fn().mockResolvedValue(true),
  }
}

describe('usePushNotifications', () => {
  beforeEach(async () => {
    vi.resetModules()
    vi.clearAllMocks()
    vi.stubEnv('VITE_VAPID_PUBLIC_KEY', 'test-vapid-key')
    mockUseAuth.mockReturnValue({ isSignedIn: true, getToken: vi.fn().mockResolvedValue('token-123') })
  })

  afterEach(() => {
    vi.unstubAllEnvs()
    vi.unstubAllGlobals()
  })

  it('isSupported is false when the browser push APIs are missing', async () => {
    const { usePushNotifications } = await import('./usePushNotifications')
    const { result } = renderHook(() => usePushNotifications())
    expect(result.current.isSupported).toBe(false)
  })

  it('subscribes successfully when supported and permission is granted', async () => {
    const sub = fakeSubscription()
    const registration = {
      pushManager: {
        getSubscription: vi.fn().mockResolvedValue(null),
        subscribe: vi.fn().mockResolvedValue(sub),
      },
    }
    vi.stubGlobal('Notification', { permission: 'default', requestPermission: vi.fn().mockResolvedValue('granted') })
    vi.stubGlobal('PushManager', class {})
    Object.defineProperty(navigator, 'serviceWorker', {
      value: { ready: Promise.resolve(registration) },
      configurable: true,
    })

    const { usePushNotifications } = await import('./usePushNotifications')
    const { apiSubscribe } = await import('../api/notificationsApi')
    const { result } = renderHook(() => usePushNotifications())

    expect(result.current.isSupported).toBe(true)

    await act(async () => {
      await result.current.subscribe()
    })

    expect(registration.pushManager.subscribe).toHaveBeenCalled()
    expect(apiSubscribe).toHaveBeenCalledWith('token-123', expect.objectContaining({ endpoint: sub.endpoint }))
    await waitFor(() => expect(result.current.isSubscribed).toBe(true))
  })

  it('unsubscribes and calls the API', async () => {
    const sub = fakeSubscription()
    const registration = {
      pushManager: {
        getSubscription: vi.fn().mockResolvedValue(sub),
        subscribe: vi.fn(),
      },
    }
    vi.stubGlobal('Notification', { permission: 'granted', requestPermission: vi.fn() })
    vi.stubGlobal('PushManager', class {})
    Object.defineProperty(navigator, 'serviceWorker', {
      value: { ready: Promise.resolve(registration) },
      configurable: true,
    })

    const { usePushNotifications } = await import('./usePushNotifications')
    const { apiUnsubscribe } = await import('../api/notificationsApi')
    const { result } = renderHook(() => usePushNotifications())

    await waitFor(() => expect(result.current.isSubscribed).toBe(true))

    await act(async () => {
      await result.current.unsubscribe()
    })

    expect(sub.unsubscribe).toHaveBeenCalled()
    expect(apiUnsubscribe).toHaveBeenCalledWith('token-123')
    expect(result.current.isSubscribed).toBe(false)
  })
})
