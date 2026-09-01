import { describe, it, expect, vi } from 'vitest'
import { createRef } from 'react'
import { render, screen, act } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import ChatComposer, { type ChatComposerHandle } from './index'
import '../../../i18n'
import i18n from '../../../i18n'

describe('ChatComposer', () => {
  it('sends the trimmed message and clears the input', async () => {
    const onSend = vi.fn()
    render(<ChatComposer onSend={onSend} />)

    const input = screen.getByPlaceholderText(i18n.t('chat.placeholder'))
    await userEvent.type(input, '  tengo arroz  ')
    await userEvent.click(screen.getByLabelText(i18n.t('chat.send')))

    expect(onSend).toHaveBeenCalledWith('tengo arroz')
    expect(input).toHaveValue('')
  })

  it('sends on Enter and inserts a newline on Shift+Enter', async () => {
    const onSend = vi.fn()
    render(<ChatComposer onSend={onSend} />)

    const input = screen.getByPlaceholderText(i18n.t('chat.placeholder'))
    await userEvent.type(input, 'hola{enter}')

    expect(onSend).toHaveBeenCalledWith('hola')
  })

  it('disables the send button when the input is empty/whitespace-only', async () => {
    render(<ChatComposer onSend={vi.fn()} />)
    expect(screen.getByLabelText(i18n.t('chat.send'))).toBeDisabled()

    const input = screen.getByPlaceholderText(i18n.t('chat.placeholder'))
    await userEvent.type(input, '   ')
    expect(screen.getByLabelText(i18n.t('chat.send'))).toBeDisabled()
  })

  it('disables input and send button while disabled', () => {
    render(<ChatComposer onSend={vi.fn()} disabled />)
    expect(screen.getByPlaceholderText(i18n.t('chat.placeholder'))).toBeDisabled()
    expect(screen.getByLabelText(i18n.t('chat.send'))).toBeDisabled()
  })

  it('appendPhrase inserts a quick-reply phrase without overwriting existing text', async () => {
    const ref = createRef<ChatComposerHandle>()
    render(<ChatComposer ref={ref} onSend={vi.fn()} />)
    const input = screen.getByPlaceholderText(i18n.t('chat.placeholder'))

    await userEvent.type(input, 'quiero algo rapido')
    act(() => ref.current?.appendPhrase('Tengo unos 10 minutos.'))

    expect(input).toHaveValue('quiero algo rapido Tengo unos 10 minutos.')
  })

  it('appendIngredient merges repeated taps into one "prefix: a, b" fragment', () => {
    const ref = createRef<ChatComposerHandle>()
    render(<ChatComposer ref={ref} onSend={vi.fn()} />)
    const input = screen.getByPlaceholderText(i18n.t('chat.placeholder'))

    act(() => ref.current?.appendIngredient('Arroz', 'Tengo: '))
    act(() => ref.current?.appendIngredient('Pollo', 'Tengo: '))

    expect(input).toHaveValue('Tengo: Arroz, Pollo')
  })
})
