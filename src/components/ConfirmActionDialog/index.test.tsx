import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import ConfirmActionDialog from './index'
import '../../i18n'

describe('ConfirmActionDialog', () => {
  it('renders nothing interactive when closed', () => {
    render(
      <ConfirmActionDialog
        open={false}
        title="Delete this?"
        body="This can't be undone."
        confirmLabel="Delete"
        onConfirm={vi.fn()}
        onCancel={vi.fn()}
      />,
    )
    expect(screen.queryByText('Delete this?')).not.toBeInTheDocument()
  })

  it('shows title/body and calls onConfirm/onCancel', async () => {
    const onConfirm = vi.fn()
    const onCancel = vi.fn()
    render(
      <ConfirmActionDialog
        open
        title="Delete this?"
        body="This can't be undone."
        confirmLabel="Delete"
        onConfirm={onConfirm}
        onCancel={onCancel}
      />,
    )

    expect(screen.getByText('Delete this?')).toBeInTheDocument()
    expect(screen.getByText("This can't be undone.")).toBeInTheDocument()

    await userEvent.click(screen.getByText('Delete'))
    expect(onConfirm).toHaveBeenCalled()

    await userEvent.click(screen.getByText(/cancel/i))
    expect(onCancel).toHaveBeenCalled()
  })
})
