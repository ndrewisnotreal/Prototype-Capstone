import type { AuthUserDto } from '@ssb/shared'
import { http } from '@/shared/lib'

type UserResponse = { user: AuthUserDto }

export const authApi = {
  me: () => http.get<UserResponse>('/auth/me'),
  login: (body: { email: string; password: string }) =>
    http.post<UserResponse>('/auth/login', body),
  register: (body: { name: string; email: string; phone: string; password: string }) =>
    http.post<UserResponse>('/auth/register', body),
  logout: () => http.post<void>('/auth/logout'),
  forgotPassword: (email: string) =>
    http.post<{ message: string }>('/auth/forgot-password', { email }),
  resetPassword: (token: string, password: string) =>
    http.post<{ message: string }>('/auth/reset-password', { token, password }),
}
