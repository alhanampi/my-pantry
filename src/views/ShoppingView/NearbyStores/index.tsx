import { useState } from 'react'
import List from '@mui/material/List'
import ListItemText from '@mui/material/ListItemText'
import Typography from '@mui/material/Typography'
import CircularProgress from '@mui/material/CircularProgress'
import InputLabel from '@mui/material/InputLabel'
import Select from '@mui/material/Select'
import MenuItem from '@mui/material/MenuItem'
import Checkbox from '@mui/material/Checkbox'
import Chip from '@mui/material/Chip'
import type { SelectChangeEvent } from '@mui/material/Select'
import { MdStorefront, MdLocalGroceryStore, MdLocationOn } from 'react-icons/md'
import { useTranslation } from 'react-i18next'
import { useNearbyStores } from '../../../hooks/useNearbyStores'
import { ALL_SHOP_TYPES, DEFAULT_SHOP_TYPES } from '../../../api/overpass'
import StoreMapDialog from '../StoreMapDialog'
import type { ShopType, Coordinates, NearbyStore } from '../../../utils/types'
import {
  StoresPaper,
  StoresTitle,
  StoresSubtitle,
  SearchButton,
  StoreAlert,
  StoreDivider,
  StoreListItem,
  StoreIconCell,
  StoreName,
  TypeFormControl,
  ChipsRow,
} from './NearbyStores.styles'

function getShopIcon(type: string) {
  if (type === 'supermarket' || type === 'grocery') {
    return <MdLocalGroceryStore size={20} color="var(--scheme-primary)" />
  }
  return <MdStorefront size={20} color="var(--scheme-text-secondary)" />
}

export default function NearbyStores() {
  const { t } = useTranslation()
  const [coords, setCoords] = useState<Coordinates | null>(null)
  const [geoError, setGeoError] = useState<string | null>(null)
  const [shopTypes, setShopTypes] = useState<ShopType[]>(DEFAULT_SHOP_TYPES)
  const [selectedStore, setSelectedStore] = useState<NearbyStore | null>(null)

  const { data: stores, isLoading, isError } = useNearbyStores(coords, shopTypes)

  const handleSearch = (): void => {
    setGeoError(null)
    if (!navigator.geolocation) {
      setGeoError(t('stores.notSupported'))
      return
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => setCoords({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
      (err) => {
        setGeoError(err.code === 1 ? t('stores.locationDenied') : t('stores.locationError'))
      }
    )
  }

  const handleTypeChange = (e: SelectChangeEvent<ShopType[]>): void => {
    const val = e.target.value
    setShopTypes(typeof val === 'string' ? [val as ShopType] : val)
  }

  return (
    <StoresPaper elevation={0}>
      <StoresTitle>{t('stores.title')}</StoresTitle>
      <StoresSubtitle color="text.secondary">{t('stores.subtitle')}</StoresSubtitle>

      <TypeFormControl size="small">
        <InputLabel>{t('stores.storeType')}</InputLabel>
        <Select<ShopType[]>
          multiple
          value={shopTypes}
          onChange={handleTypeChange}
          label={t('stores.storeType')}
          renderValue={(selected) => (
            <ChipsRow>
              {selected.map((v) => (
                <Chip key={v} label={t(`stores.shopTypes.${v}`)} size="small" />
              ))}
            </ChipsRow>
          )}
        >
          {ALL_SHOP_TYPES.map((type) => (
            <MenuItem key={type} value={type}>
              <Checkbox checked={shopTypes.includes(type)} size="small" sx={{ py: 0 }} />
              <ListItemText primary={t(`stores.shopTypes.${type}`)} />
            </MenuItem>
          ))}
        </Select>
      </TypeFormControl>

      <SearchButton
        variant="outlined"
        color="primary"
        startIcon={
          isLoading ? <CircularProgress size={16} color="inherit" /> : <MdLocationOn size={16} />
        }
        onClick={handleSearch}
        disabled={isLoading || shopTypes.length === 0}
        size="small"
      >
        {isLoading ? t('stores.searching') : t('stores.search')}
      </SearchButton>

      {geoError && <StoreAlert severity="warning">{geoError}</StoreAlert>}
      {isError && <StoreAlert severity="error">{t('stores.error')}</StoreAlert>}
      {stores && stores.length === 0 && (
        <Typography variant="body2" color="text.secondary">
          {t('stores.noResults')}
        </Typography>
      )}

      {stores && stores.length > 0 && (
        <>
          <StoreDivider />
          <List dense disablePadding>
            {stores.map((store) => (
              <StoreListItem
                key={store.id}
                disableGutters
                onClick={() => setSelectedStore(store)}
              >
                <StoreIconCell>{getShopIcon(store.type)}</StoreIconCell>
                <ListItemText
                  primary={<StoreName>{store.name}</StoreName>}
                  secondary={
                    <Typography variant="caption" color="text.secondary">
                      {t('stores.distance', { meters: store.distance })}
                    </Typography>
                  }
                />
              </StoreListItem>
            ))}
          </List>
        </>
      )}

      <StoreMapDialog
        store={selectedStore}
        userCoords={coords}
        onClose={() => setSelectedStore(null)}
      />
    </StoresPaper>
  )
}
