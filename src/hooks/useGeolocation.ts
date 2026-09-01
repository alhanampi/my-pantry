import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import type { Coordinates } from '../utils/types'

// Extracted from ShoppingView/NearbyStores' previously-inline
// navigator.geolocation call so it can be reused by ChatView too — same
// behavior/i18n error strings, just shared.
export function useGeolocation() {
  const { t } = useTranslation()
  const [coords, setCoords] = useState<Coordinates | null>(null)
  const [error, setError] = useState<string | null>(null)

  const requestLocation = (): void => {
    setError(null)
    if (!navigator.geolocation) {
      setError(t('stores.notSupported'))
      return
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => setCoords({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
      (err) => {
        setError(err.code === 1 ? t('stores.locationDenied') : t('stores.locationError'))
      },
    )
  }

  return { coords, error, requestLocation }
}
