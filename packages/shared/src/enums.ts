// Nama nilai sama persis dengan enum Prisma (docs/database.md).
// Pola `const` + tipe union: bisa dipakai sebagai nilai (ProductStatus.AVAILABLE) dan sebagai tipe.

export const Role = { CUSTOMER: 'CUSTOMER', STAFF: 'STAFF', OWNER: 'OWNER' } as const
export type Role = (typeof Role)[keyof typeof Role]

export const ProductStatus = {
  AVAILABLE: 'AVAILABLE',
  RESERVED: 'RESERVED',
  SOLD: 'SOLD',
  INACTIVE: 'INACTIVE',
} as const
export type ProductStatus = (typeof ProductStatus)[keyof typeof ProductStatus]

export const Condition = {
  LIKE_NEW: 'LIKE_NEW',
  VERY_GOOD: 'VERY_GOOD',
  GOOD: 'GOOD',
  FAIR: 'FAIR',
} as const
export type Condition = (typeof Condition)[keyof typeof Condition]

export const OrderStatus = {
  AWAITING_PAYMENT: 'AWAITING_PAYMENT',
  AWAITING_VERIFICATION: 'AWAITING_VERIFICATION',
  PROCESSING: 'PROCESSING',
  READY_FOR_PICKUP: 'READY_FOR_PICKUP',
  SHIPPED: 'SHIPPED',
  COMPLETED: 'COMPLETED',
  CANCELLED: 'CANCELLED',
} as const
export type OrderStatus = (typeof OrderStatus)[keyof typeof OrderStatus]

export const PaymentStatus = {
  UNPAID: 'UNPAID',
  PENDING_VERIFICATION: 'PENDING_VERIFICATION',
  VERIFIED: 'VERIFIED',
  REJECTED: 'REJECTED',
} as const
export type PaymentStatus = (typeof PaymentStatus)[keyof typeof PaymentStatus]

export const ProofStatus = {
  PENDING: 'PENDING',
  ACCEPTED: 'ACCEPTED',
  REJECTED: 'REJECTED',
} as const
export type ProofStatus = (typeof ProofStatus)[keyof typeof ProofStatus]

export const Fulfillment = { PICKUP: 'PICKUP', SHIPPING: 'SHIPPING' } as const
export type Fulfillment = (typeof Fulfillment)[keyof typeof Fulfillment]
