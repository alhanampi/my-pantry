import { describe, it, expect, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import ThemePicker from './index'
import { ThemeContextProvider } from '../../contexts/ThemeContext'
import '../../i18n'

describe('ThemePicker', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  it('opens the scheme popover and selects a scheme, persisting it to localStorage', async () => {
    render(
      <ThemeContextProvider>
        <ThemePicker />
      </ThemeContextProvider>
    )

    await userEvent.click(screen.getByRole('button'))
    const pinkOption = await screen.findByText('Pink')
    await userEvent.click(pinkOption)

    expect(localStorage.getItem('mi-despensa-color-scheme')).toBe('pink')
  })
})
