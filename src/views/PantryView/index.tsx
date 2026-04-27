import IconButton from '@mui/material/IconButton'
import Tooltip from '@mui/material/Tooltip'
import useMediaQuery from '@mui/material/useMediaQuery'
import { useTheme } from '@mui/material/styles'
import { MdInventory2, MdAddCircle } from 'react-icons/md'
import { useTranslation } from 'react-i18next'
import SortableHeader from './SortableHeader'
import ProductRow from './ProductRow'
import ProductCard from './ProductCard'
import {
  TableWrapper,
  ScrollContainer,
  HeaderRow,
  ActionsHeaderCell,
  EmptyState,
  ActionBar,
  MobileActionBar,
  EmptyHeading,
  EmptySubtext,
  CountText,
} from './PantryView.styles'
import type { Product, ProductTableProps } from '../../utils/types'

export default function PantryView({
  products,
  sortConfig,
  onSort,
  onDelete,
  onEdit,
  onAddToCart,
  onAddClick,
  onQuantityChange,
}: ProductTableProps) {
  const { t } = useTranslation()
  const theme = useTheme()
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'))

  const columns: Array<{ key: keyof Product; label: string; flex: number; minWidth: string }> = [
    { key: 'name', label: t('table.name'), flex: 3, minWidth: '120px' },
    { key: 'brand', label: t('table.brand'), flex: 2, minWidth: '80px' },
    { key: 'purchaseDate', label: t('table.purchaseDate'), flex: 2, minWidth: '95px' },
    { key: 'location', label: t('table.location'), flex: 2, minWidth: '100px' },
    { key: 'expiryDate', label: t('table.expiryDate'), flex: 2, minWidth: '95px' },
  ]

  const empty = (
    <EmptyState>
      <MdInventory2 size={52} color="var(--scheme-accent-medium)" />
      <EmptyHeading>{t('table.emptyTitle')}</EmptyHeading>
      <EmptySubtext>{t('table.emptySubtitle')}</EmptySubtext>
    </EmptyState>
  )

  const addButton = (
    <Tooltip title={t('header.addProduct')}>
      <IconButton onClick={onAddClick} size="small" aria-label={t('header.addProduct')}>
        <MdAddCircle size={28} color="var(--scheme-primary)" />
      </IconButton>
    </Tooltip>
  )

  if (isMobile) {
    return (
      <div>
        <MobileActionBar>
          <CountText>
            {products.length > 0 ? t('table.count', { count: products.length }) : t('table.emptyTitle')}
          </CountText>
          {addButton}
        </MobileActionBar>
        {products.length === 0 ? (
          <TableWrapper>{empty}</TableWrapper>
        ) : (
          products.map((product) => (
            <ProductCard
              key={product.id}
              product={product}
              onDelete={onDelete}
              onEdit={onEdit}
              onAddToCart={onAddToCart}
              onQuantityChange={onQuantityChange}
            />
          ))
        )}
      </div>
    )
  }

  return (
    <TableWrapper>
      <ActionBar>
        <CountText>
          {products.length > 0 ? t('table.count', { count: products.length }) : ''}
        </CountText>
        {addButton}
      </ActionBar>
      <ScrollContainer>
        <HeaderRow role="row">
          {columns.map((col) => (
            <SortableHeader
              key={col.key}
              columnKey={col.key}
              label={col.label}
              flex={col.flex}
              minWidth={col.minWidth}
              sortConfig={sortConfig}
              onSort={onSort}
            />
          ))}
          <ActionsHeaderCell />
        </HeaderRow>
        {products.length === 0 ? (
          empty
        ) : (
          <div role="list">
            {products.map((product) => (
              <ProductRow
                key={product.id}
                product={product}
                onDelete={onDelete}
                onEdit={onEdit}
                onAddToCart={onAddToCart}
                onQuantityChange={onQuantityChange}
              />
            ))}
          </div>
        )}
      </ScrollContainer>
    </TableWrapper>
  )
}
