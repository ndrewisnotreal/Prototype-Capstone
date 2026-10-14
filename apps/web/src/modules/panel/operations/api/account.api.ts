import { http } from '@/shared/lib'

export const accountApi = {
  changePassword: (data: { currentPassword: string; newPassword: string }) =>
    http.post<void>('/panel/me/change-password', data),
}
