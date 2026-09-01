import Chip from '@mui/material/Chip'
import CircularProgress from '@mui/material/CircularProgress'
import { MdSchedule, MdLocalFireDepartment, MdFavorite, MdFavoriteBorder } from 'react-icons/md'
import { useTranslation } from 'react-i18next'
import {
  CardWrapper,
  ImageWrapper,
  CardImage,
  FavoriteButton,
  CardBody,
  CardTitle,
  ChipsRow,
  MetaRow,
} from './RecipeCard.styles'
import type { RecipeCard as RecipeCardType } from '../../../utils/types'

export interface RecipeCardProps {
  recipe: RecipeCardType
  onClick: (id: number) => void
  isFavorite?: boolean
  onToggleFavorite?: (id: number) => void
  // True while this specific recipe's favorite toggle is in flight — shows a
  // spinner instead of the heart and blocks a second click during a slow API
  // call, rather than leaving no feedback at all.
  isTogglingFavorite?: boolean
}

const MAX_CHIPS = 3

export default function RecipeCard({
  recipe,
  onClick,
  isFavorite = false,
  onToggleFavorite,
  isTogglingFavorite = false,
}: RecipeCardProps) {
  const { t } = useTranslation()

  return (
    <CardWrapper onClick={() => onClick(recipe.id)} role="button" tabIndex={0}>
      <ImageWrapper>
        <CardImage src={recipe.image} alt={recipe.title} loading="lazy" />
        {onToggleFavorite && (
          <FavoriteButton
            type="button"
            $active={isFavorite}
            aria-pressed={isFavorite}
            aria-label={t(isFavorite ? 'recipes.removeFavorite' : 'recipes.addFavorite')}
            disabled={isTogglingFavorite}
            onClick={(e) => {
              e.stopPropagation()
              onToggleFavorite(recipe.id)
            }}
          >
            {isTogglingFavorite ? (
              <CircularProgress size={16} color="inherit" />
            ) : isFavorite ? (
              <MdFavorite size={18} />
            ) : (
              <MdFavoriteBorder size={18} />
            )}
          </FavoriteButton>
        )}
      </ImageWrapper>
      <CardBody>
        <CardTitle>{recipe.title}</CardTitle>
        <ChipsRow>
          {recipe.ingredientNames.slice(0, MAX_CHIPS).map((name) => (
            <Chip key={name} label={name} size="small" variant="outlined" />
          ))}
        </ChipsRow>
        <MetaRow>
          <span>
            <MdSchedule size={14} style={{ verticalAlign: 'text-bottom' }} /> {recipe.readyInMinutes}{' '}
            {t('recipes.minutes')}
          </span>
          <span>
            <MdLocalFireDepartment size={14} style={{ verticalAlign: 'text-bottom' }} /> {recipe.calories}{' '}
            {t('recipes.kcal')}
          </span>
        </MetaRow>
      </CardBody>
    </CardWrapper>
  )
}
