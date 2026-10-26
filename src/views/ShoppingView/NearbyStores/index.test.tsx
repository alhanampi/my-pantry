import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import NearbyStores from './index'
import { useNearbyStores } from '../../../hooks/useNearbyStores'
import type { UnitSystem } from '../../../hooks/useUnitSystem'
import '../../../i18n'
import i18n from '../../../i18n'
import type { NearbyStore } from '../../../utils/types'

vi.mock('../../../hooks/useNearbyStores')
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

const mockUseUnitSystem = vi.fn(
  (): { unitSystem: UnitSystem; setUnitSystem: () => void; isPending: boolean } => ({
    unitSystem: 'metric',
    setUnitSystem: vi.fn(),
    isPending: false,
  }),
)
vi.mock('../../../hooks/useUnitSystem', () => ({
  useUnitSystem: () => mockUseUnitSystem(),
}))
const mockFavoriteStoreIds = vi.fn((): { data: string[] } => ({ data: [] }))
const mockToggleFavoriteStoreMutate = vi.fn()
vi.mock('../../../hooks/useFavoriteStores', () => ({
  useFavoriteStoreIds: () => mockFavoriteStoreIds(),
  useToggleFavoriteStore: () => ({ mutate: mockToggleFavoriteStoreMutate, isPending: false }),
}))

function mockResult(overrides: Partial<ReturnType<typeof useNearbyStores>> = {}) {
  vi.mocked(useNearbyStores).mockReturnValue({
    data: undefined,
    isLoading: false,
    isError: false,
    ...overrides,
  } as ReturnType<typeof useNearbyStores>)
}

describe('NearbyStores', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('requests geolocation and shows an error when unsupported', async () => {
    mockResult()
    const originalGeolocation = navigator.geolocation
    // @ts-expect-error simulate missing geolocation
    delete navigator.geolocation

    render(<NearbyStores />)
    await userEvent.click(screen.getByText(i18n.t('stores.search')))

    expect(screen.getByText(i18n.t('stores.notSupported'))).toBeInTheDocument()

    Object.defineProperty(navigator, 'geolocation', { value: originalGeolocation, configurable: true })
  })

  it('shows the loading state while searching', () => {
    mockResult({ isLoading: true })
    render(<NearbyStores />)
    expect(screen.getByText(i18n.t('stores.searching'))).toBeInTheDocument()
  })

  it('shows an error message when the query fails', () => {
    mockResult({ isError: true })
    render(<NearbyStores />)
    expect(screen.getByText(i18n.t('stores.error'))).toBeInTheDocument()
  })

  it('shows a no-results message for an empty list', () => {
    mockResult({ data: [] })
    render(<NearbyStores />)
    expect(screen.getByText(i18n.t('stores.noResults'))).toBeInTheDocument()
  })

  it('lists stores (with metric distance) and opens the map popup when one is selected', async () => {
    const store: NearbyStore = { id: '1', name: 'Coto', type: 'supermarket', lat: 0, lon: 0, distance: 120 }
    mockResult({ data: [store] })
    render(<NearbyStores />)

    expect(screen.getByText('Coto')).toBeInTheDocument()
    expect(screen.getByText(i18n.t('stores.distanceAway', { value: '120m' }))).toBeInTheDocument()
    await userEvent.click(screen.getByText('Coto'))
    expect(screen.getByText(i18n.t('stores.openMaps'))).toBeInTheDocument()
  })

  it('favorites a store from its own heart icon, without opening the map dialog', async () => {
    const store: NearbyStore = { id: '1', name: 'Coto', type: 'supermarket', lat: 0, lon: 0, distance: 120 }
    mockResult({ data: [store] })
    render(<NearbyStores />)

    await userEvent.click(screen.getByLabelText(i18n.t('stores.addFavorite')))

    expect(mockToggleFavoriteStoreMutate).toHaveBeenCalledWith({ store, isFavorite: false })
    expect(screen.queryByTestId('map-dialog')).not.toBeInTheDocument()
  })

  it('shows a filled heart and the remove label for an already-favorited store', () => {
    mockFavoriteStoreIds.mockReturnValue({ data: ['1'] })
    const store: NearbyStore = { id: '1', name: 'Coto', type: 'supermarket', lat: 0, lon: 0, distance: 120 }
    mockResult({ data: [store] })
    render(<NearbyStores />)

    expect(screen.getByLabelText(i18n.t('stores.removeFavorite'))).toBeInTheDocument()
  })

  it('formats distances in miles when the account is set to imperial', () => {
    mockUseUnitSystem.mockReturnValue({ unitSystem: 'imperial', setUnitSystem: vi.fn(), isPending: false })
    const store: NearbyStore = { id: '1', name: 'Coto', type: 'supermarket', lat: 0, lon: 0, distance: 1609 }
    mockResult({ data: [store] })
    render(<NearbyStores />)

    expect(screen.getByText(i18n.t('stores.distanceAway', { value: '1.0mi' }))).toBeInTheDocument()
  })

  it('defaults the distance range to [0, 3000] and re-queries on change', async () => {
    mockResult()
    render(<NearbyStores />)

    const minThumb = screen.getByRole('slider', { name: i18n.t('stores.distanceFilterMin') })
    const maxThumb = screen.getByRole('slider', { name: i18n.t('stores.distanceFilterMax') })
    expect(minThumb).toHaveAttribute('aria-valuenow', '0')
    expect(maxThumb).toHaveAttribute('aria-valuenow', '3000')

    // jsdom doesn't implement native <input type="range"> arrow-key
    // stepping, so drive the hidden range input's change event directly
    // instead of trying to simulate a real keypress/drag.
    fireEvent.change(maxThumb, { target: { value: '3500' } })

    const lastCall = vi.mocked(useNearbyStores).mock.calls.at(-1)
    expect(lastCall?.[2]).toBe(0) // minDistance unchanged
    expect(lastCall?.[3]).toBe(3500) // maxDistance moved by one 500m step
  })

  it('the max slider still goes up to 40km', () => {
    mockResult()
    render(<NearbyStores />)

    const maxThumb = screen.getByRole('slider', { name: i18n.t('stores.distanceFilterMax') })
    expect(maxThumb).toHaveAttribute('aria-valuemax', '40000')
  })
})
