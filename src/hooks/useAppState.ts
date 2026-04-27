import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import useLocalStorage from './useLocalStorage'
import type {
  Product,
  ShoppingListItem,
  ProductFormData,
  SortConfig,
  AppView,
  AddModalState,
  EditModalState,
  ConfirmDialogState,
  SnackbarState,
} from '../utils/types'

function sortProducts(products: Product[], sortConfig: SortConfig): Product[] {
  const { key, direction } = sortConfig
  if (!key) return products
  return [...products].sort((a, b) => {
    const valA = (a[key] ?? '').toString().toLowerCase()
    const valB = (b[key] ?? '').toString().toLowerCase()
    if (valA < valB) return direction === 'asc' ? -1 : 1
    if (valA > valB) return direction === 'asc' ? 1 : -1
    return 0
  })
}

export function useAppState() {
  const { t } = useTranslation()

  const [products, setProducts] = useLocalStorage<Product[]>('mi-despensa-products', [])
  const [shoppingList, setShoppingList] = useLocalStorage<ShoppingListItem[]>(
    'mi-despensa-shopping',
    []
  )
  const [searchQuery, setSearchQuery] = useState('')
  const [sortConfig, setSortConfig] = useState<SortConfig>({ key: null, direction: 'asc' })
  const [currentView, setCurrentView] = useState<AppView>('pantry')
  const [addModal, setAddModal] = useState<AddModalState>({ open: false, context: 'pantry' })
  const [editModal, setEditModal] = useState<EditModalState>({
    open: false,
    context: 'pantry',
    id: null,
    initialData: null,
  })
  const [confirmDialog, setConfirmDialog] = useState<ConfirmDialogState>({
    open: false,
    type: null,
    data: null,
  })
  const [snackbar, setSnackbar] = useState<SnackbarState>({ open: false, message: '' })

  const handleSort = (key: keyof Product): void => {
    setSortConfig((prev) => ({
      key,
      direction: prev.key === key && prev.direction === 'asc' ? 'desc' : 'asc',
    }))
  }

  const handleAddPantryProduct = (product: ProductFormData): void => {
    const newProduct: Product = { ...product, id: Date.now() }
    setProducts((prev) => [...prev, newProduct])
    setAddModal({ open: false, context: 'pantry' })
    setConfirmDialog({ open: true, type: 'success', data: newProduct })
  }

  const handleAddShoppingItem = (item: ProductFormData): void => {
    const newItem: ShoppingListItem = { ...item, id: Date.now(), purchased: false }
    setShoppingList((prev) => [...prev, newItem])
    setAddModal({ open: false, context: 'shopping' })
    setConfirmDialog({ open: true, type: 'success', data: newItem })
  }

  const handleCancelAdd = (): void => {
    setAddModal((prev) => ({ ...prev, open: false }))
    setConfirmDialog({ open: true, type: 'cancel', data: null })
  }

  const openEditModal = (id: number): void => {
    const product = products.find((p) => p.id === id) ?? shoppingList.find((i) => i.id === id)
    if (!product) return
    const context = shoppingList.some((i) => i.id === id) ? 'shopping' : 'pantry'
    const { name, quantity, brand, purchaseDate, expiryDate, location, details } = product
    setEditModal({ open: true, context, id, initialData: { name, quantity, brand, purchaseDate, expiryDate, location, details } })
  }

  const handleEditProduct = (data: ProductFormData): void => {
    if (editModal.id === null) return
    setProducts((prev) => prev.map((p) => (p.id === editModal.id ? { ...p, ...data } : p)))
    setEditModal({ open: false, context: 'pantry', id: null, initialData: null })
  }

  const handleEditShoppingItem = (data: ProductFormData): void => {
    if (editModal.id === null) return
    setShoppingList((prev) => prev.map((i) => (i.id === editModal.id ? { ...i, ...data } : i)))
    setEditModal({ open: false, context: 'shopping', id: null, initialData: null })
  }

  const handleCancelEdit = (): void => {
    setEditModal({ open: false, context: 'pantry', id: null, initialData: null })
  }

  const handleDeleteProduct = (id: number): void => {
    setProducts((prev) => prev.filter((p) => p.id !== id))
  }

  const handleAddToCart = (product: Product): void => {
    setShoppingList((prev) => {
      const existing = prev.find((i) => i.name.toLowerCase() === product.name.toLowerCase())
      if (existing) {
        return prev.map((i) =>
          i.id === existing.id
            ? {
                ...i,
                quantity: String(
                  (parseFloat(i.quantity) || 0) + (parseFloat(product.quantity) || 1)
                ),
              }
            : i
        )
      }
      return [
        ...prev,
        {
          id: Date.now(),
          name: product.name,
          quantity: product.quantity,
          brand: product.brand,
          details: '',
          purchaseDate: '',
          expiryDate: '',
          location: '',
          purchased: false,
        },
      ]
    })
    setSnackbar({ open: true, message: t('shopping.addedToCart') })
  }

  const handleTogglePurchased = (id: number): void => {
    setShoppingList((prev) =>
      prev.map((item) => (item.id === id ? { ...item, purchased: !item.purchased } : item))
    )
  }

  const handleDeleteShoppingItem = (id: number): void => {
    setShoppingList((prev) => prev.filter((item) => item.id !== id))
  }

  const handleClearPurchased = (): void => {
    setShoppingList((prev) => prev.filter((item) => !item.purchased))
  }

  const handleShoppingQuantityChange = (id: number, delta: number): void => {
    setShoppingList((prev) =>
      prev.map((item) => {
        if (item.id !== id) return item
        const next = Math.max(0, (parseFloat(item.quantity) || 0) + delta)
        return { ...item, quantity: String(next) }
      })
    )
  }

  const handleQuantityChange = (id: number, delta: number): void => {
    setProducts((prev) =>
      prev.map((p) => {
        if (p.id !== id) return p
        const next = Math.max(0, (parseFloat(p.quantity) || 0) + delta)
        return { ...p, quantity: String(next) }
      })
    )
  }

  const handleViewChange = (view: AppView): void => {
    setCurrentView(view)
    setSearchQuery('')
  }

  const closeSnackbar = (): void => setSnackbar({ open: false, message: '' })

  const closeConfirmDialog = (): void => setConfirmDialog({ open: false, type: null, data: null })

  const openAddModal = (): void => {
    setAddModal({ open: true, context: currentView === 'shopping' ? 'shopping' : 'pantry' })
  }

  const filteredProducts = products.filter((p) => {
    const q = searchQuery.toLowerCase()
    return (
      (p.name ?? '').toLowerCase().includes(q) ||
      (p.brand ?? '').toLowerCase().includes(q) ||
      (p.location ?? '').toLowerCase().includes(q)
    )
  })

  const displayedProducts = sortProducts(filteredProducts, sortConfig)
  const bottomNavValue = currentView === 'shopping' ? 1 : 0

  return {
    // state
    products: displayedProducts,
    shoppingList,
    searchQuery,
    setSearchQuery,
    sortConfig,
    currentView,
    addModal,
    setAddModal,
    editModal,
    confirmDialog,
    snackbar,
    // handlers
    handleSort,
    handleAddPantryProduct,
    handleAddShoppingItem,
    handleCancelAdd,
    handleDeleteProduct,
    handleAddToCart,
    handleTogglePurchased,
    handleDeleteShoppingItem,
    handleClearPurchased,
    handleShoppingQuantityChange,
    handleQuantityChange,
    handleViewChange,
    openAddModal,
    openEditModal,
    handleEditProduct,
    handleEditShoppingItem,
    handleCancelEdit,
    closeSnackbar,
    closeConfirmDialog,
    // derived
    bottomNavValue,
  }
}
