import { useMemo, useState } from 'react'
import type { UseMutationResult } from '@tanstack/react-query'
import Typography from '@mui/material/Typography'
import { MdArrowBack, MdOutlineRestaurantMenu, MdOutlineEco, MdOutlineStorefront, MdOutlineShoppingCart } from 'react-icons/md'
import { useTranslation } from 'react-i18next'
import FavoriteSection from '../../components/FavoriteSection'
import RecipeCardGrid from '../RecipesView/RecipeCardGrid'
import RecipeDetailPanel from '../RecipesView/RecipeDetailPanel'
import RecipesSkeleton from '../RecipesView/RecipesSkeleton'
import ConfirmActionDialog from '../../components/ConfirmActionDialog'
import FavoriteIngredientsSection from './FavoriteIngredientsSection'
import FavoriteStoresSection from './FavoriteStoresSection'
import FavoriteShoppingListsSection from './FavoriteShoppingListsSection'
import { Wrapper, ErrorState, BackRow, BackButton } from '../RecipesView/RecipesView.styles'
import { useRecipeDetail } from '../../hooks/useRecipes'
import { useFavoriteIds, useFavoriteRecipes, useFavoriteToggle } from '../../hooks/useFavorites'
import { useFavoriteIngredients } from '../../hooks/useFavoriteIngredients'
import { useFavoriteStores } from '../../hooks/useFavoriteStores'
import { useFavoriteShoppingLists } from '../../hooks/useFavoriteShoppingLists'
import type { RecipeIngredient } from '../../utils/types'

export interface FavoritesViewProps {
  sendRecipeToShoppingList: UseMutationResult<
    string,
    Error,
    { recipeTitle: string; ingredients: RecipeIngredient[] }
  >
  onSentToList: (listId: string) => void
  onSelectShoppingList?: (listId: string) => void
}

// A hub of everything the user has bookmarked, grouped into collapsible
// per-category sections (FavoriteSection) — recipes, ingredients, stores,
// and shopping lists today; mealpreps land in a later pass. Selecting a
// recipe breaks out of the section layout entirely to show the full detail
// panel, same as the old FavoriteRecipesView this replaces.
export default function FavoritesView({ sendRecipeToShoppingList, onSentToList, onSelectShoppingList }: FavoritesViewProps) {
  const { t } = useTranslation()
  const [selectedRecipeId, setSelectedRecipeId] = useState<string | null>(null)

  const favorites = useFavoriteRecipes()
  const detail = useRecipeDetail(selectedRecipeId)
  const favoriteIds = useFavoriteIds()
  const favoriteToggle = useFavoriteToggle()
  const favoriteIngredients = useFavoriteIngredients()
  const favoriteStores = useFavoriteStores()
  const favoriteShoppingLists = useFavoriteShoppingLists()

  const favoriteIdSet = useMemo(() => new Set(favoriteIds.data ?? []), [favoriteIds.data])

  const handleSendToShoppingList = (payload: { recipeTitle: string; ingredients: RecipeIngredient[] }): void => {
    sendRecipeToShoppingList.mutate(payload, {
      onSuccess: (listId) => onSentToList(listId),
    })
  }

  const handleToggleFavorite = (id: string): void => {
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
      <FavoriteSection
        title={t('favorites.recipesSectionTitle')}
        icon={MdOutlineRestaurantMenu}
        count={favorites.data?.length ?? 0}
      >
        {favorites.isLoading && <RecipesSkeleton />}

        {favorites.isError && (
          <ErrorState>
            <Typography variant="body1">{t('recipes.errors.generic')}</Typography>
          </ErrorState>
        )}

        {!favorites.isLoading && !favorites.isError && (favorites.data ?? []).length === 0 && (
          <Typography variant="body2" color="text.secondary">
            {t('recipes.favoritesEmptyTitle')}
          </Typography>
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
      </FavoriteSection>

      <FavoriteSection
        title={t('favorites.ingredientsSectionTitle')}
        icon={MdOutlineEco}
        count={favoriteIngredients.data?.length ?? 0}
      >
        <FavoriteIngredientsSection />
      </FavoriteSection>

      <FavoriteSection
        title={t('favorites.storesSectionTitle')}
        icon={MdOutlineStorefront}
        count={favoriteStores.data?.length ?? 0}
      >
        <FavoriteStoresSection />
      </FavoriteSection>

      <FavoriteSection
        title={t('favorites.shoppingListsSectionTitle')}
        icon={MdOutlineShoppingCart}
        count={favoriteShoppingLists.data?.length ?? 0}
      >
        <FavoriteShoppingListsSection onSelectList={onSelectShoppingList} />
      </FavoriteSection>

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
