import Chip from '@mui/material/Chip'
import { MdSchedule, MdLocalFireDepartment } from 'react-icons/md'
import { useTranslation } from 'react-i18next'
import { CardWrapper, CardImage, CardBody, CardTitle, ChipsRow, MetaRow } from './RecipeCard.styles'
import type { RecipeCard as RecipeCardType } from '../../../utils/types'

export interface RecipeCardProps {
  recipe: RecipeCardType
  onClick: (id: number) => void
}

const MAX_CHIPS = 3

export default function RecipeCard({ recipe, onClick }: RecipeCardProps) {
  const { t } = useTranslation()

  return (
    <CardWrapper onClick={() => onClick(recipe.id)} role="button" tabIndex={0}>
      <CardImage src={recipe.image} alt={recipe.title} loading="lazy" />
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
