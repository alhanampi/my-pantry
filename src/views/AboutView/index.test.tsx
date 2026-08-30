import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import AboutView from './index'
import '../../i18n'
import i18n from '../../i18n'

describe('AboutView', () => {
  it('renders the app name and the feature list', () => {
    render(<AboutView />)
    expect(screen.getByText(i18n.t('appName'))).toBeInTheDocument()
    expect(screen.getByText(i18n.t('about.features.quantity'))).toBeInTheDocument()
    expect(screen.getByText(i18n.t('about.features.sharing'))).toBeInTheDocument()
  })
})
