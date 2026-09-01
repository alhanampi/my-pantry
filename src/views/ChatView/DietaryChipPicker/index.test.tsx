import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import DietaryChipPicker from './index'
import '../../../i18n'
import i18n from '../../../i18n'

describe('DietaryChipPicker', () => {
  it('toggles a predefined chip on click', async () => {
    const onChange = vi.fn()
    render(<DietaryChipPicker selected={[]} onChange={onChange} />)

    await userEvent.click(screen.getByText(i18n.t('chat.dietary.vegan')))

    expect(onChange).toHaveBeenCalledWith(['vegan'])
  })

  it('deselects an already-selected predefined chip', async () => {
    const onChange = vi.fn()
    render(<DietaryChipPicker selected={['vegan']} onChange={onChange} />)

    await userEvent.click(screen.getByText(i18n.t('chat.dietary.vegan')))

    expect(onChange).toHaveBeenCalledWith([])
  })

  it('adds a custom free-text restriction', async () => {
    const onChange = vi.fn()
    render(<DietaryChipPicker selected={[]} onChange={onChange} />)

    const input = screen.getByPlaceholderText(i18n.t('chat.onboardingAddOtherPlaceholder'))
    await userEvent.type(input, 'sin maní{enter}')

    expect(onChange).toHaveBeenCalledWith(['sin maní'])
  })

  it('renders a custom restriction as a removable chip', () => {
    render(<DietaryChipPicker selected={['sin maní']} onChange={vi.fn()} />)
    expect(screen.getByText('sin maní')).toBeInTheDocument()
  })

  it('hides the "add other" free-text row when allowCustom is false', () => {
    render(<DietaryChipPicker selected={[]} onChange={vi.fn()} allowCustom={false} />)
    expect(screen.queryByPlaceholderText(i18n.t('chat.onboardingAddOtherPlaceholder'))).not.toBeInTheDocument()
  })
})
