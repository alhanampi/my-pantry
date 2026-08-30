import { describe, it, expect, vi, beforeEach } from 'vitest'

const mockSendNotification = vi.hoisted(() => vi.fn().mockResolvedValue(undefined))
const mockSetVapidDetails = vi.hoisted(() => vi.fn())
vi.mock('web-push', () => ({
  default: { setVapidDetails: mockSetVapidDetails, sendNotification: mockSendNotification },
}))

describe('sendPush', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('configures VAPID details from env vars on import', async () => {
    process.env.VAPID_SUBJECT = 'mailto:test@example.com'
    process.env.VAPID_PUBLIC_KEY = 'pub-key'
    process.env.VAPID_PRIVATE_KEY = 'priv-key'

    await import('./webpush')

    expect(mockSetVapidDetails).toHaveBeenCalledWith('mailto:test@example.com', 'pub-key', 'priv-key')
  })

  it('calls webpush.sendNotification with the endpoint, keys, and JSON payload', async () => {
    const { sendPush } = await import('./webpush')
    const subscription = { endpoint: 'https://push/1', p256dh: 'p', auth: 'a' }
    const payload = { title: 'Hi', body: 'body', url: '/' }

    await sendPush(subscription, payload)

    expect(mockSendNotification).toHaveBeenCalledWith(
      { endpoint: 'https://push/1', keys: { p256dh: 'p', auth: 'a' } },
      JSON.stringify(payload)
    )
  })
})
