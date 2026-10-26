import { describe, it, expect } from 'vitest'
import { productsToCsv } from './exportCsv'
import type { Product } from './types'

const product = (overrides: Partial<Product> = {}): Product => ({
  id: 1,
  name: 'Leche',
  quantity: '2',
  brand: 'La Serenísima',
  purchaseDate: '2026-01-01',
  expiryDate: '2026-02-01',
  location: 'Supermercado',
  preferredStoreName: '',
  details: '',
  ...overrides,
})

describe('productsToCsv', () => {
  it('returns just the header row for an empty list', () => {
    const csv = productsToCsv([])
    expect(csv).toBe('Nombre,Cantidad,Marca,Fecha de compra,Vencimiento,Lugar de compra,Tienda preferida,Detalles')
  })

  it('serializes a product into a comma-separated row in column order', () => {
    const csv = productsToCsv([product()])
    const lines = csv.split('\r\n')
    expect(lines).toHaveLength(2)
    expect(lines[1]).toBe('Leche,2,La Serenísima,2026-01-01,2026-02-01,Supermercado,,')
  })

  it('serializes multiple products, one row each', () => {
    const csv = productsToCsv([product({ id: 1, name: 'Leche' }), product({ id: 2, name: 'Pan' })])
    const lines = csv.split('\r\n')
    expect(lines).toHaveLength(3)
    expect(lines[1]).toContain('Leche')
    expect(lines[2]).toContain('Pan')
  })

  it('wraps a field containing a comma in quotes', () => {
    const csv = productsToCsv([product({ details: 'oferta, 2x1' })])
    expect(csv).toContain('"oferta, 2x1"')
  })

  it('escapes embedded quotes by doubling them', () => {
    const csv = productsToCsv([product({ details: 'marca "premium"' })])
    expect(csv).toContain('"marca ""premium"""')
  })

  it('wraps a field containing a newline in quotes', () => {
    const csv = productsToCsv([product({ details: 'linea1\nlinea2' })])
    expect(csv).toContain('"linea1\nlinea2"')
  })

  it('leaves plain fields unquoted', () => {
    const csv = productsToCsv([product({ name: 'Arroz' })])
    expect(csv.split('\r\n')[1]).toMatch(/^Arroz,/)
  })
})
