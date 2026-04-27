import List from '@mui/material/List'
import Divider from '@mui/material/Divider'
import Typography from '@mui/material/Typography'
import Button from '@mui/material/Button'
import { MdShoppingCart, MdAdd, MdDeleteSweep } from 'react-icons/md'
import { useTranslation } from 'react-i18next'
import ShoppingItem from './ShoppingItem'
import NearbyStores from './NearbyStores'
import {
  Wrapper,
  EmptyState,
  TopBar,
  CountText,
  ClearButton,
  ItemsPaper,
  ItemsBox,
} from './ShoppingView.styles'
import type { ShoppingListProps } from '../../utils/types'

export default function ShoppingView({
  items,
  onAddClick,
  onToggle,
  onDelete,
  onEdit,
  onClearPurchased,
  onQuantityChange,
}: ShoppingListProps) {
  const { t } = useTranslation()
  const pendingItems = items.filter((i) => !i.purchased)
  const purchasedItems = items.filter((i) => i.purchased)

  return (
    <Wrapper>
      <TopBar>
        <Button
          variant="contained"
          startIcon={<MdAdd size={16} />}
          onClick={onAddClick}
          disableElevation
          size="small"
        >
          {t('shopping.addProduct')}
        </Button>

        {items.length > 0 && (
          <CountText color="text.secondary">
            {t('shopping.count', { count: items.length })}
          </CountText>
        )}

        {purchasedItems.length > 0 && (
          <ClearButton
            variant="outlined"
            color="inherit"
            startIcon={<MdDeleteSweep size={16} />}
            onClick={onClearPurchased}
            size="small"
          >
            {t('shopping.clearPurchased')}
          </ClearButton>
        )}
      </TopBar>

      <ItemsPaper elevation={0}>
        {items.length === 0 ? (
          <EmptyState>
            <MdShoppingCart size={52} color="#c8e6c9" />
            <Typography variant="body1" sx={{ fontWeight: 500 }}>
              {t('shopping.emptyTitle')}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              {t('shopping.emptySubtitle')}
            </Typography>
          </EmptyState>
        ) : (
          <ItemsBox>
            {pendingItems.length > 0 && (
              <List disablePadding>
                {pendingItems.map((item) => (
                  <ShoppingItem key={item.id} item={item} onToggle={onToggle} onDelete={onDelete} onEdit={onEdit} onQuantityChange={onQuantityChange} />
                ))}
              </List>
            )}
            {purchasedItems.length > 0 && (
              <>
                <Divider sx={{ my: 1 }}>
                  <Typography variant="caption" color="text.secondary">
                    {t('shopping.purchased')}
                  </Typography>
                </Divider>
                <List disablePadding>
                  {purchasedItems.map((item) => (
                    <ShoppingItem key={item.id} item={item} onToggle={onToggle} onDelete={onDelete} onEdit={onEdit} onQuantityChange={onQuantityChange} />
                  ))}
                </List>
              </>
            )}
          </ItemsBox>
        )}
      </ItemsPaper>

      <NearbyStores />
    </Wrapper>
  )
}
