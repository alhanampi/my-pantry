import { useMemo, useState } from 'react'
import IconButton from '@mui/material/IconButton'
import Typography from '@mui/material/Typography'
import { MdDeleteOutline, MdOutlineCalendarMonth, MdRestore } from 'react-icons/md'
import { useTranslation } from 'react-i18next'
import ConfirmActionDialog from '../../components/ConfirmActionDialog'
import { useFavoriteMealPlans, useRemoveFavoriteMealPlan, useRestoreFavoriteMealPlan } from '../../hooks/useFavoriteMealPlans'
import { useCurrentMealPlan } from '../../hooks/useMealPlan'
import {
  EmptyHint,
  PlanRow,
  PlanIconWrap,
  PlanTextWrap,
  PlanName,
  PlanActionsRow,
} from './FavoriteMealPlansSection.styles'
import type { FavoriteMealPlan } from '../../utils/types'

export interface FavoriteMealPlansSectionProps {
  onRestored?: () => void
}

// No image is possible for a saved week (it's several recipes, not one
// resource with a photo) — fixed calendar icon, same reasoning as
// FavoriteShoppingListsSection's cart icon.
export default function FavoriteMealPlansSection({ onRestored }: FavoriteMealPlansSectionProps) {
  const { t } = useTranslation()
  const { data: plans = [] } = useFavoriteMealPlans()
  const currentMealPlan = useCurrentMealPlan()
  const removeFavorite = useRemoveFavoriteMealPlan()
  const restoreFavorite = useRestoreFavoriteMealPlan()
  const [replaceConfirm, setReplaceConfirm] = useState<FavoriteMealPlan | null>(null)

  const restore = (plan: FavoriteMealPlan): void => {
    restoreFavorite.mutate(plan.id, { onSuccess: () => onRestored?.() })
  }

  const handleRestoreClick = (plan: FavoriteMealPlan): void => {
    if (currentMealPlan.data) {
      setReplaceConfirm(plan)
    } else {
      restore(plan)
    }
  }

  if (plans.length === 0) {
    return <EmptyHint>{t('favorites.mealplansEmpty')}</EmptyHint>
  }

  return (
    <div>
      {plans.map((plan) => {
        const daysCount = new Set(plan.days.map((d) => d.dayOfWeek)).size
        return (
          <PlanRow key={plan.id}>
            <PlanIconWrap>
              <MdOutlineCalendarMonth size={20} />
            </PlanIconWrap>
            <PlanTextWrap>
              <PlanName>{plan.name}</PlanName>
              <Typography variant="caption" color="text.secondary">
                {t('favorites.mealplanDays', { count: daysCount })}
                {' · '}
                {t('favorites.mealplanServings', { count: plan.servings })}
              </Typography>
            </PlanTextWrap>
            <PlanActionsRow>
              <IconButton
                size="small"
                aria-label={t('favorites.restorePlan')}
                disabled={restoreFavorite.isPending}
                onClick={() => handleRestoreClick(plan)}
              >
                <MdRestore size={18} color="var(--scheme-primary)" />
              </IconButton>
              <IconButton
                size="small"
                aria-label={t('favorites.deleteFavoritePlan')}
                onClick={() => removeFavorite.mutate(plan.id)}
              >
                <MdDeleteOutline size={18} />
              </IconButton>
            </PlanActionsRow>
          </PlanRow>
        )
      })}

      <ConfirmActionDialog
        open={replaceConfirm !== null}
        title={t('favorites.restoreReplaceConfirmTitle')}
        body={t('favorites.restoreReplaceConfirmBody')}
        confirmLabel={t('favorites.restorePlan')}
        onConfirm={() => {
          if (replaceConfirm) restore(replaceConfirm)
          setReplaceConfirm(null)
        }}
        onCancel={() => setReplaceConfirm(null)}
      />
    </div>
  )
}
