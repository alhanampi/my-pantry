import { useMemo, useState } from 'react'
import Button from '@mui/material/Button'
import CircularProgress from '@mui/material/CircularProgress'
import { MdOutlineShoppingCartCheckout, MdFavorite, MdFavoriteBorder } from 'react-icons/md'
import { useTranslation } from 'react-i18next'
import ServingsStepper from '../ServingsStepper'
import {
  DetailWrapper,
  HeroImageWrapper,
  HeroImage,
  HeroFavoriteButton,
  Title,
  ServingsRow,
  NutritionGrid,
  NutritionCell,
  NutritionValue,
  NutritionLabel,
  IngredientsList,
  InstructionsList,
} from './RecipeDetailPanel.styles'
import { SectionTitle } from '../RecipesView.styles'
import type { RecipeDetail, RecipeIngredient } from '../../../utils/types'

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

export default function RecipeDetailPanel({
  recipe,
  onSendToShoppingList,
  isSending = false,
  isFavorite = false,
  onToggleFavorite,
  isTogglingFavorite = false,
  initialServings,
}: RecipeDetailPanelProps) {
  const { t } = useTranslation()
  const [servings, setServings] = useState(initialServings ?? recipe.servings)

  const ratio = servings / recipe.servings

  // Scaling — the single spot both the rendered ingredient amounts and the
  // "send to shopping list" payload read from, so they can never drift apart.
  const scaledIngredients = useMemo<RecipeIngredient[]>(
    () => recipe.ingredients.map((ing) => ({ ...ing, amount: round2(ing.amount * ratio) })),
    [recipe.ingredients, ratio],
  )

  const scaledNutrition = useMemo(
    () => ({
      calories: round2(recipe.nutrition.calories * ratio),
      protein: round2(recipe.nutrition.protein * ratio),
      carbs: round2(recipe.nutrition.carbs * ratio),
      fat: round2(recipe.nutrition.fat * ratio),
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

      <NutritionGrid>
        <NutritionCell>
          <NutritionValue>{scaledNutrition.calories}</NutritionValue>
          <NutritionLabel>{t('recipes.calories')}</NutritionLabel>
        </NutritionCell>
        <NutritionCell>
          <NutritionValue>{scaledNutrition.protein}g</NutritionValue>
          <NutritionLabel>{t('recipes.protein')}</NutritionLabel>
        </NutritionCell>
        <NutritionCell>
          <NutritionValue>{scaledNutrition.carbs}g</NutritionValue>
          <NutritionLabel>{t('recipes.carbs')}</NutritionLabel>
        </NutritionCell>
        <NutritionCell>
          <NutritionValue>{scaledNutrition.fat}g</NutritionValue>
          <NutritionLabel>{t('recipes.fat')}</NutritionLabel>
        </NutritionCell>
      </NutritionGrid>

      <div>
        <SectionTitle>{t('recipes.ingredients')}</SectionTitle>
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
        <InstructionsList>
          {recipe.instructions.map((step, i) => (
            <li key={i}>{step}</li>
          ))}
        </InstructionsList>
      </div>

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
