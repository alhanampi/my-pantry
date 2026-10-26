import Chip from '@mui/material/Chip'
import { useTranslation } from 'react-i18next'
import { Wrapper, ChipsRow } from './QuickReplies.styles'

export interface QuickRepliesProps {
  pantryItemNames: string[]
  // AI-inferred "you might also need..." suggestions (see useChatSession) —
  // not confirmed pantry items, just a plausible guess at what the dish
  // being discussed could still require. Kept as a separate row/color from
  // pantryItemNames so the distinction (real inventory vs. a guess) stays
  // visible, even though tapping either inserts the same "Tengo X" phrase.
  aiIngredientSuggestions: string[]
  onPickPhrase: (phrase: string) => void
  onPickIngredient: (name: string) => void
}

const TIME_OPTIONS = ['time10', 'time30', 'time60', 'timeMore'] as const
const SERVINGS_OPTIONS = ['servings1', 'servings2', 'servings4', 'servings6Plus'] as const

// Short, curated subset — not the full 13-value list from DietaryChipPicker,
// which would overwhelm a single suggestion row. Reuses the already-
// translated chat.dietary.* labels (no new i18n needed) and inserts the raw
// label text, same as the ingredient chips below.
const DIETARY_OPTIONS = ['vegetarian', 'vegan', 'glutenFree', 'lactoseFree', 'keto'] as const

// Optional convenience rows shown above the composer — replaces the old
// mandatory dietary/servings onboarding form with tap-to-insert chips that
// never block anything. Tapping any chip here (time, dietary, servings,
// ingredient) inserts text into the composer (via ChatComposer's imperative
// handle) rather than sending immediately, so several taps can be combined
// before hitting send, or ignored entirely in favor of just typing.
export default function QuickReplies({
  pantryItemNames,
  aiIngredientSuggestions,
  onPickPhrase,
  onPickIngredient,
}: QuickRepliesProps) {
  const { t } = useTranslation()

  // Cap the row so it doesn't itself become a wall of chips — the pantry
  // can have far more items than fit comfortably in one scrollable row.
  const ingredientChips = pantryItemNames.slice(0, 8)

  return (
    <Wrapper>
      <ChipsRow role="group" aria-label={t('chat.quickReplies.timeGroupLabel')}>
        {TIME_OPTIONS.map((key) => (
          <Chip
            key={key}
            size="small"
            variant="outlined"
            label={t(`chat.quickReplies.${key}Label`)}
            clickable
            onClick={() => onPickPhrase(t(`chat.quickReplies.${key}Phrase`))}
          />
        ))}
      </ChipsRow>
      <ChipsRow role="group" aria-label={t('chat.quickReplies.dietaryGroupLabel')}>
        {DIETARY_OPTIONS.map((value) => (
          <Chip
            key={value}
            size="small"
            variant="outlined"
            label={t(`chat.dietary.${value}`)}
            clickable
            onClick={() => onPickPhrase(t(`chat.dietary.${value}`))}
          />
        ))}
      </ChipsRow>
      <ChipsRow role="group" aria-label={t('chat.quickReplies.servingsGroupLabel')}>
        {SERVINGS_OPTIONS.map((key) => (
          <Chip
            key={key}
            size="small"
            variant="outlined"
            label={t(`chat.quickReplies.${key}Label`)}
            clickable
            onClick={() => onPickPhrase(t(`chat.quickReplies.${key}Phrase`))}
          />
        ))}
      </ChipsRow>
      {ingredientChips.length > 0 && (
        <ChipsRow role="group" aria-label={t('chat.quickReplies.ingredientsGroupLabel')}>
          {ingredientChips.map((name) => (
            <Chip
              key={name}
              size="small"
              variant="outlined"
              color="primary"
              label={name}
              clickable
              onClick={() => onPickIngredient(name)}
            />
          ))}
        </ChipsRow>
      )}
      {aiIngredientSuggestions.length > 0 && (
        <ChipsRow role="group" aria-label={t('chat.quickReplies.aiIngredientsGroupLabel')}>
          {aiIngredientSuggestions.map((name) => (
            <Chip
              key={name}
              size="small"
              variant="outlined"
              color="secondary"
              label={name}
              clickable
              onClick={() => onPickIngredient(name)}
            />
          ))}
        </ChipsRow>
      )}
    </Wrapper>
  )
}
