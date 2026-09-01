import { Grid } from '../../RecipesView/RecipeCardGrid/RecipeCardGrid.styles'
import RecipeCard from '../../RecipesView/RecipeCard'
import type { RecipeCard as RecipeCardType } from '../../../utils/types'

export interface ChatSuggestionCardsProps {
  recipes: RecipeCardType[]
  onSelect: (id: number) => void
  favoriteIds?: Set<number>
  onToggleFavorite?: (id: number) => void
  pendingFavoriteId?: number
}

// Thin wrapper around the Recipes tab's own RecipeCard/Grid — chat
// suggestions are real Spoonacular recipes (photo + link), so they get the
// exact same visuals (favorite button included) rather than a bespoke
// suggestion card.
export default function ChatSuggestionCards({
  recipes,
  onSelect,
  favoriteIds,
  onToggleFavorite,
  pendingFavoriteId,
}: ChatSuggestionCardsProps) {
  return (
    <Grid>
      {recipes.map((recipe) => (
        <RecipeCard
          key={recipe.id}
          recipe={recipe}
          onClick={onSelect}
          isFavorite={favoriteIds?.has(recipe.id)}
          onToggleFavorite={onToggleFavorite}
          isTogglingFavorite={pendingFavoriteId === recipe.id}
        />
      ))}
    </Grid>
  )
}
