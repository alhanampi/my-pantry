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
}

// ─── Sorting ─────────────────────────────────────────────────────────────────

export type SortDirection = 'asc' | 'desc'

export interface SortConfig {
  key: keyof Product | null
  direction: SortDirection
}

// ─── UI state ─────────────────────────────────────────────────────────────────

export type AppView = 'pantry' | 'shopping' | 'about'

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

// ─── Auth ─────────────────────────────────────────────────────────────────────

export interface AuthUser {
  id: number
  username: string
  email: string
  partner: { id: number; username: string } | null
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
}

export interface ShoppingItemProps {
  item: ShoppingListItem
  onToggle: (id: number) => void
  onDelete: (id: number) => void
  onEdit: (id: number) => void
  onQuantityChange: (id: number, delta: number) => void
}

export interface ShoppingListProps {
  items: ShoppingListItem[]
  onAddClick: () => void
  onToggle: (id: number) => void
  onDelete: (id: number) => void
  onEdit: (id: number) => void
  onClearPurchased: () => void
  onQuantityChange: (id: number, delta: number) => void
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
  onAccept: (product: ProductFormData) => void
  onCancel: () => void
}
