import type {
  ActivityLogDto,
  AuthUserDto,
  FaqDto,
  OwnerBankAccountDto,
  OwnerUserDto,
  Paginated,
  StoreSettingsDto,
} from '@ssb/shared'
import { http } from '@/shared/lib'

export type StoreSettingsInput = Omit<StoreSettingsDto, 'updatedAt'>
export interface BankAccountInput {
  bankName: string
  accountNumber: string
  accountName: string
  isActive?: boolean
}
export interface FaqInput {
  question: string
  answer: string
  isActive?: boolean
}
export interface ActivityLogFilter {
  actorId?: number
  action?: string
  from?: string
  to?: string
  page: number
}

const query = (q: object) => {
  const p = new URLSearchParams()
  for (const [k, v] of Object.entries(q)) if (v !== undefined && v !== '') p.set(k, String(v))
  return p.toString()
}

export const ownerAdminApi = {
  users: (q: { role: 'STAFF' | 'CUSTOMER'; q?: string; page: number; limit: number }) =>
    http.get<Paginated<OwnerUserDto>>(`/owner/users?${query(q)}`),
  createStaff: (data: { name: string; email: string; phone: string }) =>
    http.post<AuthUserDto>('/owner/users/staff', data),
  setActive: (id: number, isActive: boolean) => http.patch(`/owner/users/${id}`, { isActive }),
  sendReset: (id: number) => http.post<void>(`/owner/users/${id}/reset-password`),

  activityLogs: (f: ActivityLogFilter) =>
    http.get<Paginated<ActivityLogDto>>(`/owner/activity-logs?${query({ ...f, limit: 30 })}`),

  settings: () => http.get<StoreSettingsDto>('/owner/settings'),
  saveSettings: (data: StoreSettingsInput) => http.put<StoreSettingsDto>('/owner/settings', data),

  bankAccounts: () => http.get<OwnerBankAccountDto[]>('/owner/bank-accounts'),
  createBankAccount: (data: BankAccountInput, password: string) =>
    http.post<OwnerBankAccountDto[]>('/owner/bank-accounts', { ...data, password }),
  updateBankAccount: (id: number, data: BankAccountInput, password: string) =>
    http.patch<OwnerBankAccountDto[]>(`/owner/bank-accounts/${id}`, { ...data, password }),
  deleteBankAccount: (id: number, password: string) =>
    http.delete<OwnerBankAccountDto[]>(`/owner/bank-accounts/${id}`, { password }),

  faqs: () => http.get<FaqDto[]>('/owner/faqs'),
  createFaq: (data: FaqInput) => http.post<FaqDto[]>('/owner/faqs', data),
  updateFaq: (id: number, data: FaqInput) => http.patch<FaqDto[]>(`/owner/faqs/${id}`, data),
  deleteFaq: (id: number) => http.delete<FaqDto[]>(`/owner/faqs/${id}`),
}
