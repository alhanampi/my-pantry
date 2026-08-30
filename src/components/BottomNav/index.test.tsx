import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import BottomNav from './index'
import '../../i18n'

describe('BottomNav', () => {
  it('renders pantry and shopping tabs', () => {
    render(<BottomNav value={0} onChange={vi.fn()} />)
    expect(screen.getAllByRole('button')).toHaveLength(2)
  })

  it('calls onChange with the new tab index when a tab is clicked', async () => {
    const onChange = vi.fn()
    render(<BottomNav value={0} onChange={onChange} />)
    await userEvent.click(screen.getAllByRole('button')[1])
    expect(onChange).toHaveBeenCalledWith(1)
  })
})
