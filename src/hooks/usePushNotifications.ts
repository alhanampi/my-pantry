import { useState, useEffect, useCallback } from 'react'
import { useAuth } from '@clerk/clerk-react'
import { apiSubscribe, apiUnsubscribe } from '../api/notificationsApi'

const VAPID_PUBLIC_KEY = import.meta.env.VITE_VAPID_PUBLIC_KEY as string

function urlBase64ToUint8Array(base64String: string): Uint8Array<ArrayBuffer> {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4)
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/')
  const raw = atob(base64)
  const buffer = new ArrayBuffer(raw.length)
  const view = new Uint8Array(buffer)
  for (let i = 0; i < raw.length; i++) view[i] = raw.charCodeAt(i)
  return view
}

export interface PushNotificationState {
  isSupported: boolean
  permission: NotificationPermission
  isSubscribed: boolean
  isLoading: boolean
  subscribe: () => Promise<void>
  unsubscribe: () => Promise<void>
}

export function usePushNotifications(): PushNotificationState {
  const { getToken, isSignedIn } = useAuth()
  const [permission, setPermission] = useState<NotificationPermission>('default')
  const [isSubscribed, setIsSubscribed] = useState(false)
  const [isLoading, setIsLoading] = useState(false)

  const isSupported =
    typeof window !== 'undefined' &&
    'Notification' in window &&
    'serviceWorker' in navigator &&
    'PushManager' in window &&
    !!VAPID_PUBLIC_KEY

  // Sync permission and subscription state from browser on mount
  useEffect(() => {
    if (!isSupported || !isSignedIn) return
    setPermission(Notification.permission)

    navigator.serviceWorker.ready
      .then((reg) => reg.pushManager.getSubscription())
      .then((sub) => setIsSubscribed(!!sub))
      .catch(() => {})
  }, [isSupported, isSignedIn])

  const subscribe = useCallback(async () => {
    if (!isSupported || !isSignedIn) return
    setIsLoading(true)
    try {
      const result = await Notification.requestPermission()
      setPermission(result)
      if (result !== 'granted') return

      const reg = await navigator.serviceWorker.ready
      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
      })

      const key = sub.getKey('p256dh')
      const authKey = sub.getKey('auth')
      if (!key || !authKey) throw new Error('Missing push subscription keys')

      const token = await getToken()
      if (!token) throw new Error('Not authenticated')

      await apiSubscribe(token, {
        endpoint: sub.endpoint,
        p256dh: btoa(String.fromCharCode(...new Uint8Array(key))),
        auth: btoa(String.fromCharCode(...new Uint8Array(authKey))),
      })

      setIsSubscribed(true)
    } finally {
      setIsLoading(false)
    }
  }, [isSupported, isSignedIn, getToken])

  const unsubscribe = useCallback(async () => {
    if (!isSupported || !isSignedIn) return
    setIsLoading(true)
    try {
      const reg = await navigator.serviceWorker.ready
      const sub = await reg.pushManager.getSubscription()
      await sub?.unsubscribe()

      const token = await getToken()
      if (!token) throw new Error('Not authenticated')
      await apiUnsubscribe(token)

      setIsSubscribed(false)
    } finally {
      setIsLoading(false)
    }
  }, [isSupported, isSignedIn, getToken])

  return { isSupported, permission, isSubscribed, isLoading, subscribe, unsubscribe }
}
