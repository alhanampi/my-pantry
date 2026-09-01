import { useMemo, useState } from 'react'
import type { UseMutationResult } from '@tanstack/react-query'
import Typography from '@mui/material/Typography'
import { MdArrowBack, MdFavoriteBorder } from 'react-icons/md'
import { useTranslation } from 'react-i18next'
import RecipeCardGrid from '../RecipesView/RecipeCardGrid'
import RecipeDetailPanel from '../RecipesView/RecipeDetailPanel'
import RecipesSkeleton from '../RecipesView/RecipesSkeleton'
import ConfirmActionDialog from '../../components/ConfirmActionDialog'
import { Wrapper, EmptyState, ErrorState, BackRow, BackButton } from '../RecipesView/RecipesView.styles'
import { useRecipeDetail } from '../../hooks/useRecipes'
import { useFavoriteIds, useFavoriteRecipes, useFavoriteToggle } from '../../hooks/useFavorites'
import type { RecipeIngredient } from '../../utils/types'

export interface FavoriteRecipesViewProps {
  sendRecipeToShoppingList: UseMutationResult<
    string,
    Error,
    { recipeTitle: string; ingredients: RecipeIngredient[] }
  >
  onSentToList: (listId: string) => void
}

// Bounded personal list — no search bar, no infinite scroll, unlike
// RecipesView. The "grid vs. detail" in-tab sub-state is duplicated from
// RecipesView rather than factored out; the two views are similar but not
// identical (no filters here), and the duplication is small enough that a
// shared abstraction wasn't worth the indirection.
export default function FavoriteRecipesView({ sendRecipeToShoppingList, onSentToList }: FavoriteRecipesViewProps) {
  const { t } = useTranslation()
  const [selectedRecipeId, setSelectedRecipeId] = useState<number | null>(null)

  const favorites = useFavoriteRecipes()
  const detail = useRecipeDetail(selectedRecipeId)
  const favoriteIds = useFavoriteIds()
  const favoriteToggle = useFavoriteToggle()

  const favoriteIdSet = useMemo(() => new Set(favoriteIds.data ?? []), [favoriteIds.data])

  const handleSendToShoppingList = (payload: { recipeTitle: string; ingredients: RecipeIngredient[] }): void => {
    sendRecipeToShoppingList.mutate(payload, {
      onSuccess: (listId) => onSentToList(listId),
    })
  }

  const handleToggleFavorite = (id: number): void => {
    favoriteToggle.requestToggle(id, favoriteIdSet.has(id))
  }

  if (selectedRecipeId !== null) {
    return (
      <Wrapper>
        <BackRow>
          <BackButton onClick={() => setSelectedRecipeId(null)} aria-label={t('recipes.back')}>
            <MdArrowBack size={20} />
          </BackButton>
          <Typography variant="body2">{t('recipes.back')}</Typography>
        </BackRow>

        {detail.isLoading && <RecipesSkeleton />}

        {detail.isError && (
          <ErrorState>
            <Typography variant="body1">{t('recipes.errors.generic')}</Typography>
          </ErrorState>
        )}

        {detail.data && (
          <RecipeDetailPanel
            recipe={detail.data}
            onSendToShoppingList={handleSendToShoppingList}
            isSending={sendRecipeToShoppingList.isPending}
            isFavorite={favoriteIdSet.has(detail.data.id)}
            onToggleFavorite={handleToggleFavorite}
            isTogglingFavorite={favoriteToggle.pendingRecipeId === detail.data.id}
          />
        )}

        <ConfirmActionDialog
          open={favoriteToggle.pendingRemoveId !== null}
          title={t('recipes.removeFavoriteConfirmTitle')}
          body={t('recipes.removeFavoriteConfirmBody')}
          confirmLabel={t('recipes.removeFavorite')}
          onConfirm={favoriteToggle.confirmRemove}
          onCancel={favoriteToggle.cancelRemove}
        />
      </Wrapper>
    )
  }

  return (
    <Wrapper>
      {favorites.isLoading && <RecipesSkeleton />}

      {favorites.isError && (
        <ErrorState>
          <Typography variant="body1">{t('recipes.errors.generic')}</Typography>
        </ErrorState>
      )}

      {!favorites.isLoading && !favorites.isError && (favorites.data ?? []).length === 0 && (
        <EmptyState>
          <MdFavoriteBorder size={48} color="var(--scheme-accent-medium)" />
          <Typography variant="body1" sx={{ fontWeight: 500 }}>
            {t('recipes.favoritesEmptyTitle')}
          </Typography>
        </EmptyState>
      )}

      {!favorites.isLoading && (favorites.data ?? []).length > 0 && (
        <RecipeCardGrid
          recipes={favorites.data ?? []}
          onSelect={setSelectedRecipeId}
          favoriteIds={favoriteIdSet}
          onToggleFavorite={handleToggleFavorite}
          pendingFavoriteId={favoriteToggle.pendingRecipeId}
        />
      )}

      <ConfirmActionDialog
        open={favoriteToggle.pendingRemoveId !== null}
        title={t('recipes.removeFavoriteConfirmTitle')}
        body={t('recipes.removeFavoriteConfirmBody')}
        confirmLabel={t('recipes.removeFavorite')}
        onConfirm={favoriteToggle.confirmRemove}
        onCancel={favoriteToggle.cancelRemove}
      />
    </Wrapper>
  )
}
