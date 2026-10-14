import type { OrderStatus, PaymentStatus, ProductStatus } from './enums.js'

// Transisi sah sesuai docs/business-rules.md. Syarat tambahan (fulfillment, peran, alasan wajib)
// dicek di service, bukan di sini.
export type TransitionTable<S extends string> = Readonly<Record<S, readonly S[]>>

export const PRODUCT_TRANSITIONS: TransitionTable<ProductStatus> = {
  AVAILABLE: ['RESERVED', 'INACTIVE'],
  RESERVED: ['AVAILABLE', 'SOLD'],
  SOLD: ['AVAILABLE'], // pesanan dibatalkan setelah VERIFIED, refund manual
  INACTIVE: ['AVAILABLE'],
}

export const ORDER_TRANSITIONS: TransitionTable<OrderStatus> = {
  AWAITING_PAYMENT: ['AWAITING_VERIFICATION', 'CANCELLED'],
  AWAITING_VERIFICATION: ['PROCESSING', 'AWAITING_PAYMENT', 'CANCELLED'],
  PROCESSING: ['READY_FOR_PICKUP', 'SHIPPED', 'CANCELLED'],
  READY_FOR_PICKUP: ['COMPLETED'],
  SHIPPED: ['COMPLETED'],
  COMPLETED: [],
  CANCELLED: [],
}

export const PAYMENT_TRANSITIONS: TransitionTable<PaymentStatus> = {
  UNPAID: ['PENDING_VERIFICATION'],
  PENDING_VERIFICATION: ['VERIFIED', 'REJECTED'],
  REJECTED: ['PENDING_VERIFICATION'],
  VERIFIED: [],
}

export class InvalidTransitionError extends Error {
  readonly code = 'INVALID_TRANSITION'
  constructor(
    readonly from: string,
    readonly to: string,
  ) {
    super(`Transisi status ${from} → ${to} tidak diizinkan`)
    this.name = 'InvalidTransitionError'
  }
}

export function canTransition<S extends string>(
  table: TransitionTable<S>,
  from: S,
  to: S,
): boolean {
  return table[from].includes(to)
}

export function assertTransition<S extends string>(
  table: TransitionTable<S>,
  from: S,
  to: S,
): void {
  if (!canTransition(table, from, to)) throw new InvalidTransitionError(from, to)
}
