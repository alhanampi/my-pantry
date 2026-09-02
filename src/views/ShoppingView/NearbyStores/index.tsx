import { useState } from 'react'
import type { ComponentType } from 'react'
import Box from '@mui/material/Box'
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
import {
  MdStorefront, MdLocalGroceryStore, MdLocationOn,
  MdShoppingCart, MdStore, MdWarehouse, MdEco,
  MdOutdoorGrill, MdSetMeal, MdBakeryDining, MdLunchDining,
  MdRestaurant, MdFavorite, MdNature,
} from 'react-icons/md'
import { useTranslation } from 'react-i18next'
import { useNearbyStores, DEFAULT_MAX_DISTANCE } from '../../../hooks/useNearbyStores'
import { useGeolocation } from '../../../hooks/useGeolocation'
import { ALL_SHOP_TYPES, DEFAULT_SHOP_TYPES } from '../../../api/overpass'
import StoreMapDialog from '../StoreMapDialog'
import type { ShopType, NearbyStore } from '../../../utils/types'
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

type IconComponent = ComponentType<{ size: number; color?: string }>

const SHOP_ICONS: Record<string, IconComponent> = {
  supermarket:        MdLocalGroceryStore,
  grocery:            MdShoppingCart,
  marketplace:        MdStorefront,
  wholesale:          MdWarehouse,
  convenience:        MdStore,
  greengrocer:        MdEco,
  fruit_and_vegetable: MdEco,
  butcher:            MdOutdoorGrill,
  seafood:            MdSetMeal,
  bakery:             MdBakeryDining,
  deli:               MdLunchDining,
  cheese:             MdRestaurant,
  cheese_and_dairy:   MdRestaurant,
  health_food:        MdFavorite,
  organic:            MdNature,
}

function ShopTypeIcon({ type, size = 18 }: { type: string; size?: number }) {
  const Icon = SHOP_ICONS[type] ?? MdStorefront
  return <Icon size={size} />
}

function getShopIcon(type: string) {
  const Icon = SHOP_ICONS[type] ?? MdStorefront
  const color = type in SHOP_ICONS ? 'var(--scheme-primary)' : 'var(--scheme-text-secondary)'
  return <Icon size={20} color={color} />
}

// Filter presets, capped at DEFAULT_MAX_DISTANCE — that's also the fixed
// radius fetchNearbyStores already requests from Geoapify, so "any" is a
// real "no filter" option rather than a promise of results further out.
const DISTANCE_OPTIONS: { value: number; labelKey: string }[] = [
  { value: 500, labelKey: '500' },
  { value: 1000, labelKey: '1000' },
  { value: 2000, labelKey: '2000' },
  { value: DEFAULT_MAX_DISTANCE, labelKey: 'any' },
]

export default function NearbyStores() {
  const { t } = useTranslation()
  const { coords, error: geoError, requestLocation } = useGeolocation()
  const [shopTypes, setShopTypes] = useState<ShopType[]>(DEFAULT_SHOP_TYPES)
  const [maxDistance, setMaxDistance] = useState<number>(DEFAULT_MAX_DISTANCE)
  const [selectedStore, setSelectedStore] = useState<NearbyStore | null>(null)

  const { data: stores, isLoading, isError } = useNearbyStores(coords, shopTypes, maxDistance)

  const handleSearch = (): void => {
    requestLocation()
  }

  const handleTypeChange = (e: SelectChangeEvent<ShopType[]>): void => {
    const val = e.target.value
    setShopTypes(typeof val === 'string' ? [val as ShopType] : val)
  }

  const handleDistanceChange = (e: SelectChangeEvent<number>): void => {
    setMaxDistance(Number(e.target.value))
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
                <Chip
                  key={v}
                  label={
                    <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                      <ShopTypeIcon type={v} size={12} />
                      {t(`stores.shopTypes.${v}`)}
                    </span>
                  }
                  size="small"
                />
              ))}
            </ChipsRow>
          )}
        >
          {ALL_SHOP_TYPES.map((type) => (
            <MenuItem key={type} value={type}>
              <Checkbox checked={shopTypes.includes(type)} size="small" sx={{ py: 0 }} />
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <ShopTypeIcon type={type} size={18} />
                <span>{t(`stores.shopTypes.${type}`)}</span>
              </Box>
            </MenuItem>
          ))}
        </Select>
      </TypeFormControl>

      <TypeFormControl size="small">
        <InputLabel>{t('stores.maxDistance')}</InputLabel>
        <Select<number> value={maxDistance} onChange={handleDistanceChange} label={t('stores.maxDistance')}>
          {DISTANCE_OPTIONS.map(({ value, labelKey }) => (
            <MenuItem key={value} value={value}>
              {t(`stores.distanceOptions.${labelKey}`)}
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
