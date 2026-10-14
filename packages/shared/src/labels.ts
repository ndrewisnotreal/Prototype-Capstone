import type {
  Condition,
  Fulfillment,
  OrderStatus,
  PaymentStatus,
  ProductStatus,
  ProofStatus,
  Role,
} from './enums.js'

// Kelompok warna badge status, mengikuti layar DS-Components (StatusBadge).
// outline = latar putih bergaris abu (Nonaktif, Belum Dibayar).
export type BadgeTone = 'success' | 'warning' | 'brand' | 'danger' | 'neutral' | 'outline'

export interface StatusLabel {
  label: string
  tone: BadgeTone
}

export const ROLE_LABELS: Record<Role, string> = {
  CUSTOMER: 'Customer',
  STAFF: 'Pegawai',
  OWNER: 'Owner',
}

export const PRODUCT_STATUS_LABELS: Record<ProductStatus, StatusLabel> = {
  AVAILABLE: { label: 'Tersedia', tone: 'success' },
  RESERVED: { label: 'Direservasi', tone: 'warning' },
  SOLD: { label: 'Terjual', tone: 'neutral' },
  INACTIVE: { label: 'Nonaktif', tone: 'outline' },
}

/** Label status sepatu untuk customer (ProductCard, detail produk). Panel memakai PRODUCT_STATUS_LABELS. */
export const PRODUCT_STATUS_CUSTOMER_LABELS: Record<ProductStatus, string> = {
  AVAILABLE: 'Tersedia',
  RESERVED: 'Sedang dipesan',
  SOLD: 'Terjual',
  INACTIVE: 'Tidak tersedia',
}

export const ORDER_STATUS_LABELS: Record<OrderStatus, StatusLabel> = {
  AWAITING_PAYMENT: { label: 'Menunggu Pembayaran', tone: 'warning' },
  AWAITING_VERIFICATION: { label: 'Menunggu Verifikasi', tone: 'warning' },
  PROCESSING: { label: 'Diproses', tone: 'brand' },
  READY_FOR_PICKUP: { label: 'Siap Diambil', tone: 'brand' },
  SHIPPED: { label: 'Dikirim', tone: 'brand' },
  COMPLETED: { label: 'Selesai', tone: 'success' },
  CANCELLED: { label: 'Dibatalkan', tone: 'danger' },
}

export const PAYMENT_STATUS_LABELS: Record<PaymentStatus, StatusLabel> = {
  UNPAID: { label: 'Belum Dibayar', tone: 'outline' },
  PENDING_VERIFICATION: { label: 'Menunggu Verifikasi', tone: 'warning' },
  VERIFIED: { label: 'Terverifikasi', tone: 'success' },
  REJECTED: { label: 'Ditolak', tone: 'danger' },
}

export const PROOF_STATUS_LABELS: Record<ProofStatus, StatusLabel> = {
  PENDING: { label: 'Menunggu Verifikasi', tone: 'warning' },
  ACCEPTED: { label: 'Diterima', tone: 'success' },
  REJECTED: { label: 'Ditolak', tone: 'danger' },
}

// Kondisi punya skema warna sendiri (ConditionBadge), jadi cukup label.
export const CONDITION_LABELS: Record<Condition, string> = {
  LIKE_NEW: 'Like New',
  VERY_GOOD: 'Sangat Baik',
  GOOD: 'Baik',
  FAIR: 'Layak Pakai',
}

export const FULFILLMENT_LABELS: Record<Fulfillment, string> = {
  PICKUP: 'Ambil di toko',
  SHIPPING: 'Kirim lewat ekspedisi',
}
