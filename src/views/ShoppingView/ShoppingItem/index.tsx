import { useState, Fragment } from 'react'
import Collapse from '@mui/material/Collapse'
import IconButton from '@mui/material/IconButton'
import Tooltip from '@mui/material/Tooltip'
import Typography from '@mui/material/Typography'
import { MdExpandMore, MdExpandLess, MdDeleteOutline, MdModeEditOutline } from 'react-icons/md'
import { useTranslation } from 'react-i18next'
import { formatDate } from '../../../utils/helpers'
import QuantityStepper from '../../../components/QuantityStepper'
import {
  StyledListItem,
  ItemCheckbox,
  ItemName,
  SummaryRow,
  DetailsGrid,
  DetailLabel,
  DetailValue,
  SummaryDivider,
} from './ShoppingItem.styles'
import type { ShoppingItemProps } from '../../../utils/types'

export default function ShoppingItem({ item, onToggle, onDelete, onEdit, onQuantityChange }: ShoppingItemProps) {
  const [expanded, setExpanded] = useState(false)
  const { t } = useTranslation()

  const fields: [string, string][] = [
    [t('card.brand'),        item.brand        || '—'],
    [t('card.purchaseDate'), formatDate(item.purchaseDate)],
    [t('card.location'),     item.location     || '—'],
    [t('card.details'),      item.details      || '—'],
  ]

  return (
    <StyledListItem disableGutters $purchased={item.purchased}>
      <SummaryRow onClick={() => setExpanded((v) => !v)}>
        <Tooltip title={item.purchased ? t('shopping.markPending') : t('shopping.markPurchased')}>
          <ItemCheckbox
            checked={item.purchased}
            onChange={() => onToggle(item.id)}
            onClick={(e) => e.stopPropagation()}
            size="small"
            color="primary"
          />
        </Tooltip>

        <div style={{ flex: 1, minWidth: 0 }}>
          <ItemName $purchased={item.purchased}>{item.name}</ItemName>
          {item.brand && (
            <Typography variant="caption" color="text.secondary">
              {item.brand}
            </Typography>
          )}
        </div>

        <QuantityStepper
          value={item.quantity}
          onIncrement={() => onQuantityChange(item.id, 1)}
          onDecrement={() => onQuantityChange(item.id, -1)}
        />

        <Tooltip title={t('card.edit')}>
          <IconButton
            size="small"
            onClick={(e) => { e.stopPropagation(); onEdit(item.id) }}
            sx={{ color: 'var(--scheme-info-light)', '&:hover': { color: 'var(--scheme-info-dark)', bgcolor: 'var(--scheme-info-bg)' } }}
          >
            <MdModeEditOutline size={20} />
          </IconButton>
        </Tooltip>

        <Tooltip title={t('shopping.deleteItem')}>
          <IconButton
            size="small"
            onClick={(e) => { e.stopPropagation(); onDelete(item.id) }}
            sx={{ color: 'var(--scheme-error-light)', '&:hover': { color: 'var(--scheme-error)', bgcolor: 'var(--scheme-error-bg)' } }}
          >
            <MdDeleteOutline size={20} />
          </IconButton>
        </Tooltip>

        <IconButton
          size="small"
          sx={{ flexShrink: 0 }}
          aria-label="expand"
          onClick={(e) => { e.stopPropagation(); setExpanded((v) => !v) }}
        >
          {expanded ? <MdExpandLess size={20} /> : <MdExpandMore size={20} />}
        </IconButton>
      </SummaryRow>

      <Collapse in={expanded}>
        <SummaryDivider />
        <DetailsGrid>
          {fields.map(([label, value]) => (
            <Fragment key={label}>
              <DetailLabel>{label}</DetailLabel>
              <DetailValue>{value}</DetailValue>
            </Fragment>
          ))}
        </DetailsGrid>
      </Collapse>
    </StyledListItem>
  )
}
