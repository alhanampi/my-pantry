import { describe, it, expect, vi, beforeEach } from 'vitest'
import { apiSubscribe, apiUnsubscribe } from './notificationsApi'

describe('notificationsApi', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn())
  })

  it('apiSubscribe posts the subscription and resolves on success', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(new Response(JSON.stringify({ success: true }), { status: 200 }))
    const sub = { endpoint: 'https://push/1', p256dh: 'p', auth: 'a' }

    await apiSubscribe('token', sub)

    expect(fetch).toHaveBeenCalledWith(
      expect.stringContaining('/api/notifications/subscribe'),
      expect.objectContaining({ method: 'POST', body: JSON.stringify(sub) })
    )
  })

  it('apiSubscribe throws the server error message on failure', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(new Response(JSON.stringify({ error: 'Invalid endpoint' }), { status: 400 }))
    await expect(apiSubscribe('token', { endpoint: '', p256dh: '', auth: '' })).rejects.toThrow('Invalid endpoint')
  })

  it('apiUnsubscribe sends a DELETE and resolves on success', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(new Response(JSON.stringify({ success: true }), { status: 200 }))

    await apiUnsubscribe('token')

    expect(fetch).toHaveBeenCalledWith(
      expect.stringContaining('/api/notifications/unsubscribe'),
      expect.objectContaining({ method: 'DELETE' })
    )
  })

  it('apiUnsubscribe throws on failure', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(new Response('not json', { status: 500 }))
    await expect(apiUnsubscribe('token')).rejects.toThrow('Server error')
  })
})
