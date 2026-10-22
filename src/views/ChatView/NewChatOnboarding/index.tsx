import { useState } from 'react'
import Button from '@mui/material/Button'
import TextField from '@mui/material/TextField'
import Chip from '@mui/material/Chip'
import CircularProgress from '@mui/material/CircularProgress'
import { MdArrowBack } from 'react-icons/md'
import { useTranslation } from 'react-i18next'
import DietaryChipPicker from '../DietaryChipPicker'
import ServingsStepper from '../../RecipesView/ServingsStepper'
import { usePantryChatSuggestions } from '../../../hooks/useChat'
import {
  OnboardingWrapper,
  OnboardingTitle,
  FieldLabel,
  ServingsRow,
  GoalOptionsList,
  GoalOptionButton,
  GoalOptionLabel,
  GoalOptionHint,
  BackRow,
  ChipsRow,
} from './NewChatOnboarding.styles'

export interface NewChatOnboardingProps {
  onStart: (payload: { dietaryRestrictions: string[]; servings: number; initialQuery: string }) => void
  onGoToMealprep: () => void
  isPending?: boolean
}

const DEFAULT_SERVINGS = 2

type Step = 'goal' | 'details'

// Entering the Chat tab used to drop straight into a single free-text form
// before any conversation started. Now it opens on a goal choice instead —
// fewer users need the full Q&A loop for a "just give me something" request,
// and "plan the week" routes to the Mealprep tab entirely rather than living
// inside this flow.
export default function NewChatOnboarding({ onStart, onGoToMealprep, isPending = false }: NewChatOnboardingProps) {
  const { t } = useTranslation()
  const [step, setStep] = useState<Step>('goal')
  const [dietaryRestrictions, setDietaryRestrictions] = useState<string[]>([])
  const [servings, setServings] = useState(DEFAULT_SERVINGS)
  const [initialQuery, setInitialQuery] = useState('')

  // Shared across both the goal step (PantrySuggestions, rendered by
  // ChatView) and this step's own preset chips — same query key, so this
  // second call reuses the cache instead of firing a duplicate request.
  const pantrySuggestions = usePantryChatSuggestions()

  const handleStart = (query: string): void => {
    onStart({ dietaryRestrictions, servings, initialQuery: query.trim() })
  }

  if (step === 'goal') {
    return (
      <OnboardingWrapper>
        <OnboardingTitle>{t('chat.onboardingGoal.title')}</OnboardingTitle>
        <GoalOptionsList>
          <GoalOptionButton type="button" onClick={() => setStep('details')}>
            <GoalOptionLabel>{t('chat.onboardingGoal.quick')}</GoalOptionLabel>
            <GoalOptionHint>{t('chat.onboardingGoal.quickHint')}</GoalOptionHint>
          </GoalOptionButton>
          <GoalOptionButton type="button" onClick={onGoToMealprep}>
            <GoalOptionLabel>{t('chat.onboardingGoal.weekly')}</GoalOptionLabel>
            <GoalOptionHint>{t('chat.onboardingGoal.weeklyHint')}</GoalOptionHint>
          </GoalOptionButton>
          <GoalOptionButton type="button" onClick={() => setStep('details')}>
            <GoalOptionLabel>{t('chat.onboardingGoal.specific')}</GoalOptionLabel>
            <GoalOptionHint>{t('chat.onboardingGoal.specificHint')}</GoalOptionHint>
          </GoalOptionButton>
        </GoalOptionsList>
      </OnboardingWrapper>
    )
  }

  return (
    <OnboardingWrapper>
      <BackRow>
        <Button size="small" startIcon={<MdArrowBack size={16} />} onClick={() => setStep('goal')}>
          {t('chat.backToGoals')}
        </Button>
      </BackRow>

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

      {pantrySuggestions.data && pantrySuggestions.data.length > 0 && (
        <div>
          <FieldLabel>{t('chat.quickPresets.heading')}</FieldLabel>
          <ChipsRow>
            {pantrySuggestions.data.map((recipe) => (
              <Chip
                key={recipe.id}
                label={recipe.title}
                clickable
                variant="outlined"
                color="primary"
                onClick={() => handleStart(recipe.title)}
              />
            ))}
          </ChipsRow>
        </div>
      )}

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
        onClick={() => handleStart(initialQuery)}
      >
        {t('chat.onboardingStart')}
      </Button>
    </OnboardingWrapper>
  )
}
