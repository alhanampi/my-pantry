import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import ChatMessageList from './index'
import type { ChatMessageItem } from '../../../utils/types'

const msg = (overrides: Partial<ChatMessageItem> = {}): ChatMessageItem => ({
  id: '1',
  role: 'assistant',
  content: '',
  createdAt: '',
  ...overrides,
})

describe('ChatMessageList', () => {
  it('renders user text as plain text, not reinterpreted as markdown', () => {
    render(<ChatMessageList messages={[msg({ id: 'u1', role: 'user', content: '**not bold**' })]} />)
    expect(screen.getByText('**not bold**')).toBeInTheDocument()
  })

  it('renders assistant text as markdown', () => {
    render(<ChatMessageList messages={[msg({ id: 'a1', role: 'assistant', content: '**bold** text' })]} />)
    const bold = screen.getByText('bold')
    expect(bold.tagName).toBe('STRONG')
  })

  it('strips a raw HTML tag out of the assistant markdown instead of rendering it live', () => {
    render(
      <ChatMessageList
        messages={[msg({ id: 'a2', role: 'assistant', content: '<img src=x onerror=alert(1)>hi' })]}
      />,
    )
    expect(document.querySelector('img')).not.toBeInTheDocument()
    expect(screen.getByText(/hi/)).toBeInTheDocument()
  })
})
