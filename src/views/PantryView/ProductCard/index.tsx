import { useState, Fragment } from 'react'
import Collapse from '@mui/material/Collapse'
import IconButton from '@mui/material/IconButton'
import Tooltip from '@mui/material/Tooltip'
import Typography from '@mui/material/Typography'
import Button from '@mui/material/Button'
import Card from '@mui/material/Card'
import Box from '@mui/material/Box'
import { MdExpandMore, MdExpandLess, MdAddShoppingCart, MdDeleteOutline, MdModeEditOutline } from 'react-icons/md'
import { useTranslation } from 'react-i18next'
import { formatDate, getExpiryStatus } from '../../../utils/helpers'
import QuantityStepper from '../../../components/QuantityStepper'
import {
  StyledCardContent,
  SummaryRow,
  DetailsGrid,
  ProductName,
  DetailLabel,
  DetailValue,
  SummaryDivider,
  DeleteRow,
} from './ProductCard.styles'
import type { ProductCardProps } from '../../../utils/types'

export default function ProductCard({
  product,
  onDelete,
  onEdit,
  onAddToCart,
  onQuantityChange,
}: ProductCardProps) {
  const [expanded, setExpanded] = useState(false)
  const { t } = useTranslation()
  const expiryStatus = getExpiryStatus(product.expiryDate)

  const expiryColor =
    expiryStatus === 'expired' ? 'var(--scheme-error)' : expiryStatus === 'soon' ? 'var(--scheme-warning)' : 'var(--scheme-text-secondary)'

  return (
    <Card
      elevation={0}
      sx={{
        mb: 0.75,
        border: '1px solid',
        borderColor: expanded ? 'primary.light' : 'divider',
        borderRadius: 2,
        transition: 'border-color 0.2s',
        overflow: 'hidden',
      }}
    >
      <StyledCardContent>
        <SummaryRow onClick={() => setExpanded((v) => !v)}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <ProductName>{product.name}</ProductName>
            {product.brand && (
              <Typography variant="caption" color="text.secondary">
                {product.brand}
              </Typography>
            )}
          </div>

          {product.expiryDate && (
            <Box sx={{ display: 'flex', alignItems: 'center', flexShrink: 0, minWidth: '100px', justifyContent: 'flex-end' }}>
              <Typography variant="caption" sx={{ minWidth: '1.2em', textAlign: 'center' }}>
                {expiryStatus === 'expired' ? '⚠' : expiryStatus === 'soon' ? '⏳' : ''}
              </Typography>
              <Typography variant="caption" sx={{ color: expiryColor, fontWeight: 600 }}>
                {formatDate(product.expiryDate)}
              </Typography>
            </Box>
          )}

          <QuantityStepper
            value={product.quantity}
            onIncrement={() => onQuantityChange(product.id, 1)}
            onDecrement={() => onQuantityChange(product.id, -1)}
          />

          <Tooltip title={t('card.addToCart')}>
            <IconButton
              size="small"
              onClick={(e) => {
                e.stopPropagation()
                onAddToCart(product)
              }}
              sx={{ color: 'primary.main', flexShrink: 0 }}
              aria-label={t('card.addToCart')}
            >
              <MdAddShoppingCart size={20} />
            </IconButton>
          </Tooltip>

          <IconButton size="small" sx={{ flexShrink: 0 }} aria-label="expand">
            {expanded ? <MdExpandLess size={20} /> : <MdExpandMore size={20} />}
          </IconButton>
        </SummaryRow>

        <Collapse in={expanded}>
          <SummaryDivider />
          <DetailsGrid>
            {[
              [t('card.brand'), product.brand || '—'],
              [t('card.purchaseDate'), formatDate(product.purchaseDate)],
              [t('card.location'), product.location || '—'],
            ].map(([label, value]) => (
              <Fragment key={label}>
                <DetailLabel>{label}</DetailLabel>
                <DetailValue>{value}</DetailValue>
              </Fragment>
            ))}
            <DetailLabel>{t('card.expiryDate')}</DetailLabel>
            <Typography
              variant="body2"
              sx={{ color: expiryColor, fontWeight: expiryStatus !== 'none' ? 600 : 400 }}
            >
              {formatDate(product.expiryDate)}
            </Typography>
            {product.details && (
              <Fragment key="details">
                <DetailLabel>{t('card.details')}</DetailLabel>
                <DetailValue>{product.details}</DetailValue>
              </Fragment>
            )}
          </DetailsGrid>

          <DeleteRow>
            <Button
              size="small"
              startIcon={<MdModeEditOutline size={16} />}
              onClick={() => onEdit(product.id)}
              sx={{ textTransform: 'none' }}
            >
              {t('card.edit')}
            </Button>
            <Button
              size="small"
              color="error"
              startIcon={<MdDeleteOutline size={16} />}
              onClick={() => onDelete(product.id)}
              sx={{ textTransform: 'none' }}
            >
              {t('card.delete')}
            </Button>
          </DeleteRow>
        </Collapse>
      </StyledCardContent>
    </Card>
  )
}
