import type { PanelOrderDetailDto, PendingProofDto } from '@ssb/shared'
import { http } from '@/shared/lib'

export const paymentsApi = {
  pending: () => http.get<PendingProofDto[]>('/panel/payments/pending'),
  accept: (proofId: number) => http.post<PanelOrderDetailDto>(`/panel/payments/${proofId}/accept`),
  reject: (proofId: number, reason: string) =>
    http.post<PanelOrderDetailDto>(`/panel/payments/${proofId}/reject`, { reason }),
}
