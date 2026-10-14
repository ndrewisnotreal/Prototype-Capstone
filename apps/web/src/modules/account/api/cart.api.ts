import type { CartDto } from '@ssb/shared'
import { http } from '@/shared/lib'

export const cartApi = {
  get: () => http.get<CartDto>('/cart'),
  add: (productId: number) => http.post<CartDto>('/cart/items', { productId }),
  remove: (productId: number) => http.delete<CartDto>(`/cart/items/${productId}`),
}
