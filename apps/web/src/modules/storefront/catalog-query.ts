import { Condition, type ProductListQuery, type ProductSort } from '@ssb/shared'
import type { LocationQuery, LocationQueryRaw } from 'vue-router'

// Filter katalog disimpan di URL (bisa dibagikan, tombol Back bekerja). Dua fungsi murni ini menjaga bentuknya.
export type CatalogFilters = Omit<ProductListQuery, 'page' | 'limit'>

const SORTS: ProductSort[] = ['newest', 'price_asc', 'price_desc']
const CONDITIONS = Object.values(Condition)

const list = (v: LocationQuery[string]) =>
  (Array.isArray(v) ? v : [v])
    .flatMap((x) => (x ?? '').split(','))
    .map((x) => x.trim())
    .filter(Boolean)
const one = (v: LocationQuery[string]) => list(v)[0]
const price = (v: LocationQuery[string]) => {
  const n = Number(one(v))
  return Number.isInteger(n) && n >= 0 ? n : undefined
}

/** route.query → filter yang valid. Nilai rusak di URL diabaikan, bukan bikin halaman error. */
export function parseCatalogQuery(q: LocationQuery): CatalogFilters {
  const sort = one(q.sort) as ProductSort | undefined
  return {
    category: list(q.category),
    brand: list(q.brand),
    size: list(q.size)
      .map(Number)
      .filter((n) => Number.isFinite(n) && n > 0),
    condition: list(q.condition).filter((c): c is Condition => CONDITIONS.includes(c as Condition)),
    minPrice: price(q.minPrice),
    maxPrice: price(q.maxPrice),
    q: one(q.q),
    sort: sort && SORTS.includes(sort) ? sort : undefined,
    hideReserved: one(q.hideReserved) === 'true' || undefined,
  }
}

/** filter → route.query ringkas: nilai kosong/default tidak ditulis, daftar diurutkan supaya URL stabil. */
export function toRouteQuery(f: CatalogFilters): LocationQueryRaw {
  const out: LocationQueryRaw = {}
  for (const key of ['category', 'brand', 'condition'] as const) {
    if (f[key]?.length) out[key] = [...f[key]].sort()
  }
  if (f.size?.length) out.size = [...f.size].sort((a, b) => a - b).map(String)
  if (f.minPrice !== undefined) out.minPrice = String(f.minPrice)
  if (f.maxPrice !== undefined) out.maxPrice = String(f.maxPrice)
  if (f.q?.trim()) out.q = f.q.trim()
  if (f.sort && f.sort !== 'newest') out.sort = f.sort
  if (f.hideReserved) out.hideReserved = 'true'
  return out
}

/** Jumlah filter aktif untuk tombol "Filter (n)" di ponsel (q dan sort tidak dihitung). */
export const activeFilterCount = (f: CatalogFilters) =>
  (f.category?.length ?? 0) +
  (f.brand?.length ?? 0) +
  (f.size?.length ?? 0) +
  (f.condition?.length ?? 0) +
  (f.minPrice !== undefined || f.maxPrice !== undefined ? 1 : 0) +
  (f.hideReserved ? 1 : 0)
