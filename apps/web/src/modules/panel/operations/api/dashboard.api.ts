import type { StaffDashboardDto } from '@ssb/shared'
import { http } from '@/shared/lib'

export const dashboardApi = {
  get: () => http.get<StaffDashboardDto>('/panel/dashboard'),
}
