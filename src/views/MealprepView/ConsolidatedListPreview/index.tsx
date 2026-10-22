import Button from '@mui/material/Button'
import CircularProgress from '@mui/material/CircularProgress'
import { useTranslation } from 'react-i18next'
import type { ConsolidatedShoppingItem } from '../../../utils/types'
import { Wrapper, Heading, ItemList, ItemRow, ItemName, ItemQuantity, PantryNote, Actions } from './ConsolidatedListPreview.styles'

export interface ConsolidatedListPreviewProps {
  items: ConsolidatedShoppingItem[]
  onConfirm: () => void
  onCancel: () => void
  isPending?: boolean
}

export default function ConsolidatedListPreview({
  items,
  onConfirm,
  onCancel,
  isPending = false,
}: ConsolidatedListPreviewProps) {
  const { t } = useTranslation()

  return (
    <Wrapper>
      <Heading>{t('mealprep.consolidatedList.heading')}</Heading>

      {items.length === 0 ? (
        <span>{t('mealprep.consolidatedList.allCovered')}</span>
      ) : (
        <ItemList>
          {items.map((item) => (
            <ItemRow key={item.name}>
              <ItemName>
                {item.name}
                {item.pantryNote && <PantryNote>{t('mealprep.consolidatedList.pantryNote')}</PantryNote>}
              </ItemName>
              <ItemQuantity>{item.quantity}</ItemQuantity>
            </ItemRow>
          ))}
        </ItemList>
      )}

      <Actions>
        <Button onClick={onCancel} disabled={isPending}>
          {t('mealprep.consolidatedList.cancel')}
        </Button>
        <Button
          variant="contained"
          disableElevation
          onClick={onConfirm}
          disabled={isPending || items.length === 0}
          startIcon={isPending ? <CircularProgress size={16} color="inherit" /> : undefined}
        >
          {t('mealprep.consolidatedList.pushToShoppingList')}
        </Button>
      </Actions>
    </Wrapper>
  )
}
