import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import StoresMap from './index'
import '../../../i18n'
import i18n from '../../../i18n'
import type { NearbyStore } from '../../../utils/types'

vi.mock('maplibre-gl', () => ({
  default: { LngLatBounds: vi.fn().mockImplementation(() => ({ extend: vi.fn() })) },
}))
vi.mock('react-map-gl/maplibre', () => ({
  default: ({ children }: { children?: React.ReactNode }) => <div data-testid="map">{children}</div>,
  Marker: ({ children, onClick }: { children?: React.ReactNode; onClick?: (e: unknown) => void }) => (
    <div data-testid="marker" onClick={(e) => onClick?.({ originalEvent: e })}>
      {children}
    </div>
  ),
  NavigationControl: () => <div data-testid="nav-control" />,
  Popup: ({ children }: { children?: React.ReactNode }) => <div data-testid="popup">{children}</div>,
}))

const stores: NearbyStore[] = [
  { id: '1', name: 'Coto', type: 'supermarket', lat: -34.6, lon: -58.4, distance: 120 },
  { id: '2', name: 'Carrefour', type: 'supermarket', lat: -34.61, lon: -58.41, distance: 300 },
]

function baseProps(overrides: Partial<Parameters<typeof StoresMap>[0]> = {}) {
  return {
    stores,
    userCoords: { lat: -34.6, lng: -58.4 },
    selectedStoreId: null,
    onSelectStore: vi.fn(),
    isFavorite: () => false,
    onToggleFavorite: vi.fn(),
    formatDistance: (m: number) => `${m}m`,
    ...overrides,
  }
}

describe('StoresMap', () => {
  it('renders the map even with no stores and no user location', () => {
    render(<StoresMap {...baseProps({ stores: [], userCoords: null })} />)
    expect(screen.getByTestId('map')).toBeInTheDocument()
  })

  it('renders one marker per store, plus one for the user location', () => {
    render(<StoresMap {...baseProps()} />)
    expect(screen.getAllByTestId('marker')).toHaveLength(3)
  })

  it('renders only the stores\' markers when the user location is unknown', () => {
    render(<StoresMap {...baseProps({ userCoords: null })} />)
    expect(screen.getAllByTestId('marker')).toHaveLength(2)
  })

  it('calls onSelectStore when a store marker is clicked', async () => {
    const onSelectStore = vi.fn()
    render(<StoresMap {...baseProps({ onSelectStore, userCoords: null })} />)

    await userEvent.click(screen.getAllByTestId('marker')[0])

    expect(onSelectStore).toHaveBeenCalledWith('1')
  })

  it('shows a popup with the selected store\'s name, distance, and Google Maps link', () => {
    render(<StoresMap {...baseProps({ selectedStoreId: '1' })} />)

    expect(screen.getByTestId('popup')).toBeInTheDocument()
    expect(screen.getByText('Coto')).toBeInTheDocument()
    expect(screen.getByText(i18n.t('stores.distanceAway', { value: '120m' }))).toBeInTheDocument()
    const link = screen.getByText(i18n.t('stores.openMaps')).closest('a')
    expect(link).toHaveAttribute('href', expect.stringContaining('destination=-34.6,-58.4'))
  })

  it('toggles favorite from the popup heart', async () => {
    const onToggleFavorite = vi.fn()
    render(<StoresMap {...baseProps({ selectedStoreId: '1', onToggleFavorite, isFavorite: () => false })} />)

    await userEvent.click(screen.getByLabelText(i18n.t('stores.addFavorite')))

    expect(onToggleFavorite).toHaveBeenCalledWith(stores[0], false)
  })

  it('does not show a popup when nothing is selected', () => {
    render(<StoresMap {...baseProps({ selectedStoreId: null })} />)
    expect(screen.queryByTestId('popup')).not.toBeInTheDocument()
  })
})
