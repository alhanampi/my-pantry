import { useEffect, useState } from 'react'
import Button from '@mui/material/Button'
import CircularProgress from '@mui/material/CircularProgress'
import Chip from '@mui/material/Chip'
import Switch from '@mui/material/Switch'
import FormControlLabel from '@mui/material/FormControlLabel'
import TextField from '@mui/material/TextField'
import { MdAutoAwesome } from 'react-icons/md'
import { useTranslation } from 'react-i18next'
import DietaryChipPicker from '../../ChatView/DietaryChipPicker'
import ServingsStepper from '../../RecipesView/ServingsStepper'
import IngredientPicker from '../../../components/IngredientPicker'
import QuantityStepper from '../../../components/QuantityStepper'
import { usePantry } from '../../../hooks/usePantry'
import { useGeolocation } from '../../../hooks/useGeolocation'
import { Wrapper, FieldLabel, ServingsRow, ChipsRow } from './MealPlanGenerator.styles'
import type { GenerateMealPlanPayload } from '../../../api/mealPlanApi'

export interface MealPlanGeneratorProps {
  onGenerate: (payload: GenerateMealPlanPayload) => void
  isPending?: boolean
}

const DEFAULT_SERVINGS = 2
const DEFAULT_DAYS_COUNT = 7
const MIN_DAYS_COUNT = 1
const MAX_DAYS_COUNT = 7
// Includes longer sessions (2h/3h) on top of per-meal cook times — cooking
// for a whole week plausibly means one long batch-cooking block, not just
// 90 minutes max per single dish.
const TIME_OPTIONS = [15, 30, 45, 60, 90, 120, 180] as const

function todayIsoDate(): string {
  const d = new Date()
  const yyyy = d.getFullYear()
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  const dd = String(d.getDate()).padStart(2, '0')
  return `${yyyy}-${mm}-${dd}`
}

export default function MealPlanGenerator({ onGenerate, isPending = false }: MealPlanGeneratorProps) {
  const { t } = useTranslation()
  const [dietaryRestrictions, setDietaryRestrictions] = useState<string[]>([])
  const [servings, setServings] = useState(DEFAULT_SERVINGS)
  const [includeBreakfast, setIncludeBreakfast] = useState(false)
  const [timeAvailableMinutes, setTimeAvailableMinutes] = useState<number | null>(null)
  const [ingredientsOnHand, setIngredientsOnHand] = useState<string[]>([])
  const [weekStart, setWeekStart] = useState(todayIsoDate)
  const [daysCount, setDaysCount] = useState(DEFAULT_DAYS_COUNT)

  const { products } = usePantry()
  const { coords, requestLocation } = useGeolocation()

  // Fire-and-forget, same as ChatView — best-effort geo context for the
  // generation prompt (see geoContext.ts), silently skipped if denied.
  useEffect(() => {
    requestLocation()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const pantryItemNames = products.map((p) => p.name)

  const handleGenerate = (): void => {
    onGenerate({
      dietaryRestrictions,
      servings,
      includeBreakfast,
      timeAvailableMinutes: timeAvailableMinutes ?? undefined,
      ingredientsOnHand,
      weekStart: weekStart || undefined,
      daysCount,
      location: coords ?? undefined,
    })
  }

  return (
    <Wrapper>
      <div>
        <FieldLabel>{t('mealprep.generator.weekStart')}</FieldLabel>
        <TextField
          type="date"
          size="small"
          InputLabelProps={{ shrink: true }}
          inputProps={{ min: todayIsoDate(), 'aria-label': t('mealprep.generator.weekStart') }}
          value={weekStart}
          onChange={(e) => setWeekStart(e.target.value)}
        />
      </div>

      <div>
        <FieldLabel>{t('mealprep.generator.daysCount')}</FieldLabel>
        <ServingsRow>
          <QuantityStepper
            value={String(daysCount)}
            onIncrement={() => setDaysCount((d) => Math.min(MAX_DAYS_COUNT, d + 1))}
            onDecrement={() => setDaysCount((d) => Math.max(MIN_DAYS_COUNT, d - 1))}
          />
        </ServingsRow>
      </div>

      <div>
        <FieldLabel>{t('chat.onboardingDietary')}</FieldLabel>
        <DietaryChipPicker selected={dietaryRestrictions} onChange={setDietaryRestrictions} allowCustom={false} />
      </div>

      <div>
        <FieldLabel>{t('chat.onboardingServings')}</FieldLabel>
        <ServingsRow>
          <ServingsStepper servings={servings} onChange={setServings} />
        </ServingsRow>
      </div>

      <div>
        <FieldLabel>{t('mealprep.generator.timeAvailable')}</FieldLabel>
        <ChipsRow role="group" aria-label={t('mealprep.generator.timeAvailable')}>
          {TIME_OPTIONS.map((minutes) => (
            <Chip
              key={minutes}
              size="small"
              clickable
              color={timeAvailableMinutes === minutes ? 'primary' : 'default'}
              variant={timeAvailableMinutes === minutes ? 'filled' : 'outlined'}
              label={
                minutes >= 60 && minutes % 60 === 0
                  ? t('mealprep.generator.timeHours', { count: minutes / 60 })
                  : t('mealprep.generator.timeMinutes', { count: minutes })
              }
              onClick={() => setTimeAvailableMinutes((prev) => (prev === minutes ? null : minutes))}
            />
          ))}
        </ChipsRow>
      </div>

      <div>
        <FieldLabel>{t('mealprep.generator.ingredientsOnHand')}</FieldLabel>
        <IngredientPicker
          selected={ingredientsOnHand}
          onChange={setIngredientsOnHand}
          pantryItemNames={pantryItemNames}
        />
      </div>

      <FormControlLabel
        control={<Switch checked={includeBreakfast} onChange={(e) => setIncludeBreakfast(e.target.checked)} />}
        label={t('mealprep.generator.includeBreakfast')}
      />

      <Button
        variant="contained"
        disableElevation
        disabled={isPending}
        startIcon={isPending ? <CircularProgress size={16} color="inherit" /> : <MdAutoAwesome size={18} />}
        onClick={handleGenerate}
      >
        {isPending ? t('mealprep.generating') : t('mealprep.generate')}
      </Button>
    </Wrapper>
  )
}
