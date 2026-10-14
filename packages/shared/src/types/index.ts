import type {
  Condition,
  Fulfillment,
  OrderStatus,
  PaymentStatus,
  ProductStatus,
  ProofStatus,
  Role,
} from '../enums.js'

// Bentuk respons API (docs/api.md). Uang = rupiah integer, waktu = string ISO 8601 (UTC).

export interface ApiError {
  statusCode: number
  code: string
  message: string
  details?: Record<string, unknown>
}

export interface Paginated<T> {
  data: T[]
  meta: { page: number; limit: number; total: number }
}

// Respons /auth/login, /auth/register, /auth/me: { user: AuthUserDto }
export interface AuthUserDto {
  id: number
  name: string
  email: string
  phone: string | null
  role: Role
}

export interface BrandDto {
  id: number
  name: string
}

export interface CategoryDto {
  id: number
  name: string
  slug: string
}

export type ProductSort = 'newest' | 'price_asc' | 'price_desc'

/** Query GET /products. Filter multi-pilih boleh diulang (?brand=Nike&brand=Adidas) atau dipisah koma. */
export interface ProductListQuery {
  brand?: string[]
  category?: string[]
  size?: number[]
  condition?: Condition[]
  minPrice?: number
  maxPrice?: number
  q?: string
  sort?: ProductSort
  hideReserved?: boolean
  page?: number
  limit?: number
}

export interface ProductCardDto {
  code: string
  brand: string
  model: string
  sizeEu: number
  condition: Condition
  price: number
  status: ProductStatus
  primaryPhotoUrl: string | null
  isNew: boolean
}

/** GET /products/recently-sold: kartu + waktu terjual (untuk "2 hari lalu") */
export interface RecentlySoldDto extends ProductCardDto {
  soldAt: string
}

export interface ProductPhotoDto {
  id: number
  url: string
  isPrimary: boolean
}

export interface ProductDetailDto extends ProductCardDto {
  /** dipakai POST /cart/items */
  id: number
  sizeUk: number | null
  sizeUs: number | null
  insoleCm: number | null
  defects: string[]
  hasBox: boolean
  hasOriginalInsole: boolean
  hasOriginalLaces: boolean
  description: string | null
  photos: ProductPhotoDto[]
  category: CategoryDto
  createdAt: string
}

/** Baris tabel panel produk (semua status) */
export interface PanelProductDto extends ProductCardDto {
  id: number
  createdAt: string
}

/** Detail untuk form edit panel: detail publik + id relasi untuk Select merek/kategori */
export interface PanelProductDetailDto extends ProductDetailDto {
  brandId: number
}

/** Tab di halaman Pesanan saya (GET /orders?tab=). processing = Diproses + Siap Diambil + Dikirim. */
export type OrderTab = 'all' | 'unpaid' | 'verifying' | 'processing' | 'completed' | 'cancelled'

/** Tab panel Kelola pesanan: delivering = siap diambil atau dikirim */
export type PanelOrderTab =
  'all' | 'unpaid' | 'processing' | 'delivering' | 'completed' | 'cancelled'
export type PanelOrderTabCounts = Record<PanelOrderTab, number>

/** Baris tabel panel pesanan */
export interface PanelOrderDto extends OrderSummaryDto {
  customerName: string
  recipient: { name: string; phone: string }
}

/** GET /panel/orders/:code */
export interface PanelOrderDetailDto extends OrderDetailDto {
  customer: { name: string; email: string; phone: string | null }
}

/** GET /panel/payments/pending: satu bukti di antrean verifikasi */
export interface PendingProofDto {
  id: number
  senderName: string
  senderBank: string
  amount: number
  createdAt: string
  order: {
    code: string
    total: number
    expiresAt: string
    itemNames: string[]
    customerName: string
    recipientPhone: string
  }
}

/** Baris "Perlu tindakan" / "Reservasi hampir habis" di dashboard pegawai (tanpa angka Rp, [KONFIRMASI] no. 6) */
export interface DashboardOrderRowDto {
  code: string
  status: OrderStatus
  paymentStatus: PaymentStatus
  fulfillment: Fulfillment
  itemNames: string[]
  customerName: string
  expiresAt: string
}

/** GET /panel/dashboard */
export interface StaffDashboardDto {
  counts: {
    awaitingVerification: number
    toProcess: number
    readyOrShipped: number
    expiringSoon: number
  }
  /** pesanan yang menunggu aksi pegawai, terlama dulu */
  actions: DashboardOrderRowDto[]
  /** belum dibayar dan habis dalam 2 jam, paling mendesak dulu */
  expiring: DashboardOrderRowDto[]
}

