import IconButton from '@mui/material/IconButton'
import Typography from '@mui/material/Typography'
import { MdFavorite, MdOutlineShoppingCart } from 'react-icons/md'
import { useTranslation } from 'react-i18next'
import { useFavoriteShoppingLists, useToggleFavoriteShoppingList } from '../../hooks/useFavoriteShoppingLists'
import { EmptyHint, ListRow, ListIconWrap, ListTextWrap, ListName } from './FavoriteShoppingListsSection.styles'

export interface FavoriteShoppingListsSectionProps {
  onSelectList?: (listId: string) => void
}

// No image is possible for a shopping list (it's not an external resource
// with a photo) — fixed cart icon throughout, same reasoning as
// FavoriteIngredientsSection's plain chip row.
export default function FavoriteShoppingListsSection({ onSelectList }: FavoriteShoppingListsSectionProps) {
  const { t } = useTranslation()
  const { data: lists = [] } = useFavoriteShoppingLists()
  const toggle = useToggleFavoriteShoppingList()

  if (lists.length === 0) {
    return <EmptyHint>{t('favorites.shoppingListsEmpty')}</EmptyHint>
  }

  return (
    <div>
      {lists.map((list) => {
        const name = list.isGeneral ? t('shopping.lists.general') : list.name
        return (
          <ListRow
            key={list.id}
            role="button"
            tabIndex={0}
            aria-label={name}
            onClick={() => onSelectList?.(list.id)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') onSelectList?.(list.id)
            }}
          >
            <ListIconWrap>
              <MdOutlineShoppingCart size={20} />
            </ListIconWrap>
            <ListTextWrap>
              <ListName>{name}</ListName>
            </ListTextWrap>
            <Typography variant="caption" color="text.secondary">
              {t('shopping.count', { count: list.itemCount })}
            </Typography>
            <IconButton
              size="small"
              aria-label={t('shopping.removeFavoriteList')}
              onClick={(e) => {
                e.stopPropagation()
                toggle.mutate({ listId: list.id, isFavorite: true })
              }}
            >
              <MdFavorite size={18} color="var(--scheme-primary)" />
            </IconButton>
          </ListRow>
        )
      })}
    </div>
  )
}
