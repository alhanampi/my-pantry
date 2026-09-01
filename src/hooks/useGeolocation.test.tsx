import { describe, it, expect } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useGeolocation } from './useGeolocation'
import '../i18n'
import i18n from '../i18n'

describe('useGeolocation', () => {
  it('sets an error when geolocation is unsupported', () => {
    const original = navigator.geolocation
    // @ts-expect-error simulate missing geolocation
    delete navigator.geolocation

    const { result } = renderHook(() => useGeolocation())
    act(() => result.current.requestLocation())

    expect(result.current.error).toBe(i18n.t('stores.notSupported'))
    expect(result.current.coords).toBeNull()

    Object.defineProperty(navigator, 'geolocation', { value: original, configurable: true })
  })

  it('sets coords on a successful geolocation callback', () => {
    const original = navigator.geolocation
    Object.defineProperty(navigator, 'geolocation', {
      value: {
        getCurrentPosition: (success: PositionCallback) =>
          success({ coords: { latitude: 1, longitude: 2 } } as GeolocationPosition),
      },
      configurable: true,
    })

    const { result } = renderHook(() => useGeolocation())
    act(() => result.current.requestLocation())

    expect(result.current.coords).toEqual({ lat: 1, lng: 2 })
    expect(result.current.error).toBeNull()

    Object.defineProperty(navigator, 'geolocation', { value: original, configurable: true })
  })

  it('maps a permission-denied error (code 1) to the locationDenied message', () => {
    const original = navigator.geolocation
    Object.defineProperty(navigator, 'geolocation', {
      value: {
        getCurrentPosition: (_success: PositionCallback, error: PositionErrorCallback) =>
          error({ code: 1 } as GeolocationPositionError),
      },
      configurable: true,
    })

    const { result } = renderHook(() => useGeolocation())
    act(() => result.current.requestLocation())

    expect(result.current.error).toBe(i18n.t('stores.locationDenied'))

    Object.defineProperty(navigator, 'geolocation', { value: original, configurable: true })
  })
})
