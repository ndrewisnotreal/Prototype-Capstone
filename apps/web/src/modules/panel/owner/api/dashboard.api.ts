import type { OwnerDashboardDto, ReportGranularity } from '@ssb/shared'
import { http } from '@/shared/lib'

export const ownerDashboardApi = {
  get: (granularity: ReportGranularity) =>
    http.get<OwnerDashboardDto>(`/owner/dashboard?granularity=${granularity}`),
}
