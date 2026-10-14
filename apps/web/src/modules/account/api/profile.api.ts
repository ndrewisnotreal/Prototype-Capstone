import type { AddressDto, AuthUserDto } from '@ssb/shared'
import { http } from '@/shared/lib'

export interface AddressInput {
  label: string
  line: string
  city: string
  postalCode: string
}

export const profileApi = {
  update: (data: { name: string; phone: string }) =>
    http.patch<{ user: AuthUserDto }>('/me/profile', data),
  changePassword: (data: { currentPassword: string; newPassword: string }) =>
    http.post<void>('/me/change-password', data),
  addresses: () => http.get<AddressDto[]>('/me/addresses'),
  createAddress: (data: AddressInput) => http.post<AddressDto[]>('/me/addresses', data),
  updateAddress: (id: number, data: Partial<AddressInput> | { isPrimary: true }) =>
    http.patch<AddressDto[]>(`/me/addresses/${id}`, data),
  deleteAddress: (id: number) => http.delete<AddressDto[]>(`/me/addresses/${id}`),
}
