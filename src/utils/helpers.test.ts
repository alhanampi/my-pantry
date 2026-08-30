import { describe, it, expect, vi, afterEach } from 'vitest'
import { formatDate, getExpiryStatus } from './helpers'

describe('formatDate', () => {
  it('returns an em dash for an empty string', () => {
    expect(formatDate('')).toBe('—')
  })

  it('formats an ISO date as dd/mm/yyyy', () => {
    expect(formatDate('2026-08-30')).toBe('30/08/2026')
  })
})

describe('getExpiryStatus', () => {
  afterEach(() => {
    vi.useRealTimers()
  })

  it('returns "none" for an empty date', () => {
    expect(getExpiryStatus('')).toBe('none')
  })

  it('returns "expired" for a past date', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-08-30T12:00:00'))
    expect(getExpiryStatus('2026-08-29')).toBe('expired')
  })

  it('returns "soon" for a date within 7 days (boundary inclusive)', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-08-30T12:00:00'))
    expect(getExpiryStatus('2026-09-06')).toBe('soon') // exactly 7 days out
  })

  it('returns "ok" for a date more than 7 days out', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-08-30T12:00:00'))
    expect(getExpiryStatus('2026-09-07')).toBe('ok') // 8 days out
  })

  it('returns "soon" for today', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-08-30T12:00:00'))
    expect(getExpiryStatus('2026-08-30')).toBe('soon')
  })
})
