import ListItemText from '@mui/material/ListItemText'
import Tooltip from '@mui/material/Tooltip'
import Typography from '@mui/material/Typography'
import IconButton from '@mui/material/IconButton'
import { MdDeleteOutline, MdModeEditOutline } from 'react-icons/md'
import { useTranslation } from 'react-i18next'
import QuantityStepper from '../../../components/QuantityStepper'
import { StyledListItem, ItemCheckbox, ItemName, DeleteButton } from './ShoppingItem.styles'
import type { ShoppingItemProps } from '../../../utils/types'

export default function ShoppingItem({ item, onToggle, onDelete, onEdit, onQuantityChange }: ShoppingItemProps) {
  const { t } = useTranslation()

  return (
    <StyledListItem disableGutters $purchased={item.purchased}>
      <Tooltip title={item.purchased ? t('shopping.markPending') : t('shopping.markPurchased')}>
        <ItemCheckbox
          checked={item.purchased}
          onChange={() => onToggle(item.id)}
          size="small"
          color="primary"
        />
      </Tooltip>

      <ListItemText
        disableTypography
        primary={<ItemName $purchased={item.purchased}>{item.name}</ItemName>}
        secondary={
          item.brand ? (
            <Typography variant="caption" color="text.secondary">
              {item.brand}
            </Typography>
          ) : undefined
        }
      />

      <QuantityStepper
        value={item.quantity}
        onIncrement={() => onQuantityChange(item.id, 1)}
        onDecrement={() => onQuantityChange(item.id, -1)}
      />

      <Tooltip title={t('card.edit')}>
        <IconButton
          size="small"
          onClick={() => onEdit(item.id)}
          aria-label={t('card.edit')}
          sx={{ color: 'var(--scheme-info-light)', '&:hover': { color: 'var(--scheme-info-dark)', bgcolor: 'var(--scheme-info-bg)' } }}
        >
          <MdModeEditOutline size={20} />
        </IconButton>
      </Tooltip>
      <Tooltip title={t('shopping.deleteItem')}>
        <DeleteButton
          size="small"
          onClick={() => onDelete(item.id)}
          aria-label={t('shopping.deleteItem')}
        >
          <MdDeleteOutline size={20} />
        </DeleteButton>
      </Tooltip>
    </StyledListItem>
  )
}
