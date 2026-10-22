import { useTranslation } from 'react-i18next'
import type { MealPlan } from '../../../utils/types'
import { Grid, DayCard, DayImage, DayLabel, DayTitle } from './WeeklyCalendar.styles'

export interface WeeklyCalendarProps {
  mealPlan: MealPlan
  onSelectRecipe: (recipeId: string) => void
}

// Each cell is a lightweight bookmark (MealPlanEntry), not a full RecipeCard
// — title/image only, enough to render the grid without a Spoonacular
// lookup per day. Tapping drills into the full recipe detail, same in-tab
// sub-state pattern ChatView uses for its own suggestion cards.
export default function WeeklyCalendar({ mealPlan, onSelectRecipe }: WeeklyCalendarProps) {
  const { i18n } = useTranslation()

  return (
    <Grid>
      {mealPlan.days.map((entry) => {
        const date = new Date(mealPlan.weekStart)
        date.setDate(date.getDate() + entry.dayOfWeek)
        const dayLabel = date.toLocaleDateString(i18n.language, { weekday: 'short', day: 'numeric' })

        return (
          <DayCard key={entry.id} type="button" onClick={() => onSelectRecipe(entry.recipeId)}>
            <DayImage $src={entry.image} />
            <DayLabel>{dayLabel}</DayLabel>
            <DayTitle>{entry.title}</DayTitle>
          </DayCard>
        )
      })}
    </Grid>
  )
}
