import Button from '@mui/material/Button'
import { useTranslation } from 'react-i18next'
import ChatSuggestionCards from '../../ChatView/ChatSuggestionCards'
import RecipesSkeleton from '../RecipesSkeleton'
import { SectionTitle } from '../RecipesView.styles'
import { Wrapper, Section, MoreButtonRow, EmptyHint } from './PantryAndRandomSuggestions.styles'
import { usePantryChatSuggestions } from '../../../hooks/useChat'
import { useRandomRecipeSuggestions } from '../../../hooks/useRecipes'

export interface PantryAndRandomSuggestionsProps {
  onSelectRecipe: (id: string) => void
  favoriteIds: Set<string>
  onToggleFavorite: (id: string) => void
  pendingFavoriteId?: string
}

// Recetas tab landing state (no search/filter active): two curated rows —
// "based on your pantry" (soonest-to-expire ingredients first) and a random
// discovery row underneath, each independently loading/refreshable. Replaces
// the old Chat-screen PantrySuggestions, which showed the same pantry-based
// row before the user could even start chatting.
export default function PantryAndRandomSuggestions({
  onSelectRecipe,
  favoriteIds,
  onToggleFavorite,
  pendingFavoriteId,
}: PantryAndRandomSuggestionsProps) {
  const { t } = useTranslation()
  const pantry = usePantryChatSuggestions()
  const random = useRandomRecipeSuggestions()

  return (
    <Wrapper>
      <Section>
        <SectionTitle>{t('recipes.pantrySuggestions.title')}</SectionTitle>
        {pantry.isLoading && <RecipesSkeleton />}
        {!pantry.isLoading && (pantry.data?.length ?? 0) === 0 && (
          <EmptyHint>{t('recipes.pantrySuggestions.empty')}</EmptyHint>
        )}
        {!pantry.isLoading && (pantry.data?.length ?? 0) > 0 && (
          <ChatSuggestionCards
            recipes={pantry.data!}
            onSelect={onSelectRecipe}
            favoriteIds={favoriteIds}
            onToggleFavorite={onToggleFavorite}
            pendingFavoriteId={pendingFavoriteId}
          />
        )}
      </Section>

      <Section>
        <SectionTitle>{t('recipes.randomSuggestions.title')}</SectionTitle>
        {random.isLoading && <RecipesSkeleton />}
        {!random.isLoading && (random.data?.results.length ?? 0) > 0 && (
          <>
            <ChatSuggestionCards
              recipes={random.data!.results}
              onSelect={onSelectRecipe}
              favoriteIds={favoriteIds}
              onToggleFavorite={onToggleFavorite}
              pendingFavoriteId={pendingFavoriteId}
            />
            <MoreButtonRow>
              <Button variant="outlined" onClick={random.loadMore} disabled={random.isFetching}>
                {t('recipes.randomSuggestions.moreSuggestions')}
              </Button>
            </MoreButtonRow>
          </>
        )}
      </Section>
    </Wrapper>
  )
}
