import { useState } from 'react'
import Chip from '@mui/material/Chip'
import TextField from '@mui/material/TextField'
import IconButton from '@mui/material/IconButton'
import { MdAdd } from 'react-icons/md'
import { useTranslation } from 'react-i18next'
import { ChipsWrapper, AddOtherRow } from './DietaryChipPicker.styles'

// Predefined dietary-restriction values — kept in sync with
// backend/src/services/chatAssistant.ts's CHIP_TO_SPOONACULAR_DIET map for
// the subset that maps onto Spoonacular's diet vocabulary; the rest still
// reach the AI via the conversation's stored dietaryRestrictions.
const PREDEFINED_RESTRICTIONS = [
  'vegetarian',
  'vegan',
  'glutenFree',
  'lactoseFree',
  'nutFree',
  'keto',
  'lowSugar',
  'halal',
  'kosher',
  'pescetarian',
  'paleo',
  'lowSodium',
  'eggFree',
] as const

export interface DietaryChipPickerProps {
  selected: string[]
  onChange: (next: string[]) => void
  // NewChatOnboarding sets this to false — its own free-text field is used
  // for the recipe/ingredient the user wants, not for a custom dietary
  // restriction, so the "add other" row would be a second, confusingly
  // similar-looking input there. Defaults to true so every other caller
  // (and this component's own tests) keeps the existing behavior.
  allowCustom?: boolean
}

export default function DietaryChipPicker({ selected, onChange, allowCustom = true }: DietaryChipPickerProps) {
  const { t } = useTranslation()
  const [customValue, setCustomValue] = useState('')

  const toggle = (value: string): void => {
    onChange(selected.includes(value) ? selected.filter((v) => v !== value) : [...selected, value])
  }

  const addCustom = (): void => {
    const trimmed = customValue.trim()
    if (!trimmed || selected.includes(trimmed)) return
    onChange([...selected, trimmed])
    setCustomValue('')
  }

  const customChips = selected.filter(
    (v) => !(PREDEFINED_RESTRICTIONS as readonly string[]).includes(v),
  )

  return (
    <div>
      <ChipsWrapper>
        {PREDEFINED_RESTRICTIONS.map((value) => (
          <Chip
            key={value}
            label={t(`chat.dietary.${value}`)}
            clickable
            color={selected.includes(value) ? 'primary' : 'default'}
            variant={selected.includes(value) ? 'filled' : 'outlined'}
            onClick={() => toggle(value)}
          />
        ))}
        {customChips.map((value) => (
          <Chip key={value} label={value} color="primary" onDelete={() => toggle(value)} />
        ))}
      </ChipsWrapper>
      {allowCustom && (
        <AddOtherRow>
          <TextField
            size="small"
            placeholder={t('chat.onboardingAddOtherPlaceholder')}
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
          <IconButton aria-label={t('chat.onboardingAddOther')} onClick={addCustom} size="small">
            <MdAdd size={18} />
          </IconButton>
        </AddOtherRow>
      )}
    </div>
  )
}
