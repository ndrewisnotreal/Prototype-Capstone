import type {
  Fulfillment,
  PerformancePeriod,
  ProductPerformanceDto,
  SalesReportDto,
} from '@ssb/shared'
import { http } from '@/shared/lib'
import { salesQuery } from '../reports'

export const reportsApi = {
  sales: (q: { from: string; to: string; fulfillment?: Fulfillment }) =>
    http.get<SalesReportDto>(`/owner/reports/sales?${salesQuery(q)}`),
  performance: (period: PerformancePeriod) =>
    http.get<ProductPerformanceDto>(`/owner/reports/performance?period=${period}`),
}
