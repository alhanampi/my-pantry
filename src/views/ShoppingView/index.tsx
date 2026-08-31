import List from '@mui/material/List'
import Divider from '@mui/material/Divider'
import Typography from '@mui/material/Typography'
import Button from '@mui/material/Button'
import { MdShoppingCart, MdAdd, MdDeleteSweep, MdDeleteOutline } from 'react-icons/md'
import { useTranslation } from 'react-i18next'
import ShoppingItem from './ShoppingItem'
import ShoppingListSelector from './ShoppingListSelector'
import NearbyStores from './NearbyStores'
import ShoppingSkeleton from './ShoppingSkeleton'
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
  lists = [],
  selectedListId,
  onSelectList,
  onAddClick,
  onDeleteListClick,
  onToggle,
  onDelete,
  onEdit,
  onClearPurchased,
  onQuantityChange,
  isLoading = false,
}: ShoppingListProps) {
  const { t } = useTranslation()

  if (isLoading) return <ShoppingSkeleton />

  const pendingItems = items.filter((i) => !i.purchased)
  const purchasedItems = items.filter((i) => i.purchased)
  const selectedList = lists.find((l) => l.id === selectedListId)

  return (
    <Wrapper>
      {onSelectList && (
        <ShoppingListSelector lists={lists} selectedListId={selectedListId} onSelectList={onSelectList} />
      )}
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

        {selectedList && !selectedList.isGeneral && onDeleteListClick && (
          <ClearButton
            variant="outlined"
            color="inherit"
            startIcon={<MdDeleteOutline size={16} />}
            onClick={onDeleteListClick}
            size="small"
          >
            {t('shopping.deleteList')}
          </ClearButton>
        )}

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
            <MdShoppingCart size={52} color="var(--scheme-accent-medium)" />
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
