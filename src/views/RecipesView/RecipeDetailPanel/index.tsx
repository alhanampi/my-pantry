import { useMemo, useState } from 'react'
import Button from '@mui/material/Button'
import CircularProgress from '@mui/material/CircularProgress'
import Typography from '@mui/material/Typography'
import { MdOutlineShoppingCartCheckout, MdFavorite, MdFavoriteBorder } from 'react-icons/md'
import { useTranslation } from 'react-i18next'
import ServingsStepper from '../ServingsStepper'
import UnitSystemToggle from '../../../components/UnitSystemToggle'
import { useUnitSystem } from '../../../hooks/useUnitSystem'
import { translateUnit } from '../../../utils/unitTranslations'
import {
  DetailWrapper,
  HeroImageWrapper,
  HeroImage,
  HeroFavoriteButton,
  Title,
  ServingsRow,
  NutritionBarList,
  NutritionBarRow,
  NutritionBarLabel,
  NutritionBarTrack,
  NutritionBarFill,
  NutritionBarValue,
  IngredientsList,
  InstructionList,
  InstructionStep,
  StepNumber,
  InstructionText,
} from './RecipeDetailPanel.styles'
import { SectionTitle } from '../RecipesView.styles'
import type { RecipeDetail, RecipeIngredient } from '../../../utils/types'

// Fixed per-nutrient legend colors — deliberately not theme-driven, same
// reasoning as HeroFavoriteButton's hardcoded red: a nutrient-color legend
// needs to stay recognizable regardless of which of the 6 color schemes is
// active.
const NUTRIENT_COLORS = {
  calories: '#f59e0b',
  protein: '#f97316',
  carbs: '#3b82f6',
  fat: '#ef4444',
} as const

export interface RecipeDetailPanelProps {
  recipe: RecipeDetail
  onSendToShoppingList: (payload: { recipeTitle: string; ingredients: RecipeIngredient[] }) => void
  isSending?: boolean
  isFavorite?: boolean
  onToggleFavorite?: (id: number) => void
  // True while this recipe's favorite toggle is in flight — see RecipeCard's
  // identical prop for why (spinner + click-guard during a slow API call).
  isTogglingFavorite?: boolean
  // Overrides the initial servings shown/scaled from — used by Chat to
  // default to the conversation's own servings preference instead of
  // whatever Spoonacular's recipe.servings happens to be.
  initialServings?: number
}

function round2(n: number): number {
  return Math.round(n * 100) / 100
}

// Defensive against a *Percent field being missing/non-numeric — e.g. a
// recipe detail cached (React Query, in-browser) from before these fields
// existed on the API response. Never let a stale/malformed value render as
// "NaN%"; fall back to 0 instead.
function scaledPercent(value: number, ratio: number): number {
  const scaled = Math.round(value * ratio)
  return Number.isFinite(scaled) ? Math.min(100, scaled) : 0
}

