import TextField from '@mui/material/TextField'
import InputAdornment from '@mui/material/InputAdornment'
import { MdSearch } from 'react-icons/md'
import { useTranslation } from 'react-i18next'
import { FilterBarWrapper, SearchField, FilterField } from './RecipesFilterBar.styles'
import type { RecipeSearchFilters } from '../../../utils/types'

export interface RecipesFilterBarProps {
  filters: RecipeSearchFilters
  onChange: (filters: RecipeSearchFilters) => void
}

export default function RecipesFilterBar({ filters, onChange }: RecipesFilterBarProps) {
  const { t } = useTranslation()

  const set = (field: keyof RecipeSearchFilters) => (value: string) => onChange({ ...filters, [field]: value })

  return (
    <FilterBarWrapper>
      <SearchField>
        <TextField
          fullWidth
          size="small"
          placeholder={t('recipes.searchPlaceholder')}
          value={filters.query}
          onChange={(e) => set('query')(e.target.value)}
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <MdSearch size={18} />
              </InputAdornment>
            ),
          }}
        />
      </SearchField>

      <FilterField>
        <TextField
          fullWidth
          size="small"
          label={t('recipes.cuisine')}
          value={filters.cuisine}
          onChange={(e) => set('cuisine')(e.target.value)}
        />
      </FilterField>

      <FilterField>
        <TextField
          fullWidth
          size="small"
          label={t('recipes.diet')}
          value={filters.diet}
          onChange={(e) => set('diet')(e.target.value)}
        />
      </FilterField>

      <FilterField>
        <TextField
          fullWidth
          size="small"
          label={t('recipes.includeIngredients')}
          value={filters.includeIngredients}
          onChange={(e) => set('includeIngredients')(e.target.value)}
        />
      </FilterField>

      <FilterField>
        <TextField
          fullWidth
          size="small"
          type="number"
          label={t('recipes.maxCalories')}
          value={filters.maxCalories}
          onChange={(e) => set('maxCalories')(e.target.value)}
          inputProps={{ min: 0 }}
        />
      </FilterField>
    </FilterBarWrapper>
  )
}
