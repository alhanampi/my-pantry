import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { usePantry } from './usePantry'
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
  ZeroQuantityDialogState,
  ZeroShoppingDialogState,
  DeleteListDialogState,
} from '../utils/types'
import type { ZeroQuantityAction } from '../components/ZeroQuantityDialog'
import type { ZeroShoppingAction } from '../components/ZeroShoppingQtyDialog'

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

const viewOrder: AppView[] = ['pantry', 'recipes', 'favorites', 'shopping']

export function useAppState() {
  const { t } = useTranslation()
  const [selectedShoppingListId, setSelectedShoppingListId] = useState<string | undefined>(undefined)
  const pantry = usePantry(selectedShoppingListId)

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
  const [zeroQtyDialog, setZeroQtyDialog] = useState<ZeroQuantityDialogState>({
    open: false,
    product: null,
  })
  const [zeroShoppingDialog, setZeroShoppingDialog] = useState<ZeroShoppingDialogState>({
    open: false,
    item: null,
  })
  const [deleteListDialog, setDeleteListDialog] = useState<DeleteListDialogState>({
    open: false,
    list: null,
  })

  const showError = () =>
    setSnackbar({ open: true, message: t('errors.saveFailed', 'Error saving. Try again.') })

  const handleSort = (key: keyof Product): void => {
    setSortConfig((prev) => ({
      key,
      direction: prev.key === key && prev.direction === 'asc' ? 'desc' : 'asc',
    }))
  }

  const handleAddPantryProduct = (product: ProductFormData): void => {
    pantry.createProduct.mutate(product, {
      onSuccess: (newProduct) => {
        setAddModal({ open: false, context: 'pantry' })
        setConfirmDialog({ open: true, type: 'success', data: newProduct })
      },
      onError: showError,
    })
  }

  const handleAddShoppingItem = (item: ProductFormData): void => {
    if (!pantry.activeListId) return
    const newItem: Omit<ShoppingListItem, 'id'> = { ...item, purchased: false, listId: pantry.activeListId }
    pantry.createShoppingItem.mutate(newItem, {
      onSuccess: (created) => {
        setAddModal({ open: false, context: 'shopping' })
        setConfirmDialog({ open: true, type: 'success', data: created })
      },
      onError: showError,
    })
  }

  const handleCancelAdd = (): void => {
    setAddModal((prev) => ({ ...prev, open: false }))
    setConfirmDialog({ open: true, type: 'cancel', data: null })
  }

  const openEditModal = (id: number): void => {
    const product =
      pantry.products.find((p) => p.id === id) ?? pantry.shoppingList.find((i) => i.id === id)
    if (!product) return
    const context = pantry.shoppingList.some((i) => i.id === id) ? 'shopping' : 'pantry'
    const { name, quantity, brand, purchaseDate, expiryDate, location, details } = product
    setEditModal({
      open: true,
      context,
      id,
      initialData: { name, quantity, brand, purchaseDate, expiryDate, location, details },
    })
  }

  const handleEditProduct = (data: ProductFormData): void => {
    if (editModal.id === null) return
    pantry.updateProduct.mutate(
      { id: editModal.id, data },
      {
        onSuccess: () => {
          setEditModal({ open: false, context: 'pantry', id: null, initialData: null })
        },
        onError: showError,
      }
    )
  }

  const handleEditShoppingItem = (data: ProductFormData): void => {
    if (editModal.id === null) return
    pantry.updateShoppingItem.mutate(
      { id: editModal.id, data },
      {
        onSuccess: () => {
          setEditModal({ open: false, context: 'shopping', id: null, initialData: null })
        },
        onError: showError,
      }
    )
  }

  const handleCancelEdit = (): void => {
    setEditModal({ open: false, context: 'pantry', id: null, initialData: null })
  }

  const handleDeleteProduct = (id: number): void => {
    pantry.deleteProduct.mutate(id, { onError: showError })
  }

  const handleAddToCart = (product: Product): void => {
    if (!pantry.activeListId) return
    const existing = pantry.shoppingList.find(
      (i) => i.name.toLowerCase() === product.name.toLowerCase()
    )
    if (existing) {
      const newQty = String(
        (parseFloat(existing.quantity) || 0) + (parseFloat(product.quantity) || 1)
      )
      pantry.updateShoppingItem.mutate({ id: existing.id, data: { quantity: newQty } })
    } else {
      pantry.createShoppingItem.mutate({
        name: product.name,
        quantity: product.quantity,
        brand: product.brand,
        details: '',
        purchaseDate: '',
        expiryDate: '',
        location: '',
        purchased: false,
        listId: pantry.activeListId,
      })
    }
    setSnackbar({ open: true, message: t('shopping.addedToCart') })
  }

  const handleTogglePurchased = (id: number): void => {
    const item = pantry.shoppingList.find((i) => i.id === id)
    if (!item) return
    pantry.updateShoppingItem.mutate(
      { id, data: { purchased: !item.purchased } },
      { onError: showError }
    )
  }

  const handleDeleteShoppingItem = (id: number): void => {
    pantry.deleteShoppingItem.mutate(id, { onError: showError })
  }

  const handleClearPurchased = (): void => {
    pantry.clearPurchasedItems.mutate(undefined, { onError: showError })
  }

  const handleShoppingQuantityChange = (id: number, delta: number): void => {
    const item = pantry.shoppingList.find((i) => i.id === id)
    if (!item) return
    const next = Math.max(0, (parseFloat(item.quantity) || 0) + delta)
    if (next === 0) {
      setZeroShoppingDialog({ open: true, item })
      return
    }
    pantry.updateShoppingItem.mutate({ id, data: { quantity: String(next) } })
  }

  const handleZeroShoppingAction = (action: ZeroShoppingAction): void => {
    const { item } = zeroShoppingDialog
    setZeroShoppingDialog({ open: false, item: null })
    if (!item) return
    if (action === 'delete') {
      pantry.deleteShoppingItem.mutate(item.id, { onError: showError })
    } else {
      pantry.updateShoppingItem.mutate({ id: item.id, data: { quantity: '1' } }, { onError: showError })
    }
  }

  const handleQuantityChange = (id: number, delta: number): void => {
    const product = pantry.products.find((p) => p.id === id)
    if (!product) return
    const next = Math.max(0, (parseFloat(product.quantity) || 0) + delta)
    if (next === 0) {
      handleDeleteProduct(product.id)
      setZeroQtyDialog({ open: true, product })
      return
    }
    pantry.updateProduct.mutate({ id, data: { quantity: String(next) } })
  }

  const handleZeroQtyAction = (action: ZeroQuantityAction): void => {
    const { product } = zeroQtyDialog
    setZeroQtyDialog({ open: false, product: null })
    if (!product || action === 'cancel') return
    if (action === 'cart') handleAddToCart(product)
  }

  const handleDeleteListClick = (): void => {
    const list = pantry.shoppingLists.find((l) => l.id === pantry.activeListId)
    if (!list || list.isGeneral) return // General is never deletable; button is hidden for it anyway
    setDeleteListDialog({ open: true, list })
  }

  const handleConfirmDeleteList = (): void => {
    const { list } = deleteListDialog
    setDeleteListDialog({ open: false, list: null })
    if (!list) return
    pantry.deleteShoppingList.mutate(list.id, {
      onSuccess: () => {
        // Deleted the list currently being viewed — fall back to General
        // (activeListId derives it automatically once selectedShoppingListId
        // is cleared).
        if (selectedShoppingListId === list.id) setSelectedShoppingListId(undefined)
      },
      onError: showError,
    })
  }

  const handleCancelDeleteList = (): void => setDeleteListDialog({ open: false, list: null })

  const handleViewChange = (view: AppView): void => {
    setCurrentView(view)
    setSearchQuery('')
  }

  // Switches to the Shopping tab with a specific list pre-selected — used
  // after "send recipe to new shopping list" so the user lands on it.
  const switchToShoppingList = (listId: string): void => {
    setSelectedShoppingListId(listId)
    setCurrentView('shopping')
    setSearchQuery('')
  }

  // Success snackbar for "send recipe to new shopping list", with an action
  // to jump straight to that list on the Shopping tab.
  const handleRecipeSentToList = (listId: string): void => {
    setSnackbar({
      open: true,
      message: t('recipes.sentToList'),
      action: { label: t('recipes.viewList'), onClick: () => switchToShoppingList(listId) },
    })
  }

  const closeSnackbar = (): void => setSnackbar({ open: false, message: '' })

  const closeConfirmDialog = (): void => setConfirmDialog({ open: false, type: null, data: null })

  const openAddModal = (): void => {
    setAddModal({ open: true, context: currentView === 'shopping' ? 'shopping' : 'pantry' })
  }

  const filteredProducts = pantry.products.filter((p) => {
    const q = searchQuery.toLowerCase()
    return (
      (p.name ?? '').toLowerCase().includes(q) ||
      (p.brand ?? '').toLowerCase().includes(q) ||
      (p.location ?? '').toLowerCase().includes(q)
    )
  })

  const displayedProducts = sortProducts(filteredProducts, sortConfig)
  const bottomNavValue = viewOrder.includes(currentView) ? viewOrder.indexOf(currentView) : 0
  const handleBottomNavChange = (index: number): void => handleViewChange(viewOrder[index] ?? 'pantry')

  return {
    // state
    isLoading: pantry.isLoading,
    isSaving:
      pantry.createProduct.isPending ||
      pantry.createShoppingItem.isPending ||
      pantry.updateProduct.isPending ||
      pantry.updateShoppingItem.isPending,
    products: displayedProducts,
    shoppingList: pantry.shoppingList,
    shoppingLists: pantry.shoppingLists,
    selectedShoppingListId: pantry.activeListId,
    createShoppingList: pantry.createShoppingList,
    sendRecipeToShoppingList: pantry.sendRecipeToShoppingList,
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
    switchToShoppingList,
    setSelectedShoppingListId,
    handleRecipeSentToList,
    openAddModal,
    openEditModal,
    handleEditProduct,
    handleEditShoppingItem,
    handleCancelEdit,
    closeSnackbar,
    closeConfirmDialog,
    zeroQtyDialog,
    handleZeroQtyAction,
    zeroShoppingDialog,
    handleZeroShoppingAction,
    deleteListDialog,
    handleDeleteListClick,
    handleConfirmDeleteList,
    handleCancelDeleteList,
    // derived
    bottomNavValue,
    handleBottomNavChange,
  }
}
