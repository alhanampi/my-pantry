import { describe, it, expect, vi, beforeEach } from 'vitest'
import { streamChatMessage } from './chatApi'

function sseResponse(chunks: string[]): Response {
  const encoder = new TextEncoder()
  const stream = new ReadableStream({
    start(controller) {
      for (const chunk of chunks) controller.enqueue(encoder.encode(chunk))
      controller.close()
    },
  })
  return new Response(stream, { status: 200 })
}

describe('streamChatMessage', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn())
  })

  it('parses token frames (including one split across chunk boundaries) and the done frame', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(
      sseResponse([
        'data: {"type":"token","value":"Hola"}\n\n',
        'data: {"type":"tok',
        'en","value":" mundo"}\n\n',
        'data: {"type":"done","messageId":"m1","title":"Hi"}\n\n',
      ]),
    )

    const onToken = vi.fn()
    const onDone = vi.fn()
    const onError = vi.fn()

    await streamChatMessage(
      'token-123',
      'c1',
      { content: 'hola', language: 'es' },
      { onToken, onDone, onError },
    )

    expect(onToken).toHaveBeenNthCalledWith(1, 'Hola')
    expect(onToken).toHaveBeenNthCalledWith(2, ' mundo')
    expect(onDone).toHaveBeenCalledWith({ messageId: 'm1', title: 'Hi' })
    expect(onError).not.toHaveBeenCalled()
  })

  it('calls onError for a mid-stream error frame', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(
      sseResponse(['data: {"type":"error","message":"configError"}\n\n']),
    )
    const onError = vi.fn()

    await streamChatMessage('t', 'c1', { content: 'x', language: 'en' }, { onToken: vi.fn(), onDone: vi.fn(), onError })

    expect(onError).toHaveBeenCalledWith('configError')
  })

  it('calls onError with the JSON error body when the response is not ok', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(
      new Response(JSON.stringify({ error: 'conversationTooLong' }), { status: 400 }),
    )
    const onError = vi.fn()

    await streamChatMessage('t', 'c1', { content: 'x', language: 'en' }, { onToken: vi.fn(), onDone: vi.fn(), onError })

    expect(onError).toHaveBeenCalledWith('conversationTooLong')
  })

  it('skips a malformed frame instead of throwing', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(
      sseResponse(['data: not-json\n\n', 'data: {"type":"token","value":"ok"}\n\n']),
    )
    const onToken = vi.fn()

    await streamChatMessage('t', 'c1', { content: 'x', language: 'en' }, { onToken, onDone: vi.fn(), onError: vi.fn() })

    expect(onToken).toHaveBeenCalledWith('ok')
  })
})
