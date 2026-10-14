import type {
  BrandDto,
  CategoryDto,
  Paginated,
  ProductCardDto,
  ProductDetailDto,
  ProductListQuery,
  RecentlySoldDto,
} from '@ssb/shared'
import { http } from '@/shared/lib'

/** ProductListQuery → query string; array jadi parameter berulang (?brand=Nike&brand=Adidas). */
export function toSearchParams(query: ProductListQuery): string {
  const params = new URLSearchParams()
  for (const [key, value] of Object.entries(query)) {
    if (value === undefined || value === null || value === '') continue
    for (const v of Array.isArray(value) ? value : [value]) params.append(key, String(v))
  }
  const qs = params.toString()
  return qs ? `?${qs}` : ''
}

export const productsApi = {
  list: (query: ProductListQuery = {}) =>
    http.get<Paginated<ProductCardDto>>(`/products${toSearchParams(query)}`),
  detail: (code: string) => http.get<ProductDetailDto>(`/products/${encodeURIComponent(code)}`),
  similar: (code: string) =>
    http.get<ProductCardDto[]>(`/products/${encodeURIComponent(code)}/similar`),
  recentlySold: () => http.get<RecentlySoldDto[]>('/products/recently-sold'),
  brands: () => http.get<BrandDto[]>('/catalog/brands'),
  categories: () => http.get<CategoryDto[]>('/catalog/categories'),
}
