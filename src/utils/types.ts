import type { ReactNode } from 'react'

// ─── Core domain ─────────────────────────────────────────────────────────────

export interface Product {
  id: number
  name: string
  quantity: string
  brand: string
  purchaseDate: string
  expiryDate: string
  location: string
  details: string
}

export type ProductFormData = Omit<Product, 'id'>

export interface ShoppingListItem extends Product {
  purchased: boolean
  listId: string
}

// ─── Sorting ─────────────────────────────────────────────────────────────────

export type SortDirection = 'asc' | 'desc'

export interface SortConfig {
  key: keyof Product | null
  direction: SortDirection
}

// ─── UI state ─────────────────────────────────────────────────────────────────

export type AppView = 'pantry' | 'shopping' | 'recipes' | 'favorites' | 'chat' | 'mealprep' | 'about'

export type ModalContext = 'pantry' | 'shopping'

export type ExpiryStatus = 'expired' | 'soon' | 'ok' | 'none'

export interface AddModalState {
  open: boolean
  context: ModalContext
}

export interface EditModalState {
  open: boolean
  context: ModalContext
  id: number | null
  initialData: ProductFormData | null
}

export interface ConfirmDialogState {
  open: boolean
  type: 'success' | 'cancel' | null
  data: Product | ShoppingListItem | null
}

export interface SnackbarState {
  open: boolean
  message: string
  action?: { label: string; onClick: () => void }
}

export interface ZeroQuantityDialogState {
  open: boolean
  product: Product | null
}

export interface ZeroShoppingDialogState {
  open: boolean
  item: ShoppingListItem | null
}

export interface DeleteListDialogState {
  open: boolean
  list: ShoppingList | null
}

// ─── Product suggestions (Autocomplete) ──────────────────────────────────────

export interface ProductSuggestion {
  name: string
  category: string
}

// ─── Geolocation / Overpass API ──────────────────────────────────────────────

export type ShopType =
  | 'supermarket'
  | 'grocery'
  | 'marketplace'
  | 'wholesale'
  | 'convenience'
  | 'greengrocer'
  | 'butcher'
  | 'seafood'
  | 'bakery'
  | 'deli'
  | 'cheese'
  | 'health_food'
  | 'organic'

export interface Coordinates {
  lat: number
  lng: number
}

export interface RawNearbyStore {
  id: string
  name: string
  type: string
  lat: number
  lon: number
}

export interface NearbyStore extends RawNearbyStore {
  distance: number
}

// ─── Recipes (Spoonacular via backend proxy + Groq translation) ──────────────

export interface RecipeMeasure {
  amount: number
  unit: string
}

export interface RecipeIngredient {
  id: number
  name: string
  // amount/unit default to the metric measure — kept flat for back-compat
  // with anything reading them directly (e.g. favorites/shopping-list code
  // that doesn't care about unit system). measures carries both systems so
  // the metric/imperial toggle can switch instantly, client-side, without a
  // refetch — see useUnitSystem / RecipeDetailPanel.
  amount: number
  unit: string
  original: string
  measures: { metric: RecipeMeasure; us: RecipeMeasure }
}

// Compound "source:externalId" id (see backend's recipeSerializers.ts
// makeRecipeId) — never a bare provider id. Opaque to the frontend: never
// parsed or constructed here, only round-tripped back to the backend.
export type RecipeSource = 'spoonacular' | 'edamam'

export interface RecipeCard {
  id: string
  source: RecipeSource
  title: string
  image: string
  servings: number
  readyInMinutes: number
  ingredientNames: string[]
  calories: number
  sourceUrl?: string
}

export interface RecipeNutrition {
  calories: number
  protein: number
  carbs: number
  fat: number
  // Percent of Spoonacular's "daily needs" for each — powers the nutrition
  // bars in RecipeDetailPanel.
  caloriesPercent: number
  proteinPercent: number
  carbsPercent: number
  fatPercent: number
}

export interface RecipeDetail {
  id: string
  source: RecipeSource
  title: string
  image: string
  servings: number
  readyInMinutes: number
  sourceUrl?: string
  ingredients: RecipeIngredient[]
  instructions: string[]
  nutrition: RecipeNutrition
}

export interface RecipeSearchFilters {
  query: string
  cuisine: string[]
  diet: string[]
  includeIngredients: string
  maxCalories: string
}

export interface RecipeSearchResponse {
  results: RecipeCard[]
  totalResults: number
  offset: number
  number: number
}

export interface FavoriteRecipesResponse {
  results: RecipeCard[]
}

// ─── Shopping lists ────────────────────────────────────────────────────────────

export interface ShoppingList {
  id: string
  name: string
  ownerId: string
  isGeneral: boolean
  createdAt: string
}

// ─── Chat (Groq AI cooking assistant) ──────────────────────────────────────

export interface ChatConversation {
  id: string
  title: string
  dietaryRestrictions: string[]
  servings: number
  updatedAt: string
}

