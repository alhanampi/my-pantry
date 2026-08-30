import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useDebounce } from './useDebounce'

describe('useDebounce', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('keeps the initial value until the delay elapses', () => {
    const { result } = renderHook(({ value, delay }) => useDebounce(value, delay), {
      initialProps: { value: 'a', delay: 500 },
    })

    expect(result.current).toBe('a')

    act(() => {
      vi.advanceTimersByTime(499)
    })
    expect(result.current).toBe('a')
  })

  it('updates to the latest value once the delay elapses', () => {
    const { result, rerender } = renderHook(({ value, delay }) => useDebounce(value, delay), {
      initialProps: { value: 'a', delay: 500 },
    })

    rerender({ value: 'b', delay: 500 })
    act(() => {
      vi.advanceTimersByTime(500)
    })

    expect(result.current).toBe('b')
  })

  it('resets the timer when the value changes again before the delay elapses', () => {
    const { result, rerender } = renderHook(({ value, delay }) => useDebounce(value, delay), {
      initialProps: { value: 'a', delay: 500 },
    })

    rerender({ value: 'b', delay: 500 })
    act(() => {
      vi.advanceTimersByTime(300)
    })
    rerender({ value: 'c', delay: 500 })
    act(() => {
      vi.advanceTimersByTime(300)
    })
    expect(result.current).toBe('a') // neither update has had a full 500ms uninterrupted

    act(() => {
      vi.advanceTimersByTime(200)
    })
    expect(result.current).toBe('c')
  })
})
