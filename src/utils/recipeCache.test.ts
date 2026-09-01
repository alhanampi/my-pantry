import { describe, it, expect, beforeEach, vi } from 'vitest'
import { getCached, setCached, searchCacheKey, detailCacheKey } from './recipeCache'

describe('recipeCache', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  it('returns null for a key that was never cached', () => {
    expect(getCached('nope', 1000)).toBeNull()
  })

  it('round-trips a value and reports it fresh within the TTL', () => {
    setCached('k', { hello: 'world' })
    const hit = getCached<{ hello: string }>('k', 1000)
    expect(hit).toEqual({ value: { hello: 'world' }, stale: false })
  })

  it('reports a value as stale once it is older than the TTL, but still returns it', () => {
    const nowSpy = vi.spyOn(Date, 'now')
    nowSpy.mockReturnValueOnce(0) // savedAt
    setCached('k', 'value')
    nowSpy.mockReturnValue(2000) // read 2s later, TTL is 1s
    const hit = getCached<string>('k', 1000)
    nowSpy.mockRestore()
    expect(hit).toEqual({ value: 'value', stale: true })
  })

  it('treats corrupt JSON as a cache miss instead of throwing', () => {
    localStorage.setItem('bad-key', 'not-json{')
    expect(getCached('bad-key', 1000)).toBeNull()
  })

  it('treats an entry with no savedAt as a cache miss', () => {
    localStorage.setItem('weird-key', JSON.stringify({ value: 'x' }))
    expect(getCached('weird-key', 1000)).toBeNull()
  })

  it('evicts the oldest entries once past the max tracked count', () => {
    // Fill well past MAX_ENTRIES (360) worth of tiny values.
    for (let i = 0; i < 400; i++) {
      setCached(`key-${i}`, i)
    }
    // The earliest keys should have been evicted; the most recent ones survive.
    expect(getCached('key-0', 100000)).toBeNull()
    expect(getCached('key-399', 100000)?.value).toBe(399)
  })

  it('does not throw when localStorage.setItem fails (e.g. quota exceeded)', () => {
    const setItemSpy = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new DOMException('quota exceeded', 'QuotaExceededError')
    })
    expect(() => setCached('k', 'value')).not.toThrow()
    setItemSpy.mockRestore()
  })

  it('searchCacheKey ignores empty filter values and key order', () => {
    const a = searchCacheKey({ query: 'pasta', cuisine: '', diet: undefined }, 0, 'en')
    const b = searchCacheKey({ diet: undefined, cuisine: '', query: 'pasta' }, 0, 'en')
    expect(a).toBe(b)
  })

  it('searchCacheKey produces distinct keys for distinct filters/offset/lang', () => {
    const base = searchCacheKey({ query: 'pasta' }, 0, 'en')
    expect(searchCacheKey({ query: 'pizza' }, 0, 'en')).not.toBe(base)
    expect(searchCacheKey({ query: 'pasta' }, 4, 'en')).not.toBe(base)
    expect(searchCacheKey({ query: 'pasta' }, 0, 'es')).not.toBe(base)
  })

  it('detailCacheKey produces distinct keys per id/lang', () => {
    expect(detailCacheKey(1, 'en')).not.toBe(detailCacheKey(2, 'en'))
    expect(detailCacheKey(1, 'en')).not.toBe(detailCacheKey(1, 'es'))
  })
})