export interface ChatMessageItem {
  id: string
  role: 'user' | 'assistant'
  content: string
  createdAt: string
}

export interface DeleteConversationDialogState {
  open: boolean
  conversation: ChatConversation | null
}

// ─── Meal plan (Mealprep tab) ──────────────────────────────────────────────

export interface MealIngredient {
  name: string
  amount: number
  unit: string
}

export type MealType = 'breakfast' | 'lunch' | 'dinner'

// Full AI-generated recipe content — unlike the old Spoonacular/Edamam
// bookmark shape, there's no external id to look the rest up by later.
export interface MealPlanMeal {
  title: string
  description: string
  image: string
  ingredients: MealIngredient[]
  steps: string[]
  notes: string
  prepTimeMinutes: number
  totalTimeMinutes: number
}

export interface MealPlanEntry extends MealPlanMeal {
  id: string
  dayOfWeek: number
  mealType: MealType
}

// One batch-cooking session covering (some or all of) the week's meals —
// see backend/src/services/mealPlanAi.ts for how this gets generated.
// A base preparation (dough, filling, sauce, cooked grain/protein, etc.)
// that two or more of the week's dishes reuse.
export interface SharedComponent {
  name: string
  description: string
  ingredients: MealIngredient[]
  steps: string[]
  usedInDishes: string[]
}

export interface BatchPrepPlan {
  menu: string[]
  totalQuantities: MealIngredient[]
  sharedComponents: SharedComponent[]
  cookingOrder: string[]
  storageNotes: string
  estimatedTotalMinutes: number
}

export interface MealPlan {
  id: string
  weekStart: string
  includeBreakfast: boolean
  servings: number
  dietaryRestrictions: string[]
  batchPrepPlan: BatchPrepPlan | null
  days: MealPlanEntry[]
}

export interface ConsolidatedShoppingItem {
  name: string
  quantity: string
  // True when a pantry item matched by name but its quantity couldn't be
  // parsed — shown with a "you may already have some" hint instead of being
  // silently dropped or silently trusted.
  pantryNote: boolean
}

// ─── Auth ─────────────────────────────────────────────────────────────────────

export interface AuthUser {
  id: string
  username: string
  email: string
  partner: { id: string; username: string } | null
}

// ─── Component props ──────────────────────────────────────────────────────────

export interface QuantityStepperProps {
  value: string
  onIncrement: () => void
  onDecrement: () => void
}

export interface Feature {
  icon: ReactNode
  label: string
  desc: string
}

export interface HeaderProps {
  onAddClick: () => void
  searchQuery: string
  onSearchChange: (query: string) => void
  onAboutClick: () => void
  currentView: AppView
  onViewChange: (view: AppView) => void
}

export interface BottomNavProps {
  value: number
  onChange: (value: number) => void
}

export type ConfirmDialogProps = Pick<ConfirmDialogState, 'open' | 'type' | 'data'> & {
  onClose: () => void
}

export interface ProductCardProps {
  product: Product
  onDelete: (id: number) => void
  onEdit: (id: number) => void
  onAddToCart: (product: Product) => void
  onQuantityChange: (id: number, delta: number) => void
}

export interface ProductRowProps {
  product: Product
  onDelete: (id: number) => void
  onEdit: (id: number) => void
  onAddToCart: (product: Product) => void
  onQuantityChange: (id: number, delta: number) => void
}

export interface ProductTableProps {
  products: Product[]
  sortConfig: SortConfig
  onSort: (key: keyof Product) => void
  onDelete: (id: number) => void
  onEdit: (id: number) => void
  onAddToCart: (product: Product) => void
  onAddClick: () => void
  onQuantityChange: (id: number, delta: number) => void
  onExportCsv: () => void
  isLoading?: boolean
}

export interface ShoppingItemProps {
  item: ShoppingListItem
  onToggle: (id: number) => void
  onDelete: (id: number) => void
  onEdit: (id: number) => void
  onQuantityChange: (id: number, delta: number) => void
  onSendToPantry: (id: number) => void
}

export interface ShoppingListProps {
  items: ShoppingListItem[]
  lists?: ShoppingList[]
  selectedListId?: string
  onSelectList?: (listId: string) => void
  onAddClick: () => void
  onDeleteListClick?: () => void
  onToggle: (id: number) => void
  onDelete: (id: number) => void
  onEdit: (id: number) => void
  onClearPurchased: () => void
  onQuantityChange: (id: number, delta: number) => void
  onSendToPantry: (id: number) => void
  onExportPdf: () => void
  isLoading?: boolean
}

export interface SortableHeaderProps {
  label: string
  columnKey: keyof Product
  sortConfig: SortConfig
  onSort: (key: keyof Product) => void
  flex?: number
  minWidth?: string
}

export interface AddProductModalProps {
  open: boolean
  context?: ModalContext
  initialData?: ProductFormData
  loading?: boolean
  onAccept: (product: ProductFormData) => void
  onCancel: () => void
}
