import { useMemo, useState } from 'react'
import Button from '@mui/material/Button'
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
}: RecipeDetailPanelProps) {
  const { t } = useTranslation()
  const [servings, setServings] = useState(recipe.servings)

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
            onClick={() => onToggleFavorite(recipe.id)}
          >
            {isFavorite ? <MdFavorite size={22} /> : <MdFavoriteBorder size={22} />}
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
        startIcon={<MdOutlineShoppingCartCheckout size={18} />}
        disabled={isSending}
        onClick={() => onSendToShoppingList({ recipeTitle: recipe.title, ingredients: scaledIngredients })}
      >
        {t('recipes.sendToList')}
      </Button>
    </DetailWrapper>
  )
}
