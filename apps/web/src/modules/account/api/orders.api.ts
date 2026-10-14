import type {
  Fulfillment,
  InvoiceDto,
  OrderDetailDto,
  OrderSummaryDto,
  OrderTab,
  OrderTabCounts,
  Paginated,
  PaymentInstructionsDto,
} from '@ssb/shared'
import { http } from '@/shared/lib'

export interface CheckoutInput {
  productIds: number[]
  fulfillment: Fulfillment
  recipientName: string
  recipientPhone: string
  shippingAddress?: string
  agree: true
}

export const ordersApi = {
  checkout: (input: CheckoutInput) =>
    http.post<{ order: OrderSummaryDto }>('/orders/checkout', input),
  list: (tab: OrderTab, page: number) =>
    http.get<Paginated<OrderSummaryDto>>(`/orders?tab=${tab}&page=${page}&limit=10`),
  counts: () => http.get<OrderTabCounts>('/orders/counts'),
  cancel: (code: string) => http.post<OrderDetailDto>(`/orders/${code}/cancel`),
  invoice: (code: string) => http.get<InvoiceDto>(`/orders/${code}/invoice`),
  detail: (code: string) => http.get<OrderDetailDto>(`/orders/${code}`),
  paymentInstructions: (code: string) =>
    http.get<PaymentInstructionsDto>(`/orders/${code}/payment-instructions`),
  /** multipart: file, senderName, senderBank, amount */
  submitProof: (code: string, form: FormData) =>
    http.upload<OrderDetailDto>('POST', `/orders/${code}/payment-proofs`, form),
}
