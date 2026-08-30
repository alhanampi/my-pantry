import { describe, it, expect, beforeEach } from 'vitest'
import { render, screen, renderHook } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ThemeContextProvider, useColorScheme } from './ThemeContext'

function TestConsumer() {
  const { colorScheme, setColorScheme } = useColorScheme()
  return (
    <div>
      <span>{colorScheme}</span>
      <button onClick={() => setColorScheme('pink')}>set pink</button>
    </div>
  )
}

describe('ThemeContext', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  it('defaults to the green scheme when nothing is stored', () => {
    render(
      <ThemeContextProvider>
        <TestConsumer />
      </ThemeContextProvider>
    )
    expect(screen.getByText('green')).toBeInTheDocument()
  })

  it('reads a previously stored scheme', () => {
    localStorage.setItem('mi-despensa-color-scheme', 'dark')
    render(
      <ThemeContextProvider>
        <TestConsumer />
      </ThemeContextProvider>
    )
    expect(screen.getByText('dark')).toBeInTheDocument()
  })

  it('persists a scheme change to localStorage', async () => {
    render(
      <ThemeContextProvider>
        <TestConsumer />
      </ThemeContextProvider>
    )
    await userEvent.click(screen.getByText('set pink'))
    expect(screen.getByText('pink')).toBeInTheDocument()
    expect(localStorage.getItem('mi-despensa-color-scheme')).toBe('pink')
  })

  it('throws when used outside the provider', () => {
    expect(() => renderHook(() => useColorScheme())).toThrow(
      'useColorScheme must be used within ThemeContextProvider'
    )
  })
})
