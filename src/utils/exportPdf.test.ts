import { describe, it, expect } from 'vitest'
import { buildShoppingListPdf } from './exportPdf'
import type { ShoppingListItem } from './types'

const item = (overrides: Partial<ShoppingListItem> = {}): ShoppingListItem => ({
  id: 1,
  name: 'Arroz',
  quantity: '1',
  brand: 'Gallo',
  purchaseDate: '',
  expiryDate: '',
  location: '',
  details: '',
  purchased: false,
  listId: 'list_1',
  ...overrides,
})

// jsPDF generates a binary document — these are smoke tests confirming the
// doc-building step runs without throwing, not content assertions. They
// deliberately don't call shoppingListToPdf/doc.save(), which triggers a
// real browser download (and, in test environments, writes straight to
// disk) — that side effect isn't unit-testable and isn't the point here.
describe('buildShoppingListPdf', () => {
  it('does not throw with an empty item list', () => {
    expect(() => buildShoppingListPdf([], 'General')).not.toThrow()
  })

  it('does not throw with a normal item list', () => {
    expect(() =>
      buildShoppingListPdf([item({ id: 1 }), item({ id: 2, name: 'Leche' })], 'General')
    ).not.toThrow()
  })

  it('does not throw with a list name containing special characters', () => {
    expect(() => buildShoppingListPdf([item()], 'Súper / Fin de semana!')).not.toThrow()
  })
})
