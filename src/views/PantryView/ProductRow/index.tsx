import IconButton from '@mui/material/IconButton'
import Tooltip from '@mui/material/Tooltip'
import { MdDeleteOutline, MdAddShoppingCart, MdModeEditOutline } from 'react-icons/md'
import { useTranslation } from 'react-i18next'
import { formatDate, getExpiryStatus } from '../../../utils/helpers'
import QuantityStepper from '../../../components/QuantityStepper'
import { Row, Cell, NameCell, MutedCell, NameCellContent, ExpiryText, ActionsCell } from './ProductRow.styles'
import type { ProductRowProps } from '../../../utils/types'

export default function ProductRow({ product, onDelete, onEdit, onAddToCart, onQuantityChange }: ProductRowProps) {
  const { t } = useTranslation()
  const expiryStatus = getExpiryStatus(product.expiryDate)

  return (
    <Row>
      <NameCell $flex={3} $minWidth="150px">
        <NameCellContent>
          {product.name}
          <QuantityStepper
            value={product.quantity}
            onIncrement={() => onQuantityChange(product.id, 1)}
            onDecrement={() => onQuantityChange(product.id, -1)}
          />
        </NameCellContent>
      </NameCell>
      <MutedCell $flex={2} $minWidth="80px">
        {product.brand || '—'}
      </MutedCell>
      <Cell $flex={2} $minWidth="95px">
        {formatDate(product.purchaseDate)}
      </Cell>
      <MutedCell $flex={2} $minWidth="100px">
        {product.location || '—'}
      </MutedCell>
      <Cell $flex={2} $minWidth="95px">
        <ExpiryText $status={expiryStatus}>
          {formatDate(product.expiryDate)}
          {expiryStatus === 'expired' && ' ⚠'}
          {expiryStatus === 'soon' && ' ⏳'}
        </ExpiryText>
      </Cell>
      <ActionsCell>
        <Tooltip title={t('card.addToCart')}>
          <IconButton
            size="small"
            onClick={() => onAddToCart(product)}
            aria-label={t('card.addToCart')}
            sx={{ color: 'var(--scheme-primary-light)', '&:hover': { color: 'var(--scheme-primary)', bgcolor: 'var(--scheme-accent-light)' } }}
          >
            <MdAddShoppingCart size={18} />
          </IconButton>
        </Tooltip>
        <Tooltip title={t('card.edit')}>
          <IconButton
            size="small"
            onClick={() => onEdit(product.id)}
            aria-label={`${t('card.edit')} ${product.name}`}
            sx={{ color: 'var(--scheme-info-light)', '&:hover': { color: 'var(--scheme-info-dark)', bgcolor: 'var(--scheme-info-bg)' } }}
          >
            <MdModeEditOutline size={18} />
          </IconButton>
        </Tooltip>
        <Tooltip title={t('card.delete')}>
          <IconButton
            size="small"
            onClick={() => onDelete(product.id)}
            aria-label={`${t('card.delete')} ${product.name}`}
            sx={{ color: 'var(--scheme-error-light)', '&:hover': { color: 'var(--scheme-error)', bgcolor: 'var(--scheme-error-bg)' } }}
          >
            <MdDeleteOutline size={18} />
          </IconButton>
        </Tooltip>
      </ActionsCell>
    </Row>
  )
}