export default function RecipeDetailPanel({
  recipe,
  onSendToShoppingList,
  isSending = false,
  isFavorite = false,
  onToggleFavorite,
  isTogglingFavorite = false,
  initialServings,
}: RecipeDetailPanelProps) {
  const { t, i18n } = useTranslation()
  const { unitSystem } = useUnitSystem()
  const [servings, setServings] = useState(initialServings ?? recipe.servings)

  const ratio = servings / recipe.servings

  // Scaling — the single spot both the rendered ingredient amounts and the
  // "send to shopping list" payload read from, so they can never drift
  // apart. Reads amount/unit from whichever measure set (metric/us) is
  // currently selected instead of the flat amount/unit — see
  // RecipeIngredient's measures field (backend/recipeSerializers.ts).
  const scaledIngredients = useMemo<RecipeIngredient[]>(
    () =>
      recipe.ingredients.map((ing) => {
        const measure = unitSystem === 'metric' ? ing.measures.metric : ing.measures.us
        return {
          ...ing,
          amount: round2(measure.amount * ratio),
          unit: translateUnit(measure.unit, i18n.language),
        }
      }),
    [recipe.ingredients, ratio, unitSystem, i18n.language],
  )

  const scaledNutrition = useMemo(
    () => ({
      calories: round2(recipe.nutrition.calories * ratio),
      protein: round2(recipe.nutrition.protein * ratio),
      carbs: round2(recipe.nutrition.carbs * ratio),
      fat: round2(recipe.nutrition.fat * ratio),
      // % of daily needs scales the same way as the raw amounts, capped at
      // 100 — a recipe already at/above 100% of some nutrient's daily need
      // just stays full, it doesn't overflow the bar.
      caloriesPercent: scaledPercent(recipe.nutrition.caloriesPercent, ratio),
      proteinPercent: scaledPercent(recipe.nutrition.proteinPercent, ratio),
      carbsPercent: scaledPercent(recipe.nutrition.carbsPercent, ratio),
      fatPercent: scaledPercent(recipe.nutrition.fatPercent, ratio),
    }),
    [recipe.nutrition, ratio],
  )

  return (
    <DetailWrapper>
      <HeroImageWrapper>
        <HeroImage src={recipe.image} alt={recipe.title} />
        {onToggleFavorite && (
          <HeroFavoriteButton
            type="button"
            $active={isFavorite}
            aria-pressed={isFavorite}
            aria-label={t(isFavorite ? 'recipes.removeFavorite' : 'recipes.addFavorite')}
            disabled={isTogglingFavorite}
            onClick={() => onToggleFavorite(recipe.id)}
          >
            {isTogglingFavorite ? (
              <CircularProgress size={18} color="inherit" />
            ) : isFavorite ? (
              <MdFavorite size={22} />
            ) : (
              <MdFavoriteBorder size={22} />
            )}
          </HeroFavoriteButton>
        )}
      </HeroImageWrapper>
      <Title>{recipe.title}</Title>

      <ServingsRow>
        <span>{t('recipes.servings')}</span>
        <ServingsStepper servings={servings} onChange={setServings} />
      </ServingsRow>

      <div>
        <ServingsRow>
          <SectionTitle>{t('recipes.ingredients')}</SectionTitle>
          <UnitSystemToggle variant="plain" />
        </ServingsRow>
        <IngredientsList>
          {scaledIngredients.map((ing) => (
            <li key={ing.id}>
              {ing.amount} {ing.unit} {ing.name}
            </li>
          ))}
        </IngredientsList>
      </div>

      <div>
        <SectionTitle>{t('recipes.instructions')}</SectionTitle>
        {recipe.instructions.length === 0 ? (
          <Typography variant="body2" color="text.secondary">
            {t('recipes.noInstructions')}
          </Typography>
        ) : (
          <InstructionList>
            {recipe.instructions.map((step, i) => (
              <InstructionStep key={i}>
                <StepNumber>{i + 1}</StepNumber>
                <InstructionText>{step}</InstructionText>
              </InstructionStep>
            ))}
          </InstructionList>
        )}
      </div>

      <NutritionBarList>
        <NutritionBarRow>
          <NutritionBarLabel>
            {t('recipes.calories')} ({scaledNutrition.calories} {t('recipes.kcal')})
          </NutritionBarLabel>
          <NutritionBarTrack>
            <NutritionBarFill $pct={scaledNutrition.caloriesPercent} $color={NUTRIENT_COLORS.calories} />
          </NutritionBarTrack>
          <NutritionBarValue>{scaledNutrition.caloriesPercent}%</NutritionBarValue>
        </NutritionBarRow>
        <NutritionBarRow>
          <NutritionBarLabel>
            {t('recipes.protein')} ({scaledNutrition.protein}g)
          </NutritionBarLabel>
          <NutritionBarTrack>
            <NutritionBarFill $pct={scaledNutrition.proteinPercent} $color={NUTRIENT_COLORS.protein} />
          </NutritionBarTrack>
          <NutritionBarValue>{scaledNutrition.proteinPercent}%</NutritionBarValue>
        </NutritionBarRow>
        <NutritionBarRow>
          <NutritionBarLabel>
            {t('recipes.carbs')} ({scaledNutrition.carbs}g)
          </NutritionBarLabel>
          <NutritionBarTrack>
            <NutritionBarFill $pct={scaledNutrition.carbsPercent} $color={NUTRIENT_COLORS.carbs} />
          </NutritionBarTrack>
          <NutritionBarValue>{scaledNutrition.carbsPercent}%</NutritionBarValue>
        </NutritionBarRow>
        <NutritionBarRow>
          <NutritionBarLabel>
            {t('recipes.fat')} ({scaledNutrition.fat}g)
          </NutritionBarLabel>
          <NutritionBarTrack>
            <NutritionBarFill $pct={scaledNutrition.fatPercent} $color={NUTRIENT_COLORS.fat} />
          </NutritionBarTrack>
          <NutritionBarValue>{scaledNutrition.fatPercent}%</NutritionBarValue>
        </NutritionBarRow>
      </NutritionBarList>

      <Button
        variant="contained"
        disableElevation
        startIcon={isSending ? <CircularProgress size={16} color="inherit" /> : <MdOutlineShoppingCartCheckout size={18} />}
        disabled={isSending}
        onClick={() => onSendToShoppingList({ recipeTitle: recipe.title, ingredients: scaledIngredients })}
      >
        {t('recipes.sendToList')}
      </Button>
    </DetailWrapper>
  )
}
