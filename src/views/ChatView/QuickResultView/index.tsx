import Button from '@mui/material/Button'
import Typography from '@mui/material/Typography'
import { MdOutlineChat } from 'react-icons/md'
import { useTranslation } from 'react-i18next'
import ChatSuggestionCards from '../ChatSuggestionCards'
import RecipesSkeleton from '../../RecipesView/RecipesSkeleton'
import { NewChatStack } from '../ChatView.styles'
import type { RecipeCard } from '../../../utils/types'

export interface QuickResultViewProps {
  isLoading: boolean
  recipes: RecipeCard[]
  onSelectRecipe: (id: string) => void
  favoriteIds: Set<string>
  onToggleFavorite: (id: string) => void
  pendingFavoriteId?: string
  onContinueChat: () => void
}

// Shown right after the "quick recipe" onboarding form resolves — recipe
// suggestions appear here, below where the form was, instead of switching
// straight into the scrolling conversation view. "Seguir charlando" is the
// deliberate escape hatch into the normal ChatBody (message list +
// composer) for anyone who wants to refine further; later suggestions
// requested from inside that view still render inline as before.
export default function QuickResultView({
  isLoading,
  recipes,
  onSelectRecipe,
  favoriteIds,
  onToggleFavorite,
  pendingFavoriteId,
  onContinueChat,
}: QuickResultViewProps) {
  const { t } = useTranslation()

  return (
    <NewChatStack>
      {isLoading && <RecipesSkeleton />}

      {!isLoading && recipes.length === 0 && (
        <Typography variant="body2" color="text.secondary">
          {t('chat.noSuggestions')}
        </Typography>
      )}

      {!isLoading && recipes.length > 0 && (
        <>
          <Typography variant="body1" sx={{ fontWeight: 500 }}>
            {t('chat.suggestionsIntro')}
          </Typography>
          <ChatSuggestionCards
            recipes={recipes}
            onSelect={onSelectRecipe}
            favoriteIds={favoriteIds}
            onToggleFavorite={onToggleFavorite}
            pendingFavoriteId={pendingFavoriteId ?? undefined}
          />
        </>
      )}

      <Button variant="outlined" startIcon={<MdOutlineChat size={18} />} onClick={onContinueChat}>
        {t('chat.continueChat')}
      </Button>
    </NewChatStack>
  )
}