/** GET /me/addresses: alamat pengiriman customer, utama dulu */
export interface AddressDto {
  id: number
  label: string
  line: string
  city: string
  postalCode: string
  isPrimary: boolean
}

/** GET /orders/counts: jumlah pesanan per tab (angka di chip tab) */
export type OrderTabCounts = Record<OrderTab, number>

/** GET /orders/:code/payment-instructions */
export interface PaymentInstructionsDto {
  code: string
  status: OrderStatus
  paymentStatus: PaymentStatus
  total: number
  /** hitung mundur dari sini (waktu server), bukan jam perangkat */
  expiresAt: string
  bankAccounts: BankAccountDto[]
  /** alasan penolakan bukti terakhir, untuk layar unggah ulang */
  lastRejectReason: string | null
}

/** GET /orders/:code/invoice (hanya setelah VERIFIED) */
export interface InvoiceDto {
  code: string
  createdAt: string
  verifiedAt: string | null
  fulfillment: Fulfillment
  customer: { name: string; email: string }
  recipient: { name: string; phone: string }
  shippingAddress: string | null
  items: OrderItemDto[]
  total: number
  store: { address: string; whatsapp: string }
  /** bukti yang diterima: untuk kalimat "Dibayar via transfer ..., diverifikasi oleh ..." */
  payment: { senderBank: string; senderName: string; verifiedBy: string | null } | null
}

export interface CartItemDto extends ProductCardDto {
  productId: number
  /** false = sepatu sudah dipesan/terjual/nonaktif: ditandai di UI dan tidak ikut total */
  available: boolean
  addedAt: string
}

/** GET /cart. Keranjang tidak mereservasi; reservasi terjadi saat checkout. */
export interface CartDto {
  items: CartItemDto[]
  availableCount: number
  /** rupiah, hanya dari item yang masih tersedia */
  total: number
}

export interface BankAccountDto {
  id: number
  bankName: string
  accountNumber: string
  accountName: string
}

export interface OpeningHourDto {
  days: string
  hours: string
}

/** GET /store/official-channels: satu-satunya sumber rekening, WA, sosial, alamat, jam buka di UI. */
export interface OfficialChannelsDto {
  whatsapp: string
  instagram: string | null
  tiktok: string | null
  address: string
  openingHours: OpeningHourDto[]
  paymentDeadlineHours: number
  fulfillmentMethods: Fulfillment[]
  /** hanya rekening aktif, sesuai urutan owner */
  bankAccounts: BankAccountDto[]
  updatedAt: string
}

export interface OrderSummaryDto {
  code: string
  createdAt: string
  status: OrderStatus
  paymentStatus: PaymentStatus
  fulfillment: Fulfillment
  total: number
  itemCount: number
  thumbnails: string[]
  /** "Nike Air Jordan 1 High", urut seperti di pesanan */
  itemNames: string[]
  expiresAt: string
  courier: string | null
  trackingNumber: string | null
  cancelReason: string | null
  /** alasan penolakan bukti terakhir; terisi bila ada bukti yang ditolak */
  rejectReason: string | null
}

export interface OrderItemDto {
  productCode: string
  brand: string
  model: string
  sizeEu: number
  condition: Condition
  price: number
  photoUrl: string | null
}

export interface OrderHistoryDto {
  fromStatus: OrderStatus | null
  toStatus: OrderStatus
  note: string | null
  createdAt: string
}

// Tanpa URL file: bukti diambil lewat GET /files/payment-proofs/:id yang mengecek akses.
export interface PaymentProofDto {
  id: number
  senderName: string
  senderBank: string
  amount: number
  status: ProofStatus
  rejectReason: string | null
  createdAt: string
}

export interface OrderDetailDto extends OrderSummaryDto {
  items: OrderItemDto[]
  history: OrderHistoryDto[]
  proofs: PaymentProofDto[]
  recipient: { name: string; phone: string }
  shippingAddress: string | null
}

// ---------- Owner: dashboard, laporan, performa ----------
// Penjualan = pesanan dengan bukti ACCEPTED yang tidak dibatalkan, bertanggal waktu verifikasi.

export type ReportGranularity = 'day' | 'week' | 'month'
export type PerformancePeriod = '3m' | '6m' | 'ytd'

