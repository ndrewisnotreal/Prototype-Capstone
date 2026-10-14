import type {
  Paginated,
  PanelOrderDetailDto,
  PanelOrderDto,
  PanelOrderTab,
  PanelOrderTabCounts,
} from '@ssb/shared'
import { http } from '@/shared/lib'

export const panelOrdersApi = {
  list: ({
    tab,
    q,
    page,
    limit,
  }: {
    tab: PanelOrderTab
    q: string
    page: number
    limit: number
  }) => {
    const p = new URLSearchParams({ tab, page: String(page), limit: String(limit) })
    if (q) p.set('q', q)
    return http.get<Paginated<PanelOrderDto>>(`/panel/orders?${p}`)
  },
  counts: () => http.get<PanelOrderTabCounts>('/panel/orders/counts'),
  detail: (code: string) => http.get<PanelOrderDetailDto>(`/panel/orders/${code}`),
  ready: (code: string) => http.post<PanelOrderDetailDto>(`/panel/orders/${code}/ready`),
  ship: (code: string, courier: string, trackingNumber: string) =>
    http.post<PanelOrderDetailDto>(`/panel/orders/${code}/ship`, { courier, trackingNumber }),
  complete: (code: string) => http.post<PanelOrderDetailDto>(`/panel/orders/${code}/complete`),
  cancel: (code: string, reason: string) =>
    http.post<PanelOrderDetailDto>(`/panel/orders/${code}/cancel`, { reason }),
}
