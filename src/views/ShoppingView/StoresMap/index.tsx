import 'maplibre-gl/dist/maplibre-gl.css'
import { useRef, useEffect, useCallback } from 'react'
import Map, { Marker, NavigationControl, Popup } from 'react-map-gl/maplibre'
import type { MapRef } from 'react-map-gl/maplibre'
import maplibregl from 'maplibre-gl'
import IconButton from '@mui/material/IconButton'
import Button from '@mui/material/Button'
import Typography from '@mui/material/Typography'
import { MdOpenInNew, MdFavorite, MdOutlineFavoriteBorder } from 'react-icons/md'
import { useTranslation } from 'react-i18next'
import { StoreMarker, UserMarker } from '../StoreMapDialog/StoreMapDialog.styles'
import {
  MapWrapper,
  SelectedStoreMarker,
  PopupContent,
  PopupHeaderRow,
  PopupName,
  PopupActionsRow,
} from './StoresMap.styles'
import type { NearbyStore, Coordinates } from '../../../utils/types'

const MAP_STYLE = 'https://tiles.openfreemap.org/styles/liberty'

export interface StoresMapProps {
  stores: NearbyStore[]
  userCoords: Coordinates | null
  selectedStoreId: string | null
  onSelectStore: (storeId: string | null) => void
  isFavorite: (storeId: string) => boolean
  onToggleFavorite: (store: NearbyStore, isFavorite: boolean) => void
  formatDistance: (meters: number) => string
}

// Always rendered, never remounted while Shopping is open — unlike
// StoreMapDialog's one-shot fitBounds-on-load (fine for "one store in a
// modal that opens fresh each time"), this map's markers/selection change
// over time, so re-fitting/flying runs from effects keyed off the props
// that actually changed instead.
export default function StoresMap({
  stores,
  userCoords,
  selectedStoreId,
  onSelectStore,
  isFavorite,
  onToggleFavorite,
  formatDistance,
}: StoresMapProps) {
  const { t } = useTranslation()
  const mapRef = useRef<MapRef>(null)

  const fitToResults = useCallback(() => {
    const map = mapRef.current
    if (!map) return
    if (stores.length === 0) {
      if (userCoords) map.flyTo({ center: [userCoords.lng, userCoords.lat], zoom: 13, duration: 800 })
      return
    }
    const bounds = new maplibregl.LngLatBounds()
    stores.forEach((s) => bounds.extend([s.lon, s.lat]))
    if (userCoords) bounds.extend([userCoords.lng, userCoords.lat])
    map.fitBounds(bounds, { padding: 60, duration: 800, maxZoom: 16 })
  }, [stores, userCoords])

  // Re-fit whenever the result set or the user's own location changes
  // (handles the initial load too, via onLoad below, for the case where the
  // map mounts after coords/stores already exist).
  useEffect(() => {
    fitToResults()
  }, [fitToResults])

  // Flying to a specific selection is independent of the "fit everything"
  // effect above — selecting a store (from the list or a marker) shouldn't
  // re-run fitBounds over the whole result set.
  useEffect(() => {
    const map = mapRef.current
    const selected = stores.find((s) => s.id === selectedStoreId)
    if (!map || !selected) return
    map.flyTo({ center: [selected.lon, selected.lat], zoom: 15, duration: 600 })
  }, [selectedStoreId, stores])

  const selectedStore = stores.find((s) => s.id === selectedStoreId) ?? null

  return (
    <MapWrapper>
      <Map
        ref={mapRef}
        mapStyle={MAP_STYLE}
        initialViewState={{
          longitude: userCoords?.lng ?? 0,
          latitude: userCoords?.lat ?? 0,
          zoom: userCoords ? 13 : 1,
        }}
        onLoad={fitToResults}
      >
        <NavigationControl position="top-right" />

        {userCoords && (
          <Marker longitude={userCoords.lng} latitude={userCoords.lat}>
            <UserMarker />
          </Marker>
        )}

        {stores.map((store) => (
          <Marker
            key={store.id}
            longitude={store.lon}
            latitude={store.lat}
            onClick={(e) => {
              e.originalEvent.stopPropagation()
              onSelectStore(store.id)
            }}
          >
            {store.id === selectedStoreId ? <SelectedStoreMarker /> : <StoreMarker />}
          </Marker>
        ))}

        {selectedStore && (
          <Popup
            longitude={selectedStore.lon}
            latitude={selectedStore.lat}
            closeButton
            closeOnClick={false}
            onClose={() => onSelectStore(null)}
            offset={16}
            anchor="bottom"
          >
            <PopupContent>
              <PopupHeaderRow>
                <PopupName>{selectedStore.name}</PopupName>
                <IconButton
                  size="small"
                  aria-label={isFavorite(selectedStore.id) ? t('stores.removeFavorite') : t('stores.addFavorite')}
                  onClick={() => onToggleFavorite(selectedStore, isFavorite(selectedStore.id))}
                >
                  {isFavorite(selectedStore.id) ? (
                    <MdFavorite size={16} color="var(--scheme-primary)" />
                  ) : (
                    <MdOutlineFavoriteBorder size={16} />
                  )}
                </IconButton>
              </PopupHeaderRow>
              <Typography variant="caption" color="text.secondary">
                {t('stores.distanceAway', { value: formatDistance(selectedStore.distance) })}
              </Typography>
              <PopupActionsRow>
                <Button
                  variant="outlined"
                  size="small"
                  startIcon={<MdOpenInNew size={14} />}
                  href={`https://www.google.com/maps/dir/?api=1&destination=${selectedStore.lat},${selectedStore.lon}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  component="a"
                >
                  {t('stores.openMaps')}
                </Button>
              </PopupActionsRow>
            </PopupContent>
          </Popup>
        )}
      </Map>
    </MapWrapper>
  )
}
