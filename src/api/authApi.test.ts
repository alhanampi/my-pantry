import { describe, it, expect, vi, beforeEach } from 'vitest'
import {
  apiSyncUser,
  apiSendInvite,
  apiGetInviteInfo,
  apiConfirmInvite,
  apiDeclineInvite,
  apiGetPendingInvites,
  apiGetMe,
  apiUpdateUnitSystem,
} from './authApi'

describe('authApi', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn())
  })

  it('apiSyncUser returns the partner from a successful sync', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(
      new Response(JSON.stringify({ user: { partner: { id: 'u2', username: 'pat' } } }), { status: 200 })
    )
    const result = await apiSyncUser('token')
    expect(result).toEqual({ partner: { id: 'u2', username: 'pat' } })
  })

  it('apiSyncUser throws the server error message on failure', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(new Response(JSON.stringify({ error: 'boom' }), { status: 500 }))
    await expect(apiSyncUser('token')).rejects.toThrow('boom')
  })

  it('apiSendInvite returns the confirm url on success', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(
      new Response(JSON.stringify({ recipientUsername: 'pat', confirmUrl: 'https://x/?invite=abc' }), { status: 200 })
    )
    const result = await apiSendInvite('token', 'pat')
    expect(result).toEqual({ recipientUsername: 'pat', confirmUrl: 'https://x/?invite=abc' })
  })

  it('apiSendInvite wraps errors via extractMessage', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(new Response(JSON.stringify({ error: 'already linked' }), { status: 409 }))
    await expect(apiSendInvite('token', 'pat')).rejects.toThrow('already linked')
  })

  it('apiGetInviteInfo returns sender info on success', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(
      new Response(JSON.stringify({ senderUsername: 'sam', expiresAt: '2026-01-01' }), { status: 200 })
    )
    const result = await apiGetInviteInfo('token', 'invite-token')
    expect(result).toEqual({ senderUsername: 'sam', expiresAt: '2026-01-01' })
  })

  it('apiGetInviteInfo throws on a 404', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(new Response(JSON.stringify({ error: 'not found' }), { status: 404 }))
    await expect(apiGetInviteInfo('token', 'bad')).rejects.toThrow('not found')
  })

  it('apiConfirmInvite returns the new partner on success', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(
      new Response(JSON.stringify({ partner: { id: 'u1', username: 'sam' } }), { status: 200 })
    )
    const result = await apiConfirmInvite('token', 'invite-token')
    expect(result).toEqual({ partner: { id: 'u1', username: 'sam' } })
  })

  it('apiDeclineInvite resolves without a value on success', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(new Response(null, { status: 200 }))
    await expect(apiDeclineInvite('token', 'invite-token')).resolves.toBeUndefined()
  })

  it('apiDeclineInvite throws on failure', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(new Response(JSON.stringify({ error: 'gone' }), { status: 410 }))
    await expect(apiDeclineInvite('token', 'invite-token')).rejects.toThrow('gone')
  })

  it('apiGetPendingInvites returns the list on success', async () => {
    const invites = [{ token: 't1', senderUsername: 'sam', expiresAt: '2026-01-01' }]
    vi.mocked(fetch).mockResolvedValueOnce(new Response(JSON.stringify({ invites }), { status: 200 }))
    const result = await apiGetPendingInvites('token')
    expect(result).toEqual({ invites })
  })

  it('apiGetPendingInvites returns an empty list on failure instead of throwing', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(new Response(null, { status: 500 }))
    await expect(apiGetPendingInvites('token')).resolves.toEqual({ invites: [] })
  })

  it('apiGetMe returns the unit system from the user profile', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(
      new Response(JSON.stringify({ user: { unitSystem: 'imperial' } }), { status: 200 }),
    )
    const result = await apiGetMe('token')
    expect(result).toEqual({ unitSystem: 'imperial' })
  })

  it('apiGetMe throws the server error message on failure', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(new Response(JSON.stringify({ error: 'boom' }), { status: 500 }))
    await expect(apiGetMe('token')).rejects.toThrow('boom')
  })

  it('apiUpdateUnitSystem resolves without a value on success', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(new Response(null, { status: 200 }))
    await expect(apiUpdateUnitSystem('token', 'metric')).resolves.toBeUndefined()
    expect(fetch).toHaveBeenCalledWith(
      expect.stringContaining('/api/auth/me'),
      expect.objectContaining({ method: 'PATCH', body: JSON.stringify({ unitSystem: 'metric' }) }),
    )
  })

  it('apiUpdateUnitSystem throws the server error message on failure', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(new Response(JSON.stringify({ error: 'bad value' }), { status: 400 }))
    await expect(apiUpdateUnitSystem('token', 'metric')).rejects.toThrow('bad value')
  })
})
