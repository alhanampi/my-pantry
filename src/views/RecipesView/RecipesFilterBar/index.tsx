import TextField from '@mui/material/TextField'
import Autocomplete from '@mui/material/Autocomplete'
import InputAdornment from '@mui/material/InputAdornment'
import { MdSearch } from 'react-icons/md'
import { useTranslation } from 'react-i18next'
import { FilterBarWrapper, SearchField, FilterField } from './RecipesFilterBar.styles'
import { CUISINE_OPTIONS, DIET_OPTIONS, type RecipeFilterOption } from '../../../utils/recipeFilterOptions'
import type { RecipeSearchFilters } from '../../../utils/types'

export interface RecipesFilterBarProps {
  filters: RecipeSearchFilters
  onChange: (filters: RecipeSearchFilters) => void
}

export default function RecipesFilterBar({ filters, onChange }: RecipesFilterBarProps) {
  const { t } = useTranslation()

  const set = (field: keyof RecipeSearchFilters) => (value: string) => onChange({ ...filters, [field]: value })

  const setMultiSelect = (field: 'cuisine' | 'diet') => (values: RecipeFilterOption[]) =>
    onChange({ ...filters, [field]: values.map((v) => v.value) })

  const toOptions = (options: RecipeFilterOption[], values: string[]): RecipeFilterOption[] =>
    options.filter((o) => values.includes(o.value))

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
        <Autocomplete
          multiple
          size="small"
          options={CUISINE_OPTIONS}
          value={toOptions(CUISINE_OPTIONS, filters.cuisine)}
          onChange={(_, values) => setMultiSelect('cuisine')(values)}
          getOptionLabel={(o) => t(o.labelKey)}
          isOptionEqualToValue={(o, v) => o.value === v.value}
          renderInput={(params) => <TextField {...params} label={t('recipes.cuisine')} />}
        />
      </FilterField>

      <FilterField>
        <Autocomplete
          multiple
          size="small"
          options={DIET_OPTIONS}
          value={toOptions(DIET_OPTIONS, filters.diet)}
          onChange={(_, values) => setMultiSelect('diet')(values)}
          getOptionLabel={(o) => t(o.labelKey)}
          isOptionEqualToValue={(o, v) => o.value === v.value}
          renderInput={(params) => <TextField {...params} label={t('recipes.diet')} />}
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
