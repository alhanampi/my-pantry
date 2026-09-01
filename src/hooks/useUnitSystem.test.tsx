import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, waitFor, act } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { ReactNode } from 'react'
import { useUnitSystem, resolveUnitSystem } from './useUnitSystem'
import { guestStorage } from './useGuestStorage'
import * as authApi from '../api/authApi'
import i18n from '../i18n'
import '../i18n'

vi.mock('../api/authApi')
vi.mock('./useGuestStorage', () => ({
  guestStorage: {
    getUnitSystem: vi.fn(() => null),
    setUnitSystem: vi.fn(),
  },
}))

const mockUseAuth = vi.fn()
vi.mock('@clerk/clerk-react', () => ({
  useAuth: () => mockUseAuth(),
}))

function wrapper({ children }: { children: ReactNode }) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return <QueryClientProvider client={qc}>{children}</QueryClientProvider>
}

describe('resolveUnitSystem', () => {
  it('returns the explicit choice regardless of language', () => {
    expect(resolveUnitSystem('imperial', 'es')).toBe('imperial')
    expect(resolveUnitSystem('metric', 'en')).toBe('metric')
  })

  it('defaults to metric for Spanish, imperial otherwise, when unset', () => {
    expect(resolveUnitSystem(null, 'es')).toBe('metric')
    expect(resolveUnitSystem(undefined, 'en')).toBe('imperial')
  })
})

describe('useUnitSystem', () => {
  beforeEach(async () => {
    vi.clearAllMocks()
    await i18n.changeLanguage('en')
  })

  afterEach(async () => {
    await i18n.changeLanguage('en')
  })

  it('signed-in: resolves from the account preference once loaded', async () => {
    mockUseAuth.mockReturnValue({ isSignedIn: true, isLoaded: true, getToken: vi.fn().mockResolvedValue('token-123') })
    vi.mocked(authApi.apiGetMe).mockResolvedValue({ unitSystem: 'imperial' })

    const { result } = renderHook(() => useUnitSystem(), { wrapper })

    await waitFor(() => expect(result.current.unitSystem).toBe('imperial'))
  })

  it('signed-in: falls back to the language default while the account preference is null', async () => {
    mockUseAuth.mockReturnValue({ isSignedIn: true, isLoaded: true, getToken: vi.fn().mockResolvedValue('token-123') })
    vi.mocked(authApi.apiGetMe).mockResolvedValue({ unitSystem: null })
    await i18n.changeLanguage('es')

    const { result } = renderHook(() => useUnitSystem(), { wrapper })

    await waitFor(() => expect(vi.mocked(authApi.apiGetMe)).toHaveBeenCalled())
    expect(result.current.unitSystem).toBe('metric')
  })

  it('signed-in: setUnitSystem persists via PATCH /me', async () => {
    mockUseAuth.mockReturnValue({ isSignedIn: true, isLoaded: true, getToken: vi.fn().mockResolvedValue('token-123') })
    vi.mocked(authApi.apiGetMe).mockResolvedValue({ unitSystem: null })
    vi.mocked(authApi.apiUpdateUnitSystem).mockResolvedValue(undefined)

    const { result } = renderHook(() => useUnitSystem(), { wrapper })
    act(() => result.current.setUnitSystem('imperial'))

    await waitFor(() => expect(authApi.apiUpdateUnitSystem).toHaveBeenCalledWith('token-123', 'imperial'))
    await waitFor(() => expect(result.current.unitSystem).toBe('imperial'))
  })

  it('guest: resolves from guestStorage, defaulting to the language when unset', async () => {
    mockUseAuth.mockReturnValue({ isSignedIn: false, isLoaded: true, getToken: vi.fn() })
    vi.mocked(guestStorage.getUnitSystem).mockReturnValue(null)
    await i18n.changeLanguage('es')

    const { result } = renderHook(() => useUnitSystem(), { wrapper })

    expect(result.current.unitSystem).toBe('metric')
  })

  it('guest: setUnitSystem writes to guestStorage', async () => {
    mockUseAuth.mockReturnValue({ isSignedIn: false, isLoaded: true, getToken: vi.fn() })
    vi.mocked(guestStorage.getUnitSystem).mockReturnValue(null)

    const { result } = renderHook(() => useUnitSystem(), { wrapper })
    act(() => result.current.setUnitSystem('metric'))

    await waitFor(() => expect(guestStorage.setUnitSystem).toHaveBeenCalledWith('metric'))
    await waitFor(() => expect(result.current.unitSystem).toBe('metric'))
    expect(authApi.apiUpdateUnitSystem).not.toHaveBeenCalled()
  })
})
