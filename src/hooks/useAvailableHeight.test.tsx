import { describe, it, expect } from 'vitest'
import { renderHook } from '@testing-library/react'
import { useRef } from 'react'
import { useAvailableHeight } from './useAvailableHeight'

function setup(top: number, viewportHeight: number, reserveBottom: number) {
  const original = window.innerHeight
  Object.defineProperty(window, 'innerHeight', { value: viewportHeight, configurable: true })

  const { result } = renderHook(() => {
    const ref = useRef<HTMLDivElement>(null)
    // Simulate a mounted node at a known position.
    if (!ref.current) {
      const div = document.createElement('div')
      div.getBoundingClientRect = () => ({ top, left: 0, right: 0, bottom: 0, width: 0, height: 0, x: 0, y: 0, toJSON: () => ({}) })
      // @ts-expect-error assigning a plain object to a ref for the test
      ref.current = div
    }
    return useAvailableHeight(ref, reserveBottom)
  })

  Object.defineProperty(window, 'innerHeight', { value: original, configurable: true })
  return result
}

describe('useAvailableHeight', () => {
  it('computes viewportHeight - top - reserveBottom', () => {
    const result = setup(100, 800, 56)
    expect(result.current).toBe(800 - 100 - 56)
  })

  it('never returns less than the 240px floor', () => {
    const result = setup(700, 800, 200)
    expect(result.current).toBe(240)
  })
})