/** Satu baris activity log dengan nama pelaku (dashboard owner, layar Log) */
export interface ActivityLogDto {
  id: number
  actorName: string | null
  action: string
  entityType: string
  entityId: string
  before: unknown
  after: unknown
  createdAt: string
}

/** GET /owner/dashboard: bulan berjalan dibanding periode yang sama bulan lalu */
export interface OwnerDashboardDto {
  period: { from: string; to: string; previousFrom: string; previousTo: string }
  kpis: {
    /** rupiah */
    revenue: number
    previousRevenue: number
    sold: number
    previousSold: number
    available: number
    /** sepatu masuk katalog bulan ini */
    newProducts: number
    activeOrders: number
    awaitingVerification: number
  }
  chart: {
    granularity: ReportGranularity
    points: { label: string; from: string; revenue: number }[]
  }
  /** pesanan dibuat bulan ini, dikelompokkan seperti tab panel */
  statusCounts: {
    unpaid: number
    processing: number
    delivering: number
    completed: number
    cancelled: number
  }
  topBrands: { name: string; sold: number }[]
  sizes: { sizeEu: number; sold: number }[]
  recentActivity: ActivityLogDto[]
}

export interface SalesReportRowDto {
  verifiedAt: string
  code: string
  customerName: string
  itemNames: string[]
  fulfillment: Fulfillment
  verifiedBy: string | null
  total: number
}

/** GET /owner/reports/sales */
export interface SalesReportDto {
  /** tanggal WIB "YYYY-MM-DD", inklusif */
  from: string
  to: string
  fulfillment: Fulfillment | null
  summary: { revenue: number; transactions: number; itemsSold: number; averagePerItem: number }
  /** terbaru dulu */
  rows: SalesReportRowDto[]
}

/** GET /owner/reports/performance */
export interface ProductPerformanceDto {
  period: { from: string; to: string }
  sold: number
  /** hari dari masuk katalog sampai terjual, 1 desimal; null bila belum ada yang terjual */
  averageDaysToSell: number | null
  fastestCategory: { name: string; averageDays: number } | null
  byBrand: { name: string; sold: number; averagePrice: number; averageDays: number }[]
  byCategory: { name: string; sold: number; averageDays: number }[]
  bySize: { sizeEu: number; sold: number }[]
  /** sepatu Tersedia yang masuk lebih dari 30 hari lalu, terlama dulu */
  slowMoving: {
    total: number
    /** id untuk tautan ubah harga (/panel/produk/:id/edit) */
    items: {
      id: number
      code: string
      photoUrl: string | null
      name: string
      sizeEu: number
      price: number
      days: number
    }[]
  }
}

// ---------- Owner: akun, pengaturan, rekening, FAQ ----------

/** Baris layar O-Akun (pegawai dan customer) */
export interface OwnerUserDto {
  id: number
  name: string
  email: string
  phone: string | null
  role: Role
  isActive: boolean
  lastLoginAt: string | null
  createdAt: string
  /** jumlah pesanan (berarti untuk customer) */
  orderCount: number
}

/** GET/PUT /owner/settings */
export interface StoreSettingsDto {
  whatsapp: string
  instagram: string | null
  tiktok: string | null
  address: string
  openingHours: OpeningHourDto[]
  paymentDeadlineHours: number
  fulfillmentMethods: Fulfillment[]
  updatedAt: string
}

/** Rekening untuk owner, termasuk yang nonaktif */
export interface OwnerBankAccountDto extends BankAccountDto {
  isActive: boolean
  sortOrder: number
}

export interface FaqDto {
  id: number
  question: string
  answer: string
  sortOrder: number
  isActive: boolean
}

// ---------- Chatbot ----------

export interface ChatMessageDto {
  role: 'user' | 'assistant'
  text: string
}

/** POST /chat */
export interface ChatReplyDto {
  reply: string
  /** sepatu AVAILABLE hasil pencarian untuk kartu mini, maks 6 */
  products: ProductCardDto[]
  /** faq = mode cadangan (AI tidak tersedia/gagal): jawaban dari FAQ dan pencarian sederhana */
  mode: 'ai' | 'faq'
  /** pertanyaan FAQ yang bisa dipilih (chip/menu cadangan) */
  suggestions: string[]
}

/** GET /chat/faqs: FAQ aktif untuk chip saran dan menu cadangan */
export interface PublicFaqDto {
  id: number
  question: string
  answer: string
}
