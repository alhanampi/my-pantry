import { useEffect, useState } from 'react'
import type { UseMutationResult } from '@tanstack/react-query'
import { useAuth } from '@clerk/clerk-react'
import Typography from '@mui/material/Typography'
import Button from '@mui/material/Button'
import CircularProgress from '@mui/material/CircularProgress'
import { MdArrowBack, MdOutlineCalendarMonth, MdDeleteOutline, MdLocalShipping, MdOutlineSoupKitchen } from 'react-icons/md'
import { useTranslation } from 'react-i18next'
import WeeklyCalendar from './WeeklyCalendar'
import MealPlanGenerator from './MealPlanGenerator'
import ConsolidatedListPreview from './ConsolidatedListPreview'
import MealprepRecipeDetail from './MealprepRecipeDetail'
import BatchPrepPlanView from './BatchPrepPlanView'
import RefinePlanInput from './RefinePlanInput'
import ConfirmActionDialog from '../../components/ConfirmActionDialog'
import RecipesSkeleton from '../RecipesView/RecipesSkeleton'
import {
  useCurrentMealPlan,
  useGenerateMealPlan,
  useDeleteMealPlan,
  useConsolidateMealPlan,
  useCreateShoppingListFromMealPlan,
  useRefineMealPlan,
  useSwapMeal,
} from '../../hooks/useMealPlan'
import { useGeolocation } from '../../hooks/useGeolocation'
import { Wrapper, TopBar, Title, EmptyState, BackRow, ActionsRow } from './MealprepView.styles'
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

  const [selectedEntryId, setSelectedEntryId] = useState<string | null>(null)
  const [showPrepPlan, setShowPrepPlan] = useState(false)
  const [previewItems, setPreviewItems] = useState<ReturnType<typeof useConsolidateMealPlan>['data']>(undefined)
  const [deleteConfirm, setDeleteConfirm] = useState(false)

  const mealPlanQuery = useCurrentMealPlan()
  const generateMealPlan = useGenerateMealPlan()
  const deleteMealPlan = useDeleteMealPlan()
  const consolidate = useConsolidateMealPlan()
  const createShoppingList = useCreateShoppingListFromMealPlan()
  const refineMealPlan = useRefineMealPlan()
  const swapMeal = useSwapMeal()
  const { coords, requestLocation } = useGeolocation()

  // Fire-and-forget, same as ChatView/MealPlanGenerator — best-effort geo
  // context for a later refine request (see geoContext.ts), silently
  // skipped if denied.
  useEffect(() => {
    requestLocation()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

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

  const handleSendToShoppingList = (payload: { recipeTitle: string; ingredients: RecipeIngredient[] }): void => {
    sendRecipeToShoppingList.mutate(payload, { onSuccess: (listId) => onSentToList(listId) })
  }

  const mealPlan = mealPlanQuery.data
  const selectedEntry = mealPlan?.days.find((d) => d.id === selectedEntryId) ?? null
  const titleToImage: Record<string, string> = Object.fromEntries(
    (mealPlan?.days ?? []).filter((d) => d.image).map((d) => [d.title, d.image]),
  )

  // Sub-state: viewing one meal's recipe in full detail — same in-tab
  // drill-down exception ChatView/RecipesView already use. No fetch needed:
  // the AI-generated content already lives on the entry itself.
  if (selectedEntry) {
    return (
      <Wrapper>
        <BackRow>
          <Button startIcon={<MdArrowBack size={18} />} onClick={() => setSelectedEntryId(null)} size="small">
            {t('mealprep.backToCalendar')}
          </Button>
        </BackRow>

        <MealprepRecipeDetail
          entry={selectedEntry}
          initialServings={mealPlan?.servings ?? 2}
          onSendToShoppingList={handleSendToShoppingList}
          isSending={sendRecipeToShoppingList.isPending}
          isSwapping={swapMeal.isPending}
          onSwap={(reason) =>
            swapMeal.mutate({
              id: mealPlan!.id,
              dayOfWeek: selectedEntry.dayOfWeek,
              mealType: selectedEntry.mealType,
              reason: reason || undefined,
              location: coords ?? undefined,
            })
          }
        />
      </Wrapper>
    )
  }

  // Sub-state: viewing the week's single-day batch prep plan.
  if (showPrepPlan && mealPlan?.batchPrepPlan) {
    return (
      <Wrapper>
        <BackRow>
          <Button startIcon={<MdArrowBack size={18} />} onClick={() => setShowPrepPlan(false)} size="small">
            {t('mealprep.backToCalendar')}
          </Button>
        </BackRow>
        <BatchPrepPlanView plan={mealPlan.batchPrepPlan} titleToImage={titleToImage} />
      </Wrapper>
    )
  }

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
          <WeeklyCalendar mealPlan={mealPlan} onSelectEntry={setSelectedEntryId} />
          <ActionsRow>
            {mealPlan.batchPrepPlan && (
              <Button
                variant="outlined"
                startIcon={<MdOutlineSoupKitchen size={18} />}
                onClick={() => setShowPrepPlan(true)}
              >
                {t('mealprep.batchPrepPlan.viewButton')}
              </Button>
            )}
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
          <RefinePlanInput
            disabled={refineMealPlan.isPending}
            onSend={(message) =>
              refineMealPlan.mutate({ id: mealPlan.id, message, location: coords ?? undefined })
            }
          />
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
    </Wrapper>
  )
}
