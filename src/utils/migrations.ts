type LegacyItem = Record<string, unknown>

function migrateItem(item: LegacyItem): LegacyItem {
  if (!('nombre' in item)) return item
  return {
    ...item,
    name: item.name ?? item.nombre,
    quantity: item.quantity ?? item.cantidad,
    brand: item.brand ?? item.marca,
    purchaseDate: item.purchaseDate ?? item.fechaCompra,
    expiryDate: item.expiryDate ?? item.fechaVencimiento,
    location: item.location ?? item.lugarCompra,
    details: item.details ?? item.otrosDetalles,
  }
}

export function runMigrations(): void {
  for (const key of ['mi-despensa-products', 'mi-despensa-shopping']) {
    try {
      const raw = localStorage.getItem(key)
      if (!raw) continue
      const items = JSON.parse(raw) as LegacyItem[]
      if (Array.isArray(items) && items.length > 0 && 'nombre' in items[0]) {
        localStorage.setItem(key, JSON.stringify(items.map(migrateItem)))
      }
    } catch {
      // datos corruptos, se ignoran
    }
  }

  migrateGuestShoppingListIds()
}

// Independent pass (unrelated to the ES→EN rename above): guest shopping
// items created before multiple shopping lists existed have no `listId`.
// Assign them to the guest General list so they still show up once the
// selector is in place.
function migrateGuestShoppingListIds(): void {
  const SHOPPING_KEY = 'guest_shopping'
  const GENERAL_LIST_ID = 'guest-general'
  try {
    const raw = localStorage.getItem(SHOPPING_KEY)
    if (!raw) return
    const items = JSON.parse(raw) as LegacyItem[]
    if (!Array.isArray(items)) return
    let changed = false
    const migrated = items.map((item) => {
      if (item.listId) return item
      changed = true
      return { ...item, listId: GENERAL_LIST_ID }
    })
    if (changed) localStorage.setItem(SHOPPING_KEY, JSON.stringify(migrated))
  } catch {
    // datos corruptos, se ignoran
  }
}
