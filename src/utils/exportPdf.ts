import { jsPDF } from 'jspdf'
import autoTable from 'jspdf-autotable'
import type { ShoppingListItem } from './types'

const PDF_COLUMNS: Array<{ key: keyof ShoppingListItem; header: string }> = [
  { key: 'name', header: 'Nombre' },
  { key: 'quantity', header: 'Cantidad' },
  { key: 'brand', header: 'Marca' },
  { key: 'location', header: 'Lugar de compra' },
]

// Builds the jsPDF document for a shopping list — pure aside from
// constructing a jsPDF instance, no DOM/download side effects. Kept separate
// from shoppingListToPdf so it's testable without triggering an actual
// browser/file-system save (jsPDF's save() writes straight to disk in
// Node-like test environments instead of prompting a download).
export function buildShoppingListPdf(items: ShoppingListItem[], listName: string): jsPDF {
  const doc = new jsPDF()

  doc.setFontSize(14)
  doc.text(listName, 14, 16)

  autoTable(doc, {
    startY: 22,
    head: [PDF_COLUMNS.map((c) => c.header)],
    body: items.map((item) => PDF_COLUMNS.map((c) => String(item[c.key] ?? ''))),
  })

  return doc
}

// Generates and triggers the download of a PDF with a table of the given
// shopping list items. Client-side only, no backend involved.
export function shoppingListToPdf(items: ShoppingListItem[], listName: string): void {
  const doc = buildShoppingListPdf(items, listName)
  const safeName = listName.trim().replace(/[^a-z0-9]+/gi, '_').toLowerCase() || 'lista'
  doc.save(`${safeName}.pdf`)
}
