import { useState, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { usePantry } from './usePantry'
import { productsToCsv, downloadCsv } from '../utils/exportCsv'
import { shoppingListToPdf } from '../utils/exportPdf'
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

// How long the "Deshacer"/"Undo" window stays open before a deleted
// product/shopping item is actually sent to the DELETE endpoint. Keep in
// sync with the snackbar's autoHideDuration in App.tsx.
export const UNDO_WINDOW_MS = 5000

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

const viewOrder: AppView[] = ['pantry', 'recipes', 'chat', 'mealprep', 'shopping', 'favorites']

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

  // Undo-on-delete: ids in these sets are hidden from the UI immediately but
  // not actually deleted server/localStorage-side until their timeout fires
  // (see handleDeleteProduct/handleDeleteShoppingItem). Two separate sets/
  // timer maps because product ids and shopping item ids are independent
  // numeric spaces (different DB tables) and could collide.
  const [pendingDeleteProductIds, setPendingDeleteProductIds] = useState<Set<number>>(new Set())
  const [pendingDeleteShoppingIds, setPendingDeleteShoppingIds] = useState<Set<number>>(new Set())
  const productDeleteTimers = useRef<Map<number, ReturnType<typeof setTimeout>>>(new Map())
  const shoppingDeleteTimers = useRef<Map<number, ReturnType<typeof setTimeout>>>(new Map())

  // Products/shopping items currently mid undo-window are excluded from
  // every derived list (display, search, sort, export) — they only come
  // back if "Deshacer" is clicked before the real delete fires.
  const visibleProducts = pantry.products.filter((p) => !pendingDeleteProductIds.has(p.id))
  const visibleShoppingList = pantry.shoppingList.filter((i) => !pendingDeleteShoppingIds.has(i.id))

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
      initialData: {
        name,
        quantity,
        brand,
        purchaseDate,
        expiryDate,
        location,
        details,
        preferredStoreName: 'preferredStoreName' in product ? product.preferredStoreName : '',
      },
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

  // Undo-on-delete: hides the product immediately, but only fires the real
  // DELETE after UNDO_WINDOW_MS unless the snackbar's "Deshacer" action
  // cancels the pending timeout first.
  const handleDeleteProduct = (id: number): void => {
    setPendingDeleteProductIds((prev) => new Set(prev).add(id))

    const timer = setTimeout(() => {
      productDeleteTimers.current.delete(id)
      pantry.deleteProduct.mutate(id, {
        onError: showError,
        onSettled: () => {
          setPendingDeleteProductIds((prev) => {
            const next = new Set(prev)
            next.delete(id)
            return next
          })
        },
      })
    }, UNDO_WINDOW_MS)
    productDeleteTimers.current.set(id, timer)

    setSnackbar({
      open: true,
      message: t('table.productDeleted'),
      action: {
        label: t('common.undo'),
        onClick: () => {
          const pending = productDeleteTimers.current.get(id)
          if (pending) clearTimeout(pending)
          productDeleteTimers.current.delete(id)
          setPendingDeleteProductIds((prev) => {
            const next = new Set(prev)
            next.delete(id)
            return next
          })
        },
      },
    })
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

  // Undo-on-delete for shopping items — same mechanism as handleDeleteProduct.
  const handleDeleteShoppingItem = (id: number): void => {
    setPendingDeleteShoppingIds((prev) => new Set(prev).add(id))

    const timer = setTimeout(() => {
      shoppingDeleteTimers.current.delete(id)
      pantry.deleteShoppingItem.mutate(id, {
        onError: showError,
        onSettled: () => {
          setPendingDeleteShoppingIds((prev) => {
            const next = new Set(prev)
            next.delete(id)
            return next
          })
        },
      })
    }, UNDO_WINDOW_MS)
    shoppingDeleteTimers.current.set(id, timer)

    setSnackbar({
      open: true,
      message: t('shopping.itemDeleted'),
      action: {
        label: t('common.undo'),
        onClick: () => {
          const pending = shoppingDeleteTimers.current.get(id)
          if (pending) clearTimeout(pending)
          shoppingDeleteTimers.current.delete(id)
          setPendingDeleteShoppingIds((prev) => {
            const next = new Set(prev)
            next.delete(id)
            return next
          })
        },
      },
    })
  }

  // Moves a purchased shopping item into the pantry: creates the equivalent
  // Product (dropping purchased/listId), then removes it from the shopping
  // list once created. Mirrors handleAddToCart but in the opposite direction.
  const handleSendToPantry = (id: number): void => {
    const item = visibleShoppingList.find((i) => i.id === id)
    if (!item) return
    const { purchased: _purchased, listId: _listId, id: _id, ...data } = item
    const productData: ProductFormData = { ...data, preferredStoreName: '' }
    pantry.createProduct.mutate(productData, {
      onSuccess: () => {
        pantry.deleteShoppingItem.mutate(id, { onError: showError })
        setSnackbar({ open: true, message: t('shopping.sentToPantry', { name: item.name }) })
      },
      onError: showError,
    })
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

  // Client-side exports — no network, just serialize what's already in the
  // hook's state.
  const handleExportPantryCsv = (): void => {
    downloadCsv('mi-despensa.csv', productsToCsv(visibleProducts))
  }

  const handleExportShoppingPdf = (): void => {
    const listName =
      pantry.shoppingLists.find((l) => l.id === pantry.activeListId)?.name ?? t('nav.shopping')
    shoppingListToPdf(visibleShoppingList, listName)
  }

  const closeSnackbar = (): void => setSnackbar({ open: false, message: '' })

  const closeConfirmDialog = (): void => setConfirmDialog({ open: false, type: null, data: null })

  const openAddModal = (): void => {
    setAddModal({ open: true, context: currentView === 'shopping' ? 'shopping' : 'pantry' })
  }

  const filteredProducts = visibleProducts.filter((p) => {
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
    shoppingList: visibleShoppingList,
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
    handleSendToPantry,
    handleClearPurchased,
    handleExportPantryCsv,
    handleExportShoppingPdf,
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
