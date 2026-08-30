import { describe, it, expect, beforeEach, vi } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import useLocalStorage from './useLocalStorage'

describe('useLocalStorage', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  it('falls back to the initial value when nothing is stored', () => {
    const { result } = renderHook(() => useLocalStorage('missing-key', 'default'))
    expect(result.current[0]).toBe('default')
  })

  it('reads an existing value from localStorage', () => {
    localStorage.setItem('existing-key', JSON.stringify('stored-value'))
    const { result } = renderHook(() => useLocalStorage('existing-key', 'default'))
    expect(result.current[0]).toBe('stored-value')
  })

  it('persists writes to localStorage and updates state', () => {
    const { result } = renderHook(() => useLocalStorage('key', 'default'))

    act(() => {
      result.current[1]('updated')
    })

    expect(result.current[0]).toBe('updated')
    expect(localStorage.getItem('key')).toBe(JSON.stringify('updated'))
  })

  it('supports a functional updater', () => {
    const { result } = renderHook(() => useLocalStorage('count', 1))

    act(() => {
      result.current[1]((prev) => prev + 1)
    })

    expect(result.current[0]).toBe(2)
  })

  it('falls back to the initial value when the stored value is corrupt JSON', () => {
    localStorage.setItem('bad-key', 'not-json{')
    const { result } = renderHook(() => useLocalStorage('bad-key', 'default'))
    expect(result.current[0]).toBe('default')
  })

  it('logs and does not throw when writing fails', () => {
    const { result } = renderHook(() => useLocalStorage('key', 'default'))
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    const setItemSpy = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('quota exceeded')
    })

    expect(() => {
      act(() => {
        result.current[1]('updated')
      })
    }).not.toThrow()
    expect(errorSpy).toHaveBeenCalled()

    setItemSpy.mockRestore()
    errorSpy.mockRestore()
  })
})
