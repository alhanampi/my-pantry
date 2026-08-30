import { describe, it, expect, vi, beforeEach } from 'vitest'

const mockSend = vi.hoisted(() => vi.fn().mockResolvedValue({ data: { id: 'email1' } }))
vi.mock('resend', () => ({
  Resend: vi.fn().mockImplementation(function MockResend() {
    return { emails: { send: mockSend } }
  }),
}))

describe('sendLinkInvitation', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.resetModules()
  })

  it('logs to the console instead of sending an email when RESEND_API_KEY is not set', async () => {
    delete process.env.RESEND_API_KEY
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {})

    const { sendLinkInvitation } = await import('./email')
    await sendLinkInvitation({ to: 'pat@example.com', senderUsername: 'sam', token: 't1', appUrl: 'https://x' })

    expect(logSpy).toHaveBeenCalled()
    expect(mockSend).not.toHaveBeenCalled()
    logSpy.mockRestore()
  })

  it('sends an email via Resend when RESEND_API_KEY is set', async () => {
    process.env.RESEND_API_KEY = 're_test_key'
    process.env.EMAIL_FROM = 'Mi Despensa <noreply@example.com>'

    const { sendLinkInvitation } = await import('./email')
    await sendLinkInvitation({ to: 'pat@example.com', senderUsername: 'sam', token: 't1', appUrl: 'https://x' })

    expect(mockSend).toHaveBeenCalledWith(
      expect.objectContaining({
        from: 'Mi Despensa <noreply@example.com>',
        to: 'pat@example.com',
        subject: expect.stringContaining('@sam'),
        html: expect.stringContaining('https://x/?invite=t1'),
      })
    )

    delete process.env.RESEND_API_KEY
    delete process.env.EMAIL_FROM
  })
})
