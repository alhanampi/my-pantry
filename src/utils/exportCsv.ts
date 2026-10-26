import type { Product } from './types'

const CSV_COLUMNS: Array<{ key: keyof Product; header: string }> = [
  { key: 'name', header: 'Nombre' },
  { key: 'quantity', header: 'Cantidad' },
  { key: 'brand', header: 'Marca' },
  { key: 'purchaseDate', header: 'Fecha de compra' },
  { key: 'expiryDate', header: 'Vencimiento' },
  { key: 'location', header: 'Lugar de compra' },
  { key: 'preferredStoreName', header: 'Tienda preferida' },
  { key: 'details', header: 'Detalles' },
]

// Escapes a single CSV field: wraps it in quotes (doubling any embedded
// quotes) whenever it contains a comma, quote, or newline — the RFC 4180
// cases where a bare value would otherwise break the row.
function escapeCsvField(value: string): string {
  if (/[",\n\r]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`
  }
  return value
}

// Pure serialization, no DOM — kept separate from downloadCsv so it's
// trivially testable.
export function productsToCsv(products: Product[]): string {
  const header = CSV_COLUMNS.map((c) => escapeCsvField(c.header)).join(',')
  const rows = products.map((product) =>
    CSV_COLUMNS.map((c) => escapeCsvField(String(product[c.key] ?? ''))).join(',')
  )
  return [header, ...rows].join('\r\n')
}

// Triggers a browser download of the given CSV content via a temporary
// anchor element — DOM-only, not unit tested.
export function downloadCsv(filename: string, csvContent: string): void {
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)
}
