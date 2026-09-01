import { describe, it, expect } from 'vitest'
import { translateUnit } from './unitTranslations'

describe('translateUnit', () => {
  it('translates short-form units to Spanish when the language is Spanish', () => {
    expect(translateUnit('Tbsps', 'es')).toBe('cdas')
    expect(translateUnit('tsps', 'es')).toBe('cdtas')
    expect(translateUnit('servings', 'es')).toBe('porciones')
    expect(translateUnit('serving', 'es')).toBe('porción')
    expect(translateUnit('cloves', 'es')).toBe('dientes')
  })

  it('translates long-form units to Spanish when the language is Spanish', () => {
    expect(translateUnit('tablespoons', 'es')).toBe('cucharadas')
    expect(translateUnit('teaspoon', 'es')).toBe('cucharadita')
    expect(translateUnit('pounds', 'es')).toBe('libras')
  })

  it('is case-insensitive', () => {
    expect(translateUnit('TBSPS', 'es')).toBe('cdas')
    expect(translateUnit('Servings', 'es')).toBe('porciones')
  })

  it('passes an unmapped unit through unchanged', () => {
    expect(translateUnit('bunches', 'es')).toBe('bunches')
  })

  it('passes everything through unchanged for a non-Spanish language', () => {
    expect(translateUnit('Tbsps', 'en')).toBe('Tbsps')
    expect(translateUnit('servings', 'en')).toBe('servings')
  })

  it('leaves already-metric-friendly short units unchanged in either language', () => {
    expect(translateUnit('g', 'es')).toBe('g')
    expect(translateUnit('oz', 'en')).toBe('oz')
  })
})
