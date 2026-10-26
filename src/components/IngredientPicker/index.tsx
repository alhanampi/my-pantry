import { useState } from 'react'
import Chip from '@mui/material/Chip'
import TextField from '@mui/material/TextField'
import IconButton from '@mui/material/IconButton'
import { MdAdd, MdOutlineFavorite, MdOutlineFavoriteBorder } from 'react-icons/md'
import { useTranslation } from 'react-i18next'
import { SectionLabel, ChipsWrapper, AddOtherRow } from './IngredientPicker.styles'
import { useFavoriteIngredients, useToggleFavoriteIngredient } from '../../hooks/useFavoriteIngredients'

// Fixed common-ingredient chips, same "predefined + custom" shape as
// ChatView/DietaryChipPicker — kept short since this sits alongside a
// pantry-driven row that can already be long on its own.
const COMMON_INGREDIENTS = [
  'rice',
  'pasta',
  'chicken',
  'beef',
  'eggs',
  'potatoes',
  'onion',
  'tomato',
  'cheese',
  'beans',
  'flour',
  'milk',
] as const

export interface IngredientPickerProps {
  selected: string[]
  onChange: (next: string[]) => void
  pantryItemNames: string[]
}

// Combines two chip sources the user can pick ingredients from — their own
// pantry (QuickReplies' pattern) and a fixed common-ingredients list
// (DietaryChipPicker's pattern) — plus free-text entry for anything not
// covered by either, all merging into one flat `selected` list of names.
export default function IngredientPicker({ selected, onChange, pantryItemNames }: IngredientPickerProps) {
  const { t } = useTranslation()
  const [customValue, setCustomValue] = useState('')
  const favoriteIngredients = useFavoriteIngredients()
  const toggleFavoriteIngredient = useToggleFavoriteIngredient()

  const toggle = (value: string): void => {
    onChange(selected.includes(value) ? selected.filter((v) => v !== value) : [...selected, value])
  }

  const addCustom = (): void => {
    const trimmed = customValue.trim()
    if (!trimmed || selected.includes(trimmed)) return
    onChange([...selected, trimmed])
    setCustomValue('')
  }

  const favoriteNames = favoriteIngredients.data ?? []
  const isFavorite = (name: string): boolean => favoriteNames.includes(name)
  const favoriteHeartProps = (name: string) => ({
    deleteIcon: isFavorite(name) ? <MdOutlineFavorite size={16} /> : <MdOutlineFavoriteBorder size={16} />,
    onDelete: () => toggleFavoriteIngredient.mutate({ name, isFavorite: isFavorite(name) }),
  })

  // Cap the pantry row so it doesn't itself become a wall of chips — same
  // reasoning/limit as QuickReplies' own pantry chip row.
  const pantryChips = pantryItemNames.slice(0, 10)
  const commonLabels = COMMON_INGREDIENTS as readonly string[]
  const customChips = selected.filter(
    (v) => !pantryChips.includes(v) && !commonLabels.includes(v) && !favoriteNames.includes(v)
  )

  return (
    <div>
      {pantryChips.length > 0 && (
        <>
          <SectionLabel>{t('mealprep.ingredientPicker.fromPantry')}</SectionLabel>
          <ChipsWrapper>
            {pantryChips.map((name) => (
              <Chip
                key={name}
                label={name}
                clickable
                color={selected.includes(name) ? 'primary' : 'default'}
                variant={selected.includes(name) ? 'filled' : 'outlined'}
                onClick={() => toggle(name)}
                {...favoriteHeartProps(name)}
              />
            ))}
          </ChipsWrapper>
        </>
      )}

      {favoriteNames.length > 0 && (
        <>
          <SectionLabel>{t('mealprep.ingredientPicker.fromFavorites')}</SectionLabel>
          <ChipsWrapper>
            {favoriteNames.map((name) => (
              <Chip
                key={name}
                label={name}
                clickable
                color={selected.includes(name) ? 'primary' : 'default'}
                variant={selected.includes(name) ? 'filled' : 'outlined'}
                onClick={() => toggle(name)}
                {...favoriteHeartProps(name)}
              />
            ))}
          </ChipsWrapper>
        </>
      )}

      <SectionLabel>{t('mealprep.ingredientPicker.common')}</SectionLabel>
      <ChipsWrapper>
        {COMMON_INGREDIENTS.map((key) => {
          // Favorited by its translated label, not the internal key — a
          // favorite ingredient is free text everywhere else (pantry/custom),
          // so it should read the same way in the Favorites tab/other picker.
          const label = t(`mealprep.ingredientPicker.items.${key}`)
          return (
            <Chip
              key={key}
              label={label}
              clickable
              color={selected.includes(key) ? 'primary' : 'default'}
              variant={selected.includes(key) ? 'filled' : 'outlined'}
              onClick={() => toggle(key)}
              {...favoriteHeartProps(label)}
            />
          )
        })}
        {customChips.map((value) => (
          <Chip
            key={value}
            label={value}
            clickable
            color="primary"
            onClick={() => toggle(value)}
            {...favoriteHeartProps(value)}
          />
        ))}
      </ChipsWrapper>

      <AddOtherRow>
        <TextField
          size="small"
          placeholder={t('mealprep.ingredientPicker.addOtherPlaceholder')}
          value={customValue}
          onChange={(e) => setCustomValue(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault()
              addCustom()
            }
          }}
          fullWidth
        />
        <IconButton aria-label={t('mealprep.ingredientPicker.addOther')} onClick={addCustom} size="small">
          <MdAdd size={18} />
        </IconButton>
      </AddOtherRow>
    </div>
  )
}
