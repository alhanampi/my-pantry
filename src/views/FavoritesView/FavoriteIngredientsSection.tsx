import { useState } from 'react'
import Chip from '@mui/material/Chip'
import TextField from '@mui/material/TextField'
import Autocomplete from '@mui/material/Autocomplete'
import IconButton from '@mui/material/IconButton'
import { MdAdd } from 'react-icons/md'
import { useTranslation } from 'react-i18next'
import { getProductSuggestions } from '../../data/productSuggestions'
import { useFavoriteIngredients, useToggleFavoriteIngredient } from '../../hooks/useFavoriteIngredients'
import { AddRow, ChipsWrapper, EmptyHint } from './FavoriteIngredientsSection.styles'
import type { ProductSuggestion } from '../../utils/types'

// Plain name bookmarks — no image is possible for free text, so unlike the
// other categories this is just a flat chip row, plus an add input here
// (unlike the other categories, which are only ever favorited from their
// own feature screen). Same freeSolo-with-suggestions pattern as
// AddProductModal's name field, over the same static product catalog —
// adding a favorite ingredient should feel exactly like naming a pantry
// product.
export default function FavoriteIngredientsSection() {
  const { t, i18n } = useTranslation()
  const [inputValue, setInputValue] = useState('')
  const { data: names = [] } = useFavoriteIngredients()
  const toggle = useToggleFavoriteIngredient()

  const suggestions = getProductSuggestions(i18n.language)

  const addFavorite = (): void => {
    const trimmed = inputValue.trim()
    if (!trimmed) return
    toggle.mutate({ name: trimmed, isFavorite: false })
    setInputValue('')
  }

  return (
    <div>
      <AddRow>
        <Autocomplete<ProductSuggestion, false, false, true>
          freeSolo
          options={suggestions}
          groupBy={(option) => option.category}
          getOptionLabel={(option) => (typeof option === 'string' ? option : option.name)}
          inputValue={inputValue}
          onInputChange={(_, value) => setInputValue(value)}
          onChange={(_, value) => {
            if (value && typeof value !== 'string') setInputValue(value.name)
          }}
          filterOptions={(options, { inputValue: query }) => {
            const normalize = (s: string) =>
              s
                .normalize('NFD')
                .replace(/[̀-ͯ]/g, '')
                .toLowerCase()
            return options.filter((o) => normalize(o.name).includes(normalize(query)))
          }}
          renderOption={(props, option) => (
            <li {...props} key={`${option.name}-${option.category}`}>
              {option.name}
            </li>
          )}
          sx={{ flex: 1 }}
          renderInput={(params) => (
            <TextField
              {...params}
              size="small"
              placeholder={t('favorites.ingredientsAddPlaceholder')}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault()
                  addFavorite()
                }
              }}
            />
          )}
        />
        <IconButton aria-label={t('favorites.ingredientsAddPlaceholder')} onClick={addFavorite} size="small">
          <MdAdd size={18} />
        </IconButton>
      </AddRow>

      {names.length === 0 ? (
        <EmptyHint>{t('favorites.ingredientsEmpty')}</EmptyHint>
      ) : (
        <ChipsWrapper>
          {names.map((name) => (
            <Chip
              key={name}
              label={name}
              onDelete={() => toggle.mutate({ name, isFavorite: true })}
              disabled={toggle.isPending && toggle.variables?.name === name}
            />
          ))}
        </ChipsWrapper>
      )}
    </div>
  )
}
