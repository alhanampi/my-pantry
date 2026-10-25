// Fixed vocabularies for the Recetas cuisine/diet filters. `value` is what
// Spoonacular's complexSearch actually accepts for that param (free text
// typed by the user never matched anything, since Spoonacular only
// recognizes its own fixed English terms) — `labelKey` is the i18n key for
// the translated, user-facing chip/option text.
//
// Diet values/casing are kept in sync with
// backend/src/services/chatAssistant.ts's SPOONACULAR_DIETS; the first six
// reuse the same `chat.dietary.*` labels as DietaryChipPicker so the same
// restriction reads identically in both places.
export interface RecipeFilterOption {
  value: string
  labelKey: string
}

export const DIET_OPTIONS: RecipeFilterOption[] = [
  { value: 'vegetarian', labelKey: 'chat.dietary.vegetarian' },
  { value: 'vegan', labelKey: 'chat.dietary.vegan' },
  { value: 'glutenfree', labelKey: 'chat.dietary.glutenFree' },
  { value: 'ketogenic', labelKey: 'chat.dietary.keto' },
  { value: 'pescetarian', labelKey: 'chat.dietary.pescetarian' },
  { value: 'paleo', labelKey: 'chat.dietary.paleo' },
  { value: 'primal', labelKey: 'recipes.filters.dietOptions.primal' },
  { value: 'lowfodmap', labelKey: 'recipes.filters.dietOptions.lowFodmap' },
  { value: 'whole30', labelKey: 'recipes.filters.dietOptions.whole30' },
]

export const CUISINE_OPTIONS: RecipeFilterOption[] = [
  { value: 'african', labelKey: 'recipes.filters.cuisineOptions.african' },
  { value: 'american', labelKey: 'recipes.filters.cuisineOptions.american' },
  { value: 'british', labelKey: 'recipes.filters.cuisineOptions.british' },
  { value: 'cajun', labelKey: 'recipes.filters.cuisineOptions.cajun' },
  { value: 'caribbean', labelKey: 'recipes.filters.cuisineOptions.caribbean' },
  { value: 'chinese', labelKey: 'recipes.filters.cuisineOptions.chinese' },
  { value: 'easternEuropean', labelKey: 'recipes.filters.cuisineOptions.easternEuropean' },
  { value: 'european', labelKey: 'recipes.filters.cuisineOptions.european' },
  { value: 'french', labelKey: 'recipes.filters.cuisineOptions.french' },
  { value: 'german', labelKey: 'recipes.filters.cuisineOptions.german' },
  { value: 'greek', labelKey: 'recipes.filters.cuisineOptions.greek' },
  { value: 'indian', labelKey: 'recipes.filters.cuisineOptions.indian' },
  { value: 'irish', labelKey: 'recipes.filters.cuisineOptions.irish' },
  { value: 'italian', labelKey: 'recipes.filters.cuisineOptions.italian' },
  { value: 'japanese', labelKey: 'recipes.filters.cuisineOptions.japanese' },
  { value: 'jewish', labelKey: 'recipes.filters.cuisineOptions.jewish' },
  { value: 'korean', labelKey: 'recipes.filters.cuisineOptions.korean' },
  { value: 'latinAmerican', labelKey: 'recipes.filters.cuisineOptions.latinAmerican' },
  { value: 'mediterranean', labelKey: 'recipes.filters.cuisineOptions.mediterranean' },
  { value: 'mexican', labelKey: 'recipes.filters.cuisineOptions.mexican' },
  { value: 'middleEastern', labelKey: 'recipes.filters.cuisineOptions.middleEastern' },
  { value: 'nordic', labelKey: 'recipes.filters.cuisineOptions.nordic' },
  { value: 'southern', labelKey: 'recipes.filters.cuisineOptions.southern' },
  { value: 'spanish', labelKey: 'recipes.filters.cuisineOptions.spanish' },
  { value: 'thai', labelKey: 'recipes.filters.cuisineOptions.thai' },
  { value: 'vietnamese', labelKey: 'recipes.filters.cuisineOptions.vietnamese' },
]
