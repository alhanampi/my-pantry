import { MdOutlineFreeBreakfast, MdOutlineLunchDining, MdOutlineDinnerDining } from 'react-icons/md'
import { useTranslation } from 'react-i18next'
import type { MealPlan, MealPlanEntry, MealType } from '../../../utils/types'
import {
  Grid,
  DayRow,
  DayLabel,
  MealsRow,
  MealCard,
  MealImage,
  MealImagePlaceholder,
  MealTypeTag,
  MealTitle,
  MealTime,
} from './WeeklyCalendar.styles'

export interface WeeklyCalendarProps {
  mealPlan: MealPlan
  onSelectEntry: (entryId: string) => void
}

const MEAL_TYPE_ORDER: MealType[] = ['breakfast', 'lunch', 'dinner']

const MEAL_TYPE_ICON: Record<MealType, typeof MdOutlineFreeBreakfast> = {
  breakfast: MdOutlineFreeBreakfast,
  lunch: MdOutlineLunchDining,
  dinner: MdOutlineDinnerDining,
}

// Each day is one ROW (date label on the left, meal cards side by side in
// that same row) rather than a column — makes it visually obvious that
// lunch and dinner on the same row belong to the same day, instead of
// reading as separate, unrelated cards. The AI-generated entries carry
// their own content, so tapping one just opens it directly (see
// MealprepView's selectedEntryId), no per-day fetch needed. Falls back to
// a meal-type icon when a card has no resolved photo (mealPlanAi.ts's
// image lookup is best-effort).
export default function WeeklyCalendar({ mealPlan, onSelectEntry }: WeeklyCalendarProps) {
  const { t, i18n } = useTranslation()

  const dayNumbers = Array.from(new Set(mealPlan.days.map((d) => d.dayOfWeek))).sort((a, b) => a - b)
  const entriesByDay = new Map<number, MealPlanEntry[]>()
  for (const entry of mealPlan.days) {
    const list = entriesByDay.get(entry.dayOfWeek) ?? []
    list.push(entry)
    entriesByDay.set(entry.dayOfWeek, list)
  }

  return (
    <Grid>
      {dayNumbers.map((dayOfWeek) => {
        const date = new Date(mealPlan.weekStart)
        date.setDate(date.getDate() + dayOfWeek)
        const dayLabel = date.toLocaleDateString(i18n.language, { weekday: 'short', day: 'numeric' })
        const entries = entriesByDay.get(dayOfWeek) ?? []
        const byType = new Map(entries.map((e) => [e.mealType, e]))

        return (
          <DayRow key={dayOfWeek}>
            <DayLabel>{dayLabel}</DayLabel>
            <MealsRow>
              {MEAL_TYPE_ORDER.map((mealType) => {
                const entry = byType.get(mealType)
                if (!entry) return null
                const Icon = MEAL_TYPE_ICON[mealType]

                return (
                  <MealCard key={entry.id} type="button" onClick={() => onSelectEntry(entry.id)}>
                    {entry.image ? (
                      <MealImage $src={entry.image} />
                    ) : (
                      <MealImagePlaceholder>
                        <Icon size={24} color="var(--scheme-accent-medium)" />
                      </MealImagePlaceholder>
                    )}
                    <MealTypeTag>{t(`mealprep.mealType.${mealType}`)}</MealTypeTag>
                    <MealTitle>{entry.title}</MealTitle>
                    <MealTime>{t('mealprep.totalTimeMinutes', { count: entry.totalTimeMinutes })}</MealTime>
                  </MealCard>
                )
              })}
            </MealsRow>
          </DayRow>
        )
      })}
    </Grid>
  )
}
