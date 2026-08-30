import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import NearbyStores from './index'
import { useNearbyStores } from '../../../hooks/useNearbyStores'
import '../../../i18n'
import i18n from '../../../i18n'
import type { NearbyStore } from '../../../utils/types'

vi.mock('../../../hooks/useNearbyStores')
vi.mock('../StoreMapDialog', () => ({
  default: ({ store, onClose }: { store: NearbyStore | null; onClose: () => void }) =>
    store ? <div data-testid="map-dialog"><button onClick={onClose}>close</button>{store.name}</div> : null,
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

  it('lists stores and opens the map dialog when one is selected', async () => {
    const store: NearbyStore = { id: '1', name: 'Coto', type: 'supermarket', lat: 0, lon: 0, distance: 120 }
    mockResult({ data: [store] })
    render(<NearbyStores />)

    expect(screen.getByText('Coto')).toBeInTheDocument()
    await userEvent.click(screen.getByText('Coto'))
    expect(screen.getByTestId('map-dialog')).toBeInTheDocument()
  })
})
