import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import LinkModal from './index'
import '../../i18n'
import i18n from '../../i18n'

const baseProps = {
  open: true,
  partner: null,
  pendingInviteSent: null,
  pendingInvitesReceived: [],
  loadingInvites: false,
  onClose: vi.fn(),
  onSendInvite: vi.fn().mockResolvedValue(undefined),
  onConfirmInvite: vi.fn().mockResolvedValue(undefined),
  onDeclineInvite: vi.fn().mockResolvedValue(undefined),
}

describe('LinkModal (AuthModal)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    Object.assign(navigator, { clipboard: { writeText: vi.fn().mockResolvedValue(undefined) } })
  })

  it('sends a trimmed invite username', async () => {
    const onSendInvite = vi.fn().mockResolvedValue(undefined)
    render(<LinkModal {...baseProps} onSendInvite={onSendInvite} />)

    await userEvent.type(screen.getByLabelText(i18n.t('auth.linkUsernameLabel')), '  pat  ')
    await userEvent.click(screen.getByText(i18n.t('invite.sendButton')))

    expect(onSendInvite).toHaveBeenCalledWith('pat')
  })

  it('shows an error message when sending the invite fails', async () => {
    const onSendInvite = vi.fn().mockRejectedValue(new Error('Username not found'))
    render(<LinkModal {...baseProps} onSendInvite={onSendInvite} />)

    await userEvent.type(screen.getByLabelText(i18n.t('auth.linkUsernameLabel')), 'pat')
    await userEvent.click(screen.getByText(i18n.t('invite.sendButton')))

    expect(await screen.findByText('Username not found')).toBeInTheDocument()
  })

  it('shows the already-linked chip when a partner exists', () => {
    render(<LinkModal {...baseProps} partner={{ id: 'u2', username: 'pat' }} />)
    expect(screen.getByText('@pat')).toBeInTheDocument()
  })

  it('renders a pending received invite and confirms it', async () => {
    const onConfirmInvite = vi.fn().mockResolvedValue(undefined)
    render(
      <LinkModal
        {...baseProps}
        pendingInvitesReceived={[{ token: 't1', senderUsername: 'sam', expiresAt: '2026-01-01' }]}
        onConfirmInvite={onConfirmInvite}
      />
    )

    await userEvent.click(screen.getByText(i18n.t('invite.accept')))
    expect(onConfirmInvite).toHaveBeenCalledWith('t1')
  })

  it('declines a pending received invite', async () => {
    const onDeclineInvite = vi.fn().mockResolvedValue(undefined)
    render(
      <LinkModal
        {...baseProps}
        pendingInvitesReceived={[{ token: 't1', senderUsername: 'sam', expiresAt: '2026-01-01' }]}
        onDeclineInvite={onDeclineInvite}
      />
    )

    await userEvent.click(screen.getByText(i18n.t('invite.decline')))
    expect(onDeclineInvite).toHaveBeenCalledWith('t1')
  })

  it('shows the confirm url and copies it to the clipboard', async () => {
    render(
      <LinkModal
        {...baseProps}
        pendingInviteSent={{ recipientUsername: 'pat', confirmUrl: 'https://x/?invite=abc' }}
      />
    )

    expect(screen.getByText('https://x/?invite=abc')).toBeInTheDocument()
    await userEvent.click(screen.getByLabelText(i18n.t('invite.copyLink')))
    expect(navigator.clipboard.writeText).toHaveBeenCalledWith('https://x/?invite=abc')
  })
})
