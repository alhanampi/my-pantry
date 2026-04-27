import 'maplibre-gl/dist/maplibre-gl.css'
import { useRef, useCallback } from 'react'
import Map, { Marker, NavigationControl } from 'react-map-gl/maplibre'
import type { MapRef } from 'react-map-gl/maplibre'
import maplibregl from 'maplibre-gl'
import Button from '@mui/material/Button'
import IconButton from '@mui/material/IconButton'
import { MdClose, MdOpenInNew } from 'react-icons/md'
import { useTranslation } from 'react-i18next'
import type { NearbyStore, Coordinates } from '../../../utils/types'
import {
  StyledMapDialog,
  MapDialogTitle,
  MapDialogContent,
  MapDialogActions,
  MapWrapper,
  StoreMarker,
  UserMarker,
} from './StoreMapDialog.styles'

const MAP_STYLE = 'https://tiles.openfreemap.org/styles/liberty'

interface StoreMapDialogProps {
  store: NearbyStore | null
  userCoords: Coordinates | null
  onClose: () => void
}

export default function StoreMapDialog({ store, userCoords, onClose }: StoreMapDialogProps) {
  const { t } = useTranslation()
  const mapRef = useRef<MapRef>(null)

  const handleMapLoad = useCallback(() => {
    if (!mapRef.current || !store || !userCoords) return
    const bounds: maplibregl.LngLatBoundsLike = [
      [store.lon, store.lat],
      [userCoords.lng, userCoords.lat],
    ]
    mapRef.current.fitBounds(bounds, { padding: 80, duration: 800 })
  }, [store, userCoords])

  const mapsUrl = store
    ? `https://www.google.com/maps/dir/?api=1&destination=${store.lat},${store.lon}`
    : ''

  return (
    <StyledMapDialog open={!!store} onClose={onClose} maxWidth="sm" fullWidth>
      <MapDialogTitle>
        <span>{store?.name ?? ''}</span>
        <IconButton size="small" onClick={onClose} aria-label="close">
          <MdClose size={18} />
        </IconButton>
      </MapDialogTitle>

      <MapDialogContent>
        {store && (
          <MapWrapper>
            <Map
              ref={mapRef}
              mapStyle={MAP_STYLE}
              initialViewState={{
                longitude: store.lon,
                latitude: store.lat,
                zoom: 15,
              }}
              onLoad={handleMapLoad}
            >
              <NavigationControl position="top-right" />

              <Marker longitude={store.lon} latitude={store.lat}>
                <StoreMarker />
              </Marker>

              {userCoords && (
                <Marker longitude={userCoords.lng} latitude={userCoords.lat}>
                  <UserMarker />
                </Marker>
              )}
            </Map>
          </MapWrapper>
        )}
      </MapDialogContent>

      <MapDialogActions>
        <Button
          variant="outlined"
          size="small"
          startIcon={<MdOpenInNew size={14} />}
          href={mapsUrl}
          target="_blank"
          rel="noopener noreferrer"
          component="a"
        >
          {t('stores.openMaps')}
        </Button>
      </MapDialogActions>
    </StyledMapDialog>
  )
}
