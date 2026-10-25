import { describe, it, expect } from 'vitest'
import { buildGeoHint } from './geoContext'

describe('buildGeoHint', () => {
  it('returns undefined when no location is given', () => {
    expect(buildGeoHint(undefined)).toBeUndefined()
  })

  it('returns undefined for malformed coordinates', () => {
    expect(buildGeoHint({ lat: NaN, lng: 10 })).toBeUndefined()
    expect(buildGeoHint({ lat: 10, lng: 'x' as unknown as number })).toBeUndefined()
  })

  it('builds a hint mentioning the rounded coordinates', () => {
    const hint = buildGeoHint({ lat: -34.6037, lng: -58.3816 })
    expect(hint).toContain('-34.6')
    expect(hint).toContain('-58.4')
    expect(hint).toMatch(/region/i)
  })
})
