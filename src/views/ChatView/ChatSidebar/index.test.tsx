import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import ChatSidebar from './index'
import '../../../i18n'
import i18n from '../../../i18n'
import type { ChatConversation } from '../../../utils/types'

const conversation = (overrides: Partial<ChatConversation> = {}): ChatConversation => ({
  id: 'c1',
  title: 'My conversation',
  dietaryRestrictions: [],
  servings: 2,
  updatedAt: '',
  ...overrides,
})

describe('ChatSidebar', () => {
  it('shows the empty-sidebar message when there are no conversations', () => {
    render(
      <ChatSidebar
        conversations={[]}
        activeConversationId={null}
        onSelect={vi.fn()}
        onNewChat={vi.fn()}
        onDeleteClick={vi.fn()}
      />,
    )
    expect(screen.getByText(i18n.t('chat.emptySidebar'))).toBeInTheDocument()
  })

  it('calls onSelect when a conversation is clicked', async () => {
    const onSelect = vi.fn()
    render(
      <ChatSidebar
        conversations={[conversation()]}
        activeConversationId={null}
        onSelect={onSelect}
        onNewChat={vi.fn()}
        onDeleteClick={vi.fn()}
      />,
    )
    await userEvent.click(screen.getByText('My conversation'))
    expect(onSelect).toHaveBeenCalledWith('c1')
  })

  it('calls onDeleteClick without triggering onSelect', async () => {
    const onSelect = vi.fn()
    const onDeleteClick = vi.fn()
    render(
      <ChatSidebar
        conversations={[conversation()]}
        activeConversationId={null}
        onSelect={onSelect}
        onNewChat={vi.fn()}
        onDeleteClick={onDeleteClick}
      />,
    )
    await userEvent.click(screen.getByLabelText(i18n.t('chat.deleteChat')))
    expect(onDeleteClick).toHaveBeenCalledWith(conversation())
    expect(onSelect).not.toHaveBeenCalled()
  })

  it('calls onNewChat from the new-chat button', async () => {
    const onNewChat = vi.fn()
    render(
      <ChatSidebar
        conversations={[]}
        activeConversationId={null}
        onSelect={vi.fn()}
        onNewChat={onNewChat}
        onDeleteClick={vi.fn()}
      />,
    )
    await userEvent.click(screen.getByText(i18n.t('chat.newChat')))
    expect(onNewChat).toHaveBeenCalledOnce()
  })
})
