import { useMemo, useState } from 'react'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import CircularProgress from '@mui/material/CircularProgress'
import Typography from '@mui/material/Typography'
import Dialog from '@mui/material/Dialog'
import DialogTitle from '@mui/material/DialogTitle'
import DialogContent from '@mui/material/DialogContent'
import DialogActions from '@mui/material/DialogActions'
import TextField from '@mui/material/TextField'
import {
  MdOutlineShoppingCartCheckout,
  MdOutlineFreeBreakfast,
  MdOutlineLunchDining,
  MdOutlineDinnerDining,
  MdOutlineSwapHoriz,
} from 'react-icons/md'
import { useTranslation } from 'react-i18next'
import ServingsStepper from '../../RecipesView/ServingsStepper'
import {
  DetailWrapper,
  HeroImage,
  HeroPlaceholder,
  Title,
  Description,
  ServingsRow,
  SectionTitle,
  IngredientsList,
  InstructionList,
  InstructionStep,
  StepNumber,
  InstructionText,
  NotesBox,
} from './MealprepRecipeDetail.styles'
import type { MealPlanEntry, MealIngredient, RecipeIngredient } from '../../../utils/types'

const MEAL_TYPE_ICON = {
  breakfast: MdOutlineFreeBreakfast,
  lunch: MdOutlineLunchDining,
  dinner: MdOutlineDinnerDining,
}

function round2(n: number): number {
  return Math.round(n * 100) / 100
}

// Adapts the AI's flat {name,amount,unit} ingredients onto RecipeIngredient
// just enough for sendRecipeToShoppingList (usePantry.ts), which only ever
// reads name/amount/unit off it — the metric/us dual-measure fields it also
// requires don't apply here (a single AI-generated unit, not Spoonacular's
// per-ingredient dual measures), so both sides are filled with the same
// value.
function toRecipeIngredients(ingredients: MealIngredient[]): RecipeIngredient[] {
  return ingredients.map((ing, i) => ({
    id: i,
    name: ing.name,
    amount: ing.amount,
    unit: ing.unit,
    original: `${ing.amount} ${ing.unit} ${ing.name}`.trim(),
    measures: {
      metric: { amount: ing.amount, unit: ing.unit },
      us: { amount: ing.amount, unit: ing.unit },
    },
  }))
}

export interface MealprepRecipeDetailProps {
  entry: MealPlanEntry
  initialServings: number
  onSendToShoppingList: (payload: { recipeTitle: string; ingredients: RecipeIngredient[] }) => void
  isSending?: boolean
  onSwap: (reason: string) => void
  isSwapping?: boolean
}

// Unlike RecipesView's RecipeDetailPanel, there's no external recipeId to
// re-fetch or favorite here — the AI already generated everything, so this
// just renders what's on the MealPlanEntry, with a live client-side
// servings scale (same ratio approach as RecipeDetailPanel).
export default function MealprepRecipeDetail({
  entry,
  initialServings,
  onSendToShoppingList,
  isSending = false,
  onSwap,
  isSwapping = false,
}: MealprepRecipeDetailProps) {
  const { t } = useTranslation()
  const [servings, setServings] = useState(initialServings)
  const [swapDialogOpen, setSwapDialogOpen] = useState(false)
  const [swapReason, setSwapReason] = useState('')
  const ratio = servings / initialServings
  const Icon = MEAL_TYPE_ICON[entry.mealType]

  const handleConfirmSwap = (): void => {
    onSwap(swapReason.trim())
    setSwapDialogOpen(false)
    setSwapReason('')
  }

  const scaledIngredients = useMemo<MealIngredient[]>(
    () => entry.ingredients.map((ing) => ({ ...ing, amount: round2(ing.amount * ratio) })),
    [entry.ingredients, ratio],
  )

  return (
    <DetailWrapper>
      {entry.image ? (
        <HeroImage src={entry.image} alt={entry.title} />
      ) : (
        <HeroPlaceholder>
          <Icon size={40} color="var(--scheme-accent-medium)" />
        </HeroPlaceholder>
      )}

      <Title>{entry.title}</Title>
      {entry.description && <Description>{entry.description}</Description>}

      <ServingsRow>
        <span>{t('recipes.servings')}</span>
        <ServingsStepper servings={servings} onChange={setServings} />
      </ServingsRow>

      <div>
        <SectionTitle>{t('recipes.ingredients')}</SectionTitle>
        <IngredientsList>
          {scaledIngredients.map((ing, i) => (
            <li key={i}>
              {ing.amount} {ing.unit} {ing.name}
            </li>
          ))}
        </IngredientsList>
      </div>

      <div>
        <SectionTitle>{t('recipes.instructions')}</SectionTitle>
        <InstructionList>
          {entry.steps.map((step, i) => (
            <InstructionStep key={i}>
              <StepNumber>{i + 1}</StepNumber>
              <InstructionText>{step}</InstructionText>
            </InstructionStep>
          ))}
        </InstructionList>
      </div>

      {entry.notes && (
        <NotesBox>
          <SectionTitle>{t('mealprep.notes')}</SectionTitle>
          <Typography variant="body2" color="text.secondary">
            {entry.notes}
          </Typography>
        </NotesBox>
      )}

      <Box sx={{ display: 'flex', gap: 1.5, flexWrap: 'wrap' }}>
        <Button
          variant="contained"
          disableElevation
          startIcon={isSending ? <CircularProgress size={16} color="inherit" /> : <MdOutlineShoppingCartCheckout size={18} />}
          disabled={isSending}
          onClick={() =>
            onSendToShoppingList({ recipeTitle: entry.title, ingredients: toRecipeIngredients(scaledIngredients) })
          }
        >
          {t('recipes.sendToList')}
        </Button>
        <Button
          variant="outlined"
          startIcon={isSwapping ? <CircularProgress size={16} color="inherit" /> : <MdOutlineSwapHoriz size={18} />}
          disabled={isSwapping}
          onClick={() => setSwapDialogOpen(true)}
        >
          {t('mealprep.swap.button')}
        </Button>
      </Box>

      <Dialog open={swapDialogOpen} onClose={() => setSwapDialogOpen(false)} maxWidth="xs" fullWidth>
        <DialogTitle>{t('mealprep.swap.dialogTitle')}</DialogTitle>
        <DialogContent>
          <TextField
            autoFocus
            fullWidth
            size="small"
            placeholder={t('mealprep.swap.reasonPlaceholder')}
            value={swapReason}
            onChange={(e) => setSwapReason(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault()
                handleConfirmSwap()
              }
            }}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setSwapDialogOpen(false)}>{t('modal.cancel')}</Button>
          <Button variant="contained" disableElevation onClick={handleConfirmSwap}>
            {t('mealprep.swap.confirm')}
          </Button>
        </DialogActions>
      </Dialog>
    </DetailWrapper>
  )
}
