import { useState } from 'react'
import Typography from '@mui/material/Typography'
import IconButton from '@mui/material/IconButton'
import { MdFavorite } from 'react-icons/md'
import { useTranslation } from 'react-i18next'
import { getShopIcon } from '../ShoppingView/NearbyStores'
import StoreMapDialog from '../ShoppingView/StoreMapDialog'
import { useGeolocation } from '../../hooks/useGeolocation'
import { useFavoriteStores, useToggleFavoriteStore } from '../../hooks/useFavoriteStores'
import { EmptyHint, StoreRow, StoreIconWrap, StoreTextWrap, StoreName } from './FavoriteStoresSection.styles'
import type { NearbyStore } from '../../utils/types'

// No logo exists for a favorited store (same limitation as the live search
// in NearbyStores) — falls back to the same type-keyed icon lookup
// (getShopIcon) rather than a generic placeholder, so a favorited
// supermarket still reads as a supermarket at a glance.
export default function FavoriteStoresSection() {
  const { t } = useTranslation()
  const { data: stores = [] } = useFavoriteStores()
  const toggle = useToggleFavoriteStore()
  const { coords } = useGeolocation()
  const [selectedStore, setSelectedStore] = useState<NearbyStore | null>(null)

  if (stores.length === 0) {
    return <EmptyHint>{t('favorites.storesEmpty')}</EmptyHint>
  }

  return (
    <div>
      {stores.map((store) => (
        <StoreRow
          key={store.placeId}
          role="button"
          tabIndex={0}
          aria-label={store.name}
          onClick={() => setSelectedStore({ ...store, id: store.placeId, distance: 0 })}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') setSelectedStore({ ...store, id: store.placeId, distance: 0 })
          }}
        >
          <StoreIconWrap>{getShopIcon(store.type)}</StoreIconWrap>
          <StoreTextWrap>
            <StoreName>{store.name}</StoreName>
          </StoreTextWrap>
          <IconButton
            size="small"
            aria-label={t('stores.removeFavorite')}
            onClick={(e) => {
              e.stopPropagation()
              toggle.mutate({ store: { id: store.placeId, name: store.name, type: store.type, lat: store.lat, lon: store.lon }, isFavorite: true })
            }}
          >
            <MdFavorite size={18} color="var(--scheme-primary)" />
          </IconButton>
        </StoreRow>
      ))}

      <StoreMapDialog store={selectedStore} userCoords={coords} onClose={() => setSelectedStore(null)} />
    </div>
  )
}
