import { useState } from 'react'
import type { UseMutationResult } from '@tanstack/react-query'
import { useAuth } from '@clerk/clerk-react'
import Typography from '@mui/material/Typography'
import Button from '@mui/material/Button'
import CircularProgress from '@mui/material/CircularProgress'
import { MdArrowBack, MdOutlineCalendarMonth, MdDeleteOutline, MdLocalShipping } from 'react-icons/md'
import { useTranslation } from 'react-i18next'
import WeeklyCalendar from './WeeklyCalendar'
import MealPlanGenerator from './MealPlanGenerator'
import ConsolidatedListPreview from './ConsolidatedListPreview'
import ConfirmActionDialog from '../../components/ConfirmActionDialog'
import RecipeDetailPanel from '../RecipesView/RecipeDetailPanel'
import RecipesSkeleton from '../RecipesView/RecipesSkeleton'
import {
  useCurrentMealPlan,
  useGenerateMealPlan,
  useDeleteMealPlan,
  useConsolidateMealPlan,
  useCreateShoppingListFromMealPlan,
} from '../../hooks/useMealPlan'
import { useRecipeDetail } from '../../hooks/useRecipes'
import { useFavoriteIds, useFavoriteToggle } from '../../hooks/useFavorites'
import { Wrapper, TopBar, Title, EmptyState, ErrorState, BackRow, ActionsRow } from './MealprepView.styles'
import type { RecipeIngredient } from '../../utils/types'

export interface MealprepViewProps {
  sendRecipeToShoppingList: UseMutationResult<
    string,
    Error,
    { recipeTitle: string; ingredients: RecipeIngredient[] }
  >
  onSentToList: (listId: string) => void
}

export default function MealprepView({ sendRecipeToShoppingList, onSentToList }: MealprepViewProps) {
  const { t } = useTranslation()
  const { isSignedIn, isLoaded } = useAuth()

  const [selectedRecipeId, setSelectedRecipeId] = useState<string | null>(null)
  const [previewItems, setPreviewItems] = useState<ReturnType<typeof useConsolidateMealPlan>['data']>(undefined)
  const [deleteConfirm, setDeleteConfirm] = useState(false)

  const mealPlanQuery = useCurrentMealPlan()
  const generateMealPlan = useGenerateMealPlan()
  const deleteMealPlan = useDeleteMealPlan()
  const consolidate = useConsolidateMealPlan()
  const createShoppingList = useCreateShoppingListFromMealPlan()
  const detail = useRecipeDetail(selectedRecipeId)
  const favoriteIds = useFavoriteIds()
  const favoriteToggle = useFavoriteToggle()
  const favoriteIdSet = new Set(favoriteIds.data ?? [])

  if (!isLoaded) return <RecipesSkeleton />

  if (!isSignedIn) {
    return (
      <Wrapper>
        <EmptyState>
          <MdOutlineCalendarMonth size={48} color="var(--scheme-accent-medium)" />
          <Typography variant="body1" sx={{ fontWeight: 500 }}>
            {t('mealprep.signedOutTitle')}
          </Typography>
          <Typography variant="body2" color="text.secondary">
            {t('mealprep.signedOutBody')}
          </Typography>
        </EmptyState>
      </Wrapper>
    )
  }

  const handleToggleFavorite = (id: string): void => {
    favoriteToggle.requestToggle(id, favoriteIdSet.has(id))
  }

  const handleSendToShoppingList = (payload: { recipeTitle: string; ingredients: RecipeIngredient[] }): void => {
    sendRecipeToShoppingList.mutate(payload, { onSuccess: (listId) => onSentToList(listId) })
  }

  // Sub-state: viewing one day's recipe in full detail — same in-tab
  // drill-down exception ChatView/RecipesView already use.
  if (selectedRecipeId !== null) {
    return (
      <Wrapper>
        <BackRow>
          <Button startIcon={<MdArrowBack size={18} />} onClick={() => setSelectedRecipeId(null)} size="small">
            {t('mealprep.backToCalendar')}
          </Button>
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

  const mealPlan = mealPlanQuery.data

  return (
    <Wrapper>
      <TopBar>
        <Title>{t('mealprep.title')}</Title>
        {mealPlan && (
          <Button
            size="small"
            color="error"
            startIcon={<MdDeleteOutline size={16} />}
            onClick={() => setDeleteConfirm(true)}
          >
            {t('mealprep.deletePlan')}
          </Button>
        )}
      </TopBar>

      {mealPlanQuery.isLoading && <RecipesSkeleton />}

      {!mealPlanQuery.isLoading && !mealPlan && (
        <MealPlanGenerator
          onGenerate={(payload) => generateMealPlan.mutate(payload)}
          isPending={generateMealPlan.isPending}
        />
      )}

      {mealPlan && previewItems === undefined && (
        <>
          <WeeklyCalendar mealPlan={mealPlan} onSelectRecipe={setSelectedRecipeId} />
          <ActionsRow>
            <Button
              variant="contained"
              disableElevation
              startIcon={
                consolidate.isPending ? <CircularProgress size={16} color="inherit" /> : <MdLocalShipping size={18} />
              }
              disabled={consolidate.isPending}
              onClick={() => consolidate.mutate(mealPlan.id, { onSuccess: (items) => setPreviewItems(items) })}
            >
              {consolidate.isPending ? t('mealprep.consolidating') : t('mealprep.consolidatedList.pushToShoppingList')}
            </Button>
          </ActionsRow>
        </>
      )}

      {mealPlan && previewItems !== undefined && (
        <ConsolidatedListPreview
          items={previewItems}
          isPending={createShoppingList.isPending}
          onCancel={() => setPreviewItems(undefined)}
          onConfirm={() =>
            createShoppingList.mutate(
              { weekStart: mealPlan.weekStart, items: previewItems },
              {
                onSuccess: (listId) => {
                  setPreviewItems(undefined)
                  onSentToList(listId)
                },
              },
            )
          }
        />
      )}

      <ConfirmActionDialog
        open={deleteConfirm}
        title={t('mealprep.deletePlanConfirmTitle')}
        body={t('mealprep.deletePlanConfirmBody')}
        confirmLabel={t('mealprep.deletePlan')}
        onConfirm={() => {
          setDeleteConfirm(false)
          if (mealPlan) deleteMealPlan.mutate(mealPlan.id)
        }}
        onCancel={() => setDeleteConfirm(false)}
      />

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
