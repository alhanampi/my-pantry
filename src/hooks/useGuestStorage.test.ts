import { describe, it, expect, beforeEach, vi } from 'vitest'
import { guestStorage } from './useGuestStorage'
import type { ProductFormData, ShoppingListItem } from '../utils/types'

const productData: ProductFormData = {
  name: 'Leche',
  quantity: '1L',
  brand: '',
  purchaseDate: '',
  expiryDate: '',
  location: '',
  details: '',
}

const shoppingData: Omit<ShoppingListItem, 'id'> = { ...productData, purchased: false, listId: 'guest-general' }

describe('guestStorage', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  it('starts empty', () => {
    expect(guestStorage.getProducts()).toEqual([])
    expect(guestStorage.getShopping()).toEqual([])
  })

  it('creates, updates and deletes a product', () => {
    const created = guestStorage.createProduct(productData)
    expect(guestStorage.getProducts()).toEqual([created])

    const updated = guestStorage.updateProduct(created.id, { name: 'Leche descremada' })
    expect(updated.name).toBe('Leche descremada')
    expect(guestStorage.getProducts()).toEqual([updated])

    guestStorage.deleteProduct(created.id)
    expect(guestStorage.getProducts()).toEqual([])
  })

  it('creates, updates and deletes a shopping item', () => {
    const created = guestStorage.createShoppingItem(shoppingData)
    expect(guestStorage.getShopping()).toEqual([created])

    const updated = guestStorage.updateShoppingItem(created.id, { purchased: true })
    expect(updated.purchased).toBe(true)

    guestStorage.deleteShoppingItem(created.id)
    expect(guestStorage.getShopping()).toEqual([])
  })

  it('clearPurchased removes only purchased shopping items', () => {
    const nowSpy = vi.spyOn(Date, 'now')
    nowSpy.mockReturnValueOnce(10).mockReturnValueOnce(20)
    const kept = guestStorage.createShoppingItem(shoppingData)
    const purchased = guestStorage.createShoppingItem({ ...shoppingData, purchased: true })
    nowSpy.mockRestore()

    guestStorage.clearPurchased()

    const remaining = guestStorage.getShopping()
    expect(remaining).toEqual([kept])
    expect(remaining.find((i) => i.id === purchased.id)).toBeUndefined()
  })

  it('removeMigratedItems removes only the given ids from each list', () => {
    // ids are generated via Date.now(); force distinct values for consecutive calls.
    const nowSpy = vi.spyOn(Date, 'now')
    nowSpy.mockReturnValueOnce(1).mockReturnValueOnce(2).mockReturnValueOnce(3)

    const p1 = guestStorage.createProduct(productData)
    const p2 = guestStorage.createProduct(productData)
    const s1 = guestStorage.createShoppingItem(shoppingData)
    nowSpy.mockRestore()

    guestStorage.removeMigratedItems([p1.id], [s1.id])

    expect(guestStorage.getProducts()).toEqual([p2])
    expect(guestStorage.getShopping()).toEqual([])
  })

  it('clearAll wipes both lists', () => {
    guestStorage.createProduct(productData)
    guestStorage.createShoppingItem(shoppingData)

    guestStorage.clearAll()

    expect(guestStorage.getProducts()).toEqual([])
    expect(guestStorage.getShopping()).toEqual([])
  })

  it('returns an empty list when the stored value is corrupt JSON', () => {
    localStorage.setItem('guest_products', 'not-json{')
    expect(guestStorage.getProducts()).toEqual([])
  })

  it('starts with no favorite recipes, then adds/removes ids idempotently', () => {
    expect(guestStorage.getFavoriteIds()).toEqual([])

    expect(guestStorage.addFavorite(1)).toEqual([1])
    expect(guestStorage.addFavorite(2)).toEqual([1, 2])
    expect(guestStorage.addFavorite(1)).toEqual([1, 2]) // no duplicate
    expect(guestStorage.getFavoriteIds()).toEqual([1, 2])

    expect(guestStorage.removeFavorite(1)).toEqual([2])
    expect(guestStorage.removeFavorite(1)).toEqual([2]) // no-op, already gone
    expect(guestStorage.getFavoriteIds()).toEqual([2])
  })

  it('clearAll also wipes favorite recipes', () => {
    guestStorage.addFavorite(1)
    guestStorage.clearAll()
    expect(guestStorage.getFavoriteIds()).toEqual([])
  })

  it('starts with no explicit unit system, then remembers what is set', () => {
    expect(guestStorage.getUnitSystem()).toBeNull()
    guestStorage.setUnitSystem('imperial')
    expect(guestStorage.getUnitSystem()).toBe('imperial')
  })

  it('treats a corrupt/unexpected stored unit-system value as unset', () => {
    localStorage.setItem('guest_unit_system', 'bogus')
    expect(guestStorage.getUnitSystem()).toBeNull()
  })

  it('clearAll also wipes the unit-system preference', () => {
    guestStorage.setUnitSystem('metric')
    guestStorage.clearAll()
    expect(guestStorage.getUnitSystem()).toBeNull()
  })
})
