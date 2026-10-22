import { useState } from 'react'
import Button from '@mui/material/Button'
import CircularProgress from '@mui/material/CircularProgress'
import { MdAutoAwesome } from 'react-icons/md'
import { useTranslation } from 'react-i18next'
import DietaryChipPicker from '../../ChatView/DietaryChipPicker'
import ServingsStepper from '../../RecipesView/ServingsStepper'
import { Wrapper, FieldLabel, ServingsRow } from './MealPlanGenerator.styles'

export interface MealPlanGeneratorProps {
  onGenerate: (payload: { dietaryRestrictions: string[]; servings: number }) => void
  isPending?: boolean
}

const DEFAULT_SERVINGS = 2

export default function MealPlanGenerator({ onGenerate, isPending = false }: MealPlanGeneratorProps) {
  const { t } = useTranslation()
  const [dietaryRestrictions, setDietaryRestrictions] = useState<string[]>([])
  const [servings, setServings] = useState(DEFAULT_SERVINGS)

  return (
    <Wrapper>
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

      <Button
        variant="contained"
        disableElevation
        disabled={isPending}
        startIcon={isPending ? <CircularProgress size={16} color="inherit" /> : <MdAutoAwesome size={18} />}
        onClick={() => onGenerate({ dietaryRestrictions, servings })}
      >
        {isPending ? t('mealprep.generating') : t('mealprep.generate')}
      </Button>
    </Wrapper>
  )
}
