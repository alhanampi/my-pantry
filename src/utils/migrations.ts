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
}
