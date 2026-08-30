import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import StoreMapDialog from './index'
import '../../../i18n'
import i18n from '../../../i18n'
import type { NearbyStore } from '../../../utils/types'

vi.mock('maplibre-gl', () => ({ default: {} }))
vi.mock('react-map-gl/maplibre', () => ({
  default: ({ children }: { children?: React.ReactNode }) => <div data-testid="map">{children}</div>,
  Marker: ({ children }: { children?: React.ReactNode }) => <div data-testid="marker">{children}</div>,
  NavigationControl: () => <div data-testid="nav-control" />,
}))

const store: NearbyStore = { id: '1', name: 'Coto', type: 'supermarket', lat: -34.6, lon: -58.4, distance: 120 }

describe('StoreMapDialog', () => {
  it('renders nothing when there is no store', () => {
    render(<StoreMapDialog store={null} userCoords={null} onClose={vi.fn()} />)
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('renders the store name and the map when a store is given', () => {
    render(<StoreMapDialog store={store} userCoords={{ lat: -34.6, lng: -58.4 }} onClose={vi.fn()} />)
    expect(screen.getByRole('dialog')).toBeInTheDocument()
    expect(screen.getByText('Coto')).toBeInTheDocument()
    expect(screen.getByTestId('map')).toBeInTheDocument()
  })

  it('calls onClose when the close button is clicked', async () => {
    const onClose = vi.fn()
    render(<StoreMapDialog store={store} userCoords={null} onClose={onClose} />)
    await userEvent.click(screen.getByLabelText('close'))
    expect(onClose).toHaveBeenCalledOnce()
  })

  it('links to Google Maps directions for the store', () => {
    render(<StoreMapDialog store={store} userCoords={null} onClose={vi.fn()} />)
    const link = screen.getByText(i18n.t('stores.openMaps')).closest('a')
    expect(link).toHaveAttribute('href', expect.stringContaining('destination=-34.6,-58.4'))
  })
})
