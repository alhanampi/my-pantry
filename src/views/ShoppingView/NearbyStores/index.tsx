import { useState, useMemo } from 'react'
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
import Slider from '@mui/material/Slider'
import IconButton from '@mui/material/IconButton'
import type { SelectChangeEvent } from '@mui/material/Select'
import {
  MdStorefront, MdLocalGroceryStore, MdLocationOn,
  MdShoppingCart, MdStore, MdWarehouse, MdEco,
  MdOutdoorGrill, MdSetMeal, MdBakeryDining, MdLunchDining,
  MdRestaurant, MdFavorite, MdOutlineFavoriteBorder, MdNature,
} from 'react-icons/md'
import { useTranslation } from 'react-i18next'
import {
  useNearbyStores,
  MIN_DISTANCE,
  MAX_DISTANCE_CAP,
  DEFAULT_MAX_DISTANCE,
} from '../../../hooks/useNearbyStores'
import { useUnitSystem } from '../../../hooks/useUnitSystem'
import type { UnitSystem } from '../../../hooks/useUnitSystem'
import { useGeolocation } from '../../../hooks/useGeolocation'
import { useFavoriteStoreIds, useToggleFavoriteStore } from '../../../hooks/useFavoriteStores'
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
  DistanceFilterBox,
  DistanceLabel,
  DistanceValues,
} from './NearbyStores.styles'

type IconComponent = ComponentType<{ size: number; color?: string }>

// Exported for FavoriteStoresSection's own placeholder-icon-by-type lookup
// (FavoriteStore has no logo, same reasoning as WeeklyCalendar's
// MEAL_TYPE_ICON fallback for a mealprep entry with no resolved photo).
export const SHOP_ICONS: Record<string, IconComponent> = {
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

export function getShopIcon(type: string) {
  const Icon = SHOP_ICONS[type] ?? MdStorefront
  const color = type in SHOP_ICONS ? 'var(--scheme-primary)' : 'var(--scheme-text-secondary)'
  return <Icon size={20} color={color} />
}

const METERS_PER_MILE = 1609.34

// The account's metric/imperial preference (Header's Preferencias section —
// there is deliberately no separate km/mi toggle on this filter itself)
// only changes how distances are *displayed* here; the slider's own values,
// the Geoapify radius, and the Haversine distances all stay in meters.
function formatDistance(meters: number, unitSystem: UnitSystem): string {
  if (unitSystem === 'imperial') {
    const miles = meters / METERS_PER_MILE
    return `${miles < 10 ? miles.toFixed(1) : Math.round(miles)}mi`
  }
  if (meters >= 1000) {
    const km = meters / 1000
    return `${Number.isInteger(km) ? km : km.toFixed(1)}km`
  }
  return `${meters}m`
}

export default function NearbyStores() {
  const { t } = useTranslation()
  const { unitSystem } = useUnitSystem()
  const { coords, error: geoError, requestLocation } = useGeolocation()
  const [shopTypes, setShopTypes] = useState<ShopType[]>(DEFAULT_SHOP_TYPES)
  // `distanceRange` is what actually drives the query (committed on release,
  // see handleDistanceCommit); `draftRange` tracks the thumbs while dragging
  // so the slider and its labels stay responsive without firing a new
  // Geoapify request (queryKey includes the max) on every pixel of drag.
  const [distanceRange, setDistanceRange] = useState<[number, number]>([MIN_DISTANCE, DEFAULT_MAX_DISTANCE])
  const [draftRange, setDraftRange] = useState<[number, number]>(distanceRange)
  const [selectedStore, setSelectedStore] = useState<NearbyStore | null>(null)

  const { data: stores, isLoading, isError } = useNearbyStores(
    coords,
    shopTypes,
    distanceRange[0],
    distanceRange[1],
  )
  const favoriteStoreIds = useFavoriteStoreIds()
  const toggleFavoriteStore = useToggleFavoriteStore()
  const favoriteIdSet = useMemo(() => new Set(favoriteStoreIds.data ?? []), [favoriteStoreIds.data])

  const handleSearch = (): void => {
    requestLocation()
  }

  const handleTypeChange = (e: SelectChangeEvent<ShopType[]>): void => {
    const val = e.target.value
    setShopTypes(typeof val === 'string' ? [val as ShopType] : val)
  }

  const handleDistanceDrag = (_: Event, value: number | number[]): void => {
    setDraftRange(value as [number, number])
  }

  const handleDistanceCommit = (_: Event | React.SyntheticEvent, value: number | number[]): void => {
    setDistanceRange(value as [number, number])
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

      <DistanceFilterBox>
        <DistanceLabel>{t('stores.distanceFilter')}</DistanceLabel>
        <Slider
          value={draftRange}
          onChange={handleDistanceDrag}
          onChangeCommitted={handleDistanceCommit}
          min={MIN_DISTANCE}
          max={MAX_DISTANCE_CAP}
          step={500}
          valueLabelDisplay="auto"
          valueLabelFormat={(value) => formatDistance(value, unitSystem)}
          getAriaLabel={(index) =>
            index === 0 ? t('stores.distanceFilterMin') : t('stores.distanceFilterMax')
          }
          size="small"
        />
        <DistanceValues>
          <span>{formatDistance(draftRange[0], unitSystem)}</span>
          <span>{formatDistance(draftRange[1], unitSystem)}</span>
        </DistanceValues>
      </DistanceFilterBox>

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
            {stores.map((store) => {
              const isFavorite = favoriteIdSet.has(store.id)
              return (
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
                        {t('stores.distanceAway', { value: formatDistance(store.distance, unitSystem) })}
                      </Typography>
                    }
                  />
                  <IconButton
                    size="small"
                    aria-label={isFavorite ? t('stores.removeFavorite') : t('stores.addFavorite')}
                    onClick={(e) => {
                      e.stopPropagation()
                      toggleFavoriteStore.mutate({ store, isFavorite })
                    }}
                  >
                    {isFavorite ? (
                      <MdFavorite size={18} color="var(--scheme-primary)" />
                    ) : (
                      <MdOutlineFavoriteBorder size={18} />
                    )}
                  </IconButton>
                </StoreListItem>
              )
            })}
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
