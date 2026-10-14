import { describe, expect, it } from 'vitest'
import { activeFilterCount, parseCatalogQuery, toRouteQuery } from './catalog-query'

describe('parseCatalogQuery', () => {
  it('membaca parameter berulang dan dipisah koma', () => {
    expect(
      parseCatalogQuery({
        brand: ['Nike', 'Adidas,Vans'],
        size: '42,43',
        condition: 'LIKE_NEW',
        minPrice: '100000',
        sort: 'price_asc',
        hideReserved: 'true',
        q: 'jordan',
      }),
    ).toEqual({
      category: [],
      brand: ['Nike', 'Adidas', 'Vans'],
      size: [42, 43],
      condition: ['LIKE_NEW'],
      minPrice: 100000,
      maxPrice: undefined,
      q: 'jordan',
      sort: 'price_asc',
      hideReserved: true,
    })
  })

  it('nilai rusak di URL diabaikan, tidak bikin error', () => {
    const f = parseCatalogQuery({ size: 'besar', condition: 'BAGUS', minPrice: '-5', sort: 'acak' })
    expect([f.size, f.condition, f.minPrice, f.sort]).toEqual([[], [], undefined, undefined])
  })
})

describe('toRouteQuery', () => {
  it('ringkas dan stabil: default/kosong tidak ditulis, daftar diurutkan', () => {
    expect(
      toRouteQuery({
        brand: ['Vans', 'Adidas'],
        size: [44, 40],
        category: [],
        sort: 'newest',
        q: '  ',
        hideReserved: undefined,
      }),
    ).toEqual({ brand: ['Adidas', 'Vans'], size: ['40', '44'] })
  })

  it('bolak-balik parse → query tetap sama', () => {
    const query = {
      category: ['running'],
      maxPrice: '500000',
      sort: 'price_desc',
      hideReserved: 'true',
    }
    expect(toRouteQuery(parseCatalogQuery(query))).toEqual(query)
  })
})

it('activeFilterCount tidak menghitung pencarian dan urutan', () => {
  expect(
    activeFilterCount({
      brand: ['Nike'],
      size: [42, 43],
      minPrice: 1,
      maxPrice: 2,
      q: 'x',
      sort: 'price_asc',
    }),
  ).toBe(4)
})
