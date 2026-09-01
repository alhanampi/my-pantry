import { useState } from 'react'
import Button from '@mui/material/Button'
import TextField from '@mui/material/TextField'
import CircularProgress from '@mui/material/CircularProgress'
import { useTranslation } from 'react-i18next'
import DietaryChipPicker from '../DietaryChipPicker'
import ServingsStepper from '../../RecipesView/ServingsStepper'
import { OnboardingWrapper, OnboardingTitle, FieldLabel, ServingsRow } from './NewChatOnboarding.styles'

export interface NewChatOnboardingProps {
  onStart: (payload: { dietaryRestrictions: string[]; servings: number; initialQuery: string }) => void
  isPending?: boolean
}

const DEFAULT_SERVINGS = 2

export default function NewChatOnboarding({ onStart, isPending = false }: NewChatOnboardingProps) {
  const { t } = useTranslation()
  const [dietaryRestrictions, setDietaryRestrictions] = useState<string[]>([])
  const [servings, setServings] = useState(DEFAULT_SERVINGS)
  const [initialQuery, setInitialQuery] = useState('')

  return (
    <OnboardingWrapper>
      <OnboardingTitle>{t('chat.onboardingTitle')}</OnboardingTitle>

      <div>
        <FieldLabel>{t('chat.onboardingDietary')}</FieldLabel>
        <DietaryChipPicker selected={dietaryRestrictions} onChange={setDietaryRestrictions} allowCustom={false} />
      </div>

      <div>
        <FieldLabel>{t('chat.onboardingQuery')}</FieldLabel>
        <TextField
          fullWidth
          placeholder={t('chat.onboardingQueryPlaceholder')}
          value={initialQuery}
          onChange={(e) => setInitialQuery(e.target.value)}
        />
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
        startIcon={isPending ? <CircularProgress size={16} color="inherit" /> : undefined}
        onClick={() => onStart({ dietaryRestrictions, servings, initialQuery: initialQuery.trim() })}
      >
        {t('chat.onboardingStart')}
      </Button>
    </OnboardingWrapper>
  )
}
