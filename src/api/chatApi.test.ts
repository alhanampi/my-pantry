import { describe, it, expect, vi, beforeEach } from 'vitest'
import { streamChatMessage, apiSuggestIngredients } from './chatApi'

function sseResponse(frames: string[], status = 200): Response {
  const body = new ReadableStream<Uint8Array>({
    start(controller) {
      const encoder = new TextEncoder()
      for (const frame of frames) controller.enqueue(encoder.encode(frame))
      controller.close()
    },
  })
  return new Response(body, { status })
}

describe('streamChatMessage', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn())
  })

  it('calls onToken for each token frame and onDone for the terminal done frame', async () => {
    vi.mocked(fetch).mockResolvedValue(
      sseResponse([
        `data: ${JSON.stringify({ type: 'token', value: 'Hola' })}\n\n`,
        `data: ${JSON.stringify({ type: 'token', value: ' mundo' })}\n\n`,
        `data: ${JSON.stringify({ type: 'done', messageId: 'm1', title: 'Nuevo chat' })}\n\n`,
      ]),
    )

    const onToken = vi.fn()
    const onDone = vi.fn()
    const onError = vi.fn()
    await streamChatMessage('token', 'c1', { content: 'hola', language: 'es' }, { onToken, onDone, onError })

    expect(onToken).toHaveBeenNthCalledWith(1, 'Hola')
    expect(onToken).toHaveBeenNthCalledWith(2, ' mundo')
    expect(onDone).toHaveBeenCalledWith({ messageId: 'm1', title: 'Nuevo chat' })
    expect(onError).not.toHaveBeenCalled()
  })

  it('calls onError with the server-sent message for an error frame', async () => {
    vi.mocked(fetch).mockResolvedValue(
      sseResponse([`data: ${JSON.stringify({ type: 'error', message: 'quotaExceeded' })}\n\n`]),
    )

    const onDone = vi.fn()
    const onError = vi.fn()
    await streamChatMessage('token', 'c1', { content: 'hola', language: 'es' }, { onToken: vi.fn(), onDone, onError })

    expect(onError).toHaveBeenCalledWith('quotaExceeded')
    expect(onDone).not.toHaveBeenCalled()
  })

  // A dropped connection, proxy timeout, or server crash after headers were
  // sent can end the stream with no 'done' or 'error' frame ever delivered —
  // without a fallback, neither callback fires, isStreaming stays true
  // forever on the caller's side, and the empty assistant placeholder bubble
  // never resolves (see useChatSession, which relies on one of these two
  // callbacks always firing exactly once).
  it('calls onError as a fallback when the stream ends with no terminal frame at all', async () => {
    vi.mocked(fetch).mockResolvedValue(
      sseResponse([`data: ${JSON.stringify({ type: 'token', value: 'Hola' })}\n\n`]),
    )

    const onDone = vi.fn()
    const onError = vi.fn()
    await streamChatMessage('token', 'c1', { content: 'hola', language: 'es' }, { onToken: vi.fn(), onDone, onError })

    expect(onDone).not.toHaveBeenCalled()
    expect(onError).toHaveBeenCalledWith('generic')
  })

  it('calls onError straight away when the HTTP response itself is not ok', async () => {
    vi.mocked(fetch).mockResolvedValue(new Response(JSON.stringify({ error: 'configError' }), { status: 500 }))

    const onDone = vi.fn()
    const onError = vi.fn()
    await streamChatMessage('token', 'c1', { content: 'hola', language: 'es' }, { onToken: vi.fn(), onDone, onError })

    expect(onError).toHaveBeenCalledWith('configError')
    expect(onDone).not.toHaveBeenCalled()
  })
})

describe('apiSuggestIngredients', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn())
  })

  it('returns the ingredients from the response', async () => {
    vi.mocked(fetch).mockResolvedValue(
      new Response(JSON.stringify({ ingredients: ['jengibre', 'ajo'] }), { status: 200 }),
    )

    const result = await apiSuggestIngredients('token', 'c1', 'es')

    expect(result).toEqual(['jengibre', 'ajo'])
    const [url] = vi.mocked(fetch).mock.calls[0]
    expect(url).toContain('/conversations/c1/suggest-ingredients?lang=es')
  })

  it('throws on a non-ok response, the same as the other api* helpers', async () => {
    vi.mocked(fetch).mockResolvedValue(
      new Response(JSON.stringify({ error: 'configError' }), { status: 500 }),
    )

    await expect(apiSuggestIngredients('token', 'c1', 'en')).rejects.toThrow('configError')
  })
})
