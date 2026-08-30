import { describe, it, expect, beforeEach } from 'vitest'
import { runMigrations } from './migrations'

describe('runMigrations', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  it('migrates legacy Spanish-keyed products to English keys', () => {
    localStorage.setItem(
      'mi-despensa-products',
      JSON.stringify([
        { nombre: 'Leche', cantidad: '1L', marca: 'La Serenísima', fechaCompra: '2026-01-01', fechaVencimiento: '2026-02-01', lugarCompra: 'Heladera', otrosDetalles: '' },
      ])
    )

    runMigrations()

    const migrated = JSON.parse(localStorage.getItem('mi-despensa-products')!)
    expect(migrated[0]).toMatchObject({
      name: 'Leche',
      quantity: '1L',
      brand: 'La Serenísima',
      purchaseDate: '2026-01-01',
      expiryDate: '2026-02-01',
      location: 'Heladera',
      details: '',
    })
  })

  it('migrates the shopping list key too', () => {
    localStorage.setItem('mi-despensa-shopping', JSON.stringify([{ nombre: 'Arroz' }]))
    runMigrations()
    const migrated = JSON.parse(localStorage.getItem('mi-despensa-shopping')!)
    expect(migrated[0].name).toBe('Arroz')
  })

  it('leaves already-migrated (English-keyed) data untouched', () => {
    const data = [{ name: 'Leche', quantity: '1L' }]
    localStorage.setItem('mi-despensa-products', JSON.stringify(data))

    runMigrations()

    expect(JSON.parse(localStorage.getItem('mi-despensa-products')!)).toEqual(data)
  })

  it('does nothing when the key is absent', () => {
    expect(() => runMigrations()).not.toThrow()
    expect(localStorage.getItem('mi-despensa-products')).toBeNull()
  })

  it('silently ignores corrupt JSON', () => {
    localStorage.setItem('mi-despensa-products', 'not-json{')
    expect(() => runMigrations()).not.toThrow()
    expect(localStorage.getItem('mi-despensa-products')).toBe('not-json{')
  })
})
