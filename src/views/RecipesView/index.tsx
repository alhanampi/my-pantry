import { useMemo, useState } from 'react'
import type { UseMutationResult } from '@tanstack/react-query'
import Typography from '@mui/material/Typography'
import Button from '@mui/material/Button'
import { MdArrowBack, MdRestaurantMenu } from 'react-icons/md'
import { useTranslation } from 'react-i18next'
import RecipesFilterBar from './RecipesFilterBar'
import RecipeCardGrid from './RecipeCardGrid'
import RecipeDetailPanel from './RecipeDetailPanel'
import RecipesSkeleton from './RecipesSkeleton'
import ConfirmActionDialog from '../../components/ConfirmActionDialog'
import { Wrapper, EmptyState, ErrorState, BackRow, BackButton } from './RecipesView.styles'
import { useRecipeSearch, useRecipeDetail } from '../../hooks/useRecipes'
import { useFavoriteIds, useFavoriteToggle } from '../../hooks/useFavorites'
import type { RecipeSearchFilters, RecipeIngredient } from '../../utils/types'

const EMPTY_FILTERS: RecipeSearchFilters = {
  query: '',
  cuisine: '',
  diet: '',
  includeIngredients: '',
  maxCalories: '',
}

export interface RecipesViewProps {
  sendRecipeToShoppingList: UseMutationResult<
    string,
    Error,
    { recipeTitle: string; ingredients: RecipeIngredient[] }
  >
  onSentToList: (listId: string) => void
}

export default function RecipesView({ sendRecipeToShoppingList, onSentToList }: RecipesViewProps) {
  const { t } = useTranslation()
  const [filters, setFilters] = useState<RecipeSearchFilters>(EMPTY_FILTERS)
  const [selectedRecipeId, setSelectedRecipeId] = useState<number | null>(null)

  const search = useRecipeSearch(filters)
  const detail = useRecipeDetail(selectedRecipeId)
  const favoriteIds = useFavoriteIds()
  const favoriteToggle = useFavoriteToggle()

  const recipes = useMemo(() => search.data?.pages.flatMap((page) => page.results) ?? [], [search.data])
  const favoriteIdSet = useMemo(() => new Set(favoriteIds.data ?? []), [favoriteIds.data])

  const handleSendToShoppingList = (payload: { recipeTitle: string; ingredients: RecipeIngredient[] }): void => {
    sendRecipeToShoppingList.mutate(payload, {
      onSuccess: (listId) => onSentToList(listId),
    })
  }

  const handleToggleFavorite = (id: number): void => {
    favoriteToggle.requestToggle(id, favoriteIdSet.has(id))
  }

  // In-tab sub-state (grid vs. detail) — documented exception to the "flat
  // views" pattern in docs/routing.md, since there's no router to push a
  // recipe id onto.
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
            <Typography variant="body1">{t(errorKey(detail.error))}</Typography>
          </ErrorState>
        )}

        {detail.data && (
          <RecipeDetailPanel
            recipe={detail.data}
            onSendToShoppingList={handleSendToShoppingList}
            isSending={sendRecipeToShoppingList.isPending}
            isFavorite={favoriteIdSet.has(detail.data.id)}
            onToggleFavorite={handleToggleFavorite}
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
      <RecipesFilterBar filters={filters} onChange={setFilters} />

      {search.isLoading && <RecipesSkeleton />}

      {search.isError && (
        <ErrorState>
          <Typography variant="body1">{t(errorKey(search.error))}</Typography>
          <Button variant="outlined" onClick={() => void search.refetch()}>
            {t('recipes.retry')}
          </Button>
        </ErrorState>
      )}

      {!search.isLoading && !search.isError && recipes.length === 0 && (
        <EmptyState>
          <MdRestaurantMenu size={48} color="var(--scheme-accent-medium)" />
          <Typography variant="body1" sx={{ fontWeight: 500 }}>
            {t('recipes.emptyTitle')}
          </Typography>
        </EmptyState>
      )}

      {!search.isLoading && recipes.length > 0 && (
        <RecipeCardGrid
          recipes={recipes}
          onSelect={setSelectedRecipeId}
          hasNextPage={!!search.hasNextPage}
          isFetchingNextPage={search.isFetchingNextPage}
          onLoadMore={() => void search.fetchNextPage()}
          favoriteIds={favoriteIdSet}
          onToggleFavorite={handleToggleFavorite}
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

function errorKey(error: unknown): string {
  const message = error instanceof Error ? error.message : ''
  if (message === 'quotaExceeded') return 'recipes.errors.quotaExceeded'
  if (message === 'configError') return 'recipes.errors.configError'
  return 'recipes.errors.generic'
}
