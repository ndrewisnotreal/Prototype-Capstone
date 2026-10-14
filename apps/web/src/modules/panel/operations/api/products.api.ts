import type {
  BrandDto,
  CategoryDto,
  Paginated,
  PanelProductDetailDto,
  PanelProductDto,
  ProductSort,
  ProductStatus,
} from '@ssb/shared'
import { http } from '@/shared/lib'

export type StatusCounts = Record<'all' | ProductStatus, number>

/** Field form produk; angka opsional null = kosong. */
export interface ProductFormValues {
  brandId: number | null
  categoryId: number | null
  model: string
  sizeEu: number | null
  sizeUk: number | null
  sizeUs: number | null
  insoleCm: number | null
  condition: string
  defects: string
  hasBox: boolean
  hasOriginalInsole: boolean
  hasOriginalLaces: boolean
  price: number | null
  description: string
}

const qs = (params: Record<string, string | number | undefined>) => {
  const p = new URLSearchParams()
  for (const [k, v] of Object.entries(params)) if (v !== undefined && v !== '') p.set(k, String(v))
  const s = p.toString()
  return s ? `?${s}` : ''
}

export const panelProductsApi = {
  list: (q: {
    status?: ProductStatus
    q?: string
    sort?: ProductSort
    page: number
    limit: number
  }) => http.get<Paginated<PanelProductDto>>(`/panel/products${qs(q)}`),
  statusCounts: () => http.get<StatusCounts>('/panel/products/status-counts'),
  get: (id: number) => http.get<PanelProductDetailDto>(`/panel/products/${id}`),
  /** multipart: field + foto berurutan */
  create: (values: ProductFormValues, status: 'AVAILABLE' | 'INACTIVE', photos: File[]) => {
    const form = new FormData()
    for (const [k, v] of Object.entries(values)) form.append(k, v === null ? '' : String(v))
    form.append('status', status)
    for (const f of photos) form.append('photos', f)
    return http.upload<PanelProductDetailDto>('POST', '/panel/products', form)
  },
  update: (id: number, values: Partial<ProductFormValues>) =>
    http.patch<PanelProductDetailDto>(`/panel/products/${id}`, values),
  setStatus: (id: number, status: 'AVAILABLE' | 'INACTIVE') =>
    http.patch<PanelProductDetailDto>(`/panel/products/${id}/status`, { status }),
  addPhotos: (id: number, photos: File[]) => {
    const form = new FormData()
    for (const f of photos) form.append('photos', f)
    return http.upload<PanelProductDetailDto>('POST', `/panel/products/${id}/photos`, form)
  },
  reorderPhotos: (id: number, photoIds: number[], primaryPhotoId: number) =>
    http.patch<PanelProductDetailDto>(`/panel/products/${id}/photos`, { photoIds, primaryPhotoId }),
  removePhoto: (id: number, photoId: number) =>
    http.delete<PanelProductDetailDto>(`/panel/products/${id}/photos/${photoId}`),
  brands: () => http.get<BrandDto[]>('/catalog/brands'),
  categories: () => http.get<CategoryDto[]>('/catalog/categories'),
}
