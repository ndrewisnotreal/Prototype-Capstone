import {
  ORDER_STATUS_LABELS,
  PRODUCT_STATUS_LABELS,
  type ActivityLogDto,
  type OrderStatus,
  type ProductStatus,
} from '@ssb/shared'
import { formatLongDate, formatRupiah } from '@/shared/lib'

// Kalimat log aktivitas untuk dashboard owner dan layar O-Log: "<pelaku> <aksi> <objek>".
type Json = Record<string, unknown> | null | undefined
const field = (v: unknown, key: string) => (v as Json)?.[key]

/** Kode sepatu dibentuk dari id produk (business-rules: Kode) */
const productCode = (id: string) => `SSB-${id.padStart(4, '0')}`

export function describeActivity(log: ActivityLogDto): string {
  const id = log.entityId
  const after = log.after
  const before = log.before
  switch (log.action) {
    case 'PAYMENT_ACCEPTED':
      return `menerima pembayaran ${id}`
    case 'PAYMENT_REJECTED':
      return `menolak pembayaran ${id}`
    case 'ORDER_STATUS_CHANGED': {
      const status = field(after, 'status') as OrderStatus | undefined
      if (status === 'CANCELLED') return `membatalkan pesanan ${id}`
      return status
        ? `mengubah status ${id} ke ${ORDER_STATUS_LABELS[status].label}`
        : `mengubah status ${id}`
    }
    case 'PRODUCT_CREATED': {
      const model = field(after, 'model')
      return `menambah sepatu ${productCode(id)}${model ? ` ${String(model)}` : ''}`
    }
    case 'PRICE_CHANGED': {
      const from = field(before, 'price')
      const to = field(after, 'price')
      return typeof from === 'number' && typeof to === 'number'
        ? `mengubah harga ${productCode(id)} ${formatRupiah(from)} ke ${formatRupiah(to)}`
        : `mengubah harga ${productCode(id)}`
    }
    case 'PRODUCT_UPDATED':
      return `mengubah data sepatu ${productCode(id)}`
    case 'PRODUCT_STATUS_CHANGED': {
      const status = field(after, 'status') as ProductStatus | undefined
      return status
        ? `mengubah status ${productCode(id)} ke ${PRODUCT_STATUS_LABELS[status].label}`
        : `mengubah status ${productCode(id)}`
    }
    case 'PRODUCT_PHOTOS_CHANGED':
      return `mengubah foto ${productCode(id)}`
    case 'STAFF_CREATED':
      return `menambah pegawai ${String(field(after, 'name') ?? '')}`.trim()
    case 'USER_STATUS_CHANGED':
      return field(after, 'isActive') ? `mengaktifkan akun #${id}` : `menonaktifkan akun #${id}`
    case 'PASSWORD_RESET_SENT':
      return `mengirim tautan reset password ke akun #${id}`
    case 'SETTINGS_UPDATED':
      return 'memperbarui pengaturan toko'
    case 'BANK_ACCOUNT_CREATED':
      return `menambah rekening resmi ${String(field(after, 'bankName') ?? '')}`.trim()
    case 'BANK_ACCOUNT_UPDATED':
      return `memperbarui rekening resmi ${String(field(after, 'bankName') ?? '')}`.trim()
    case 'BANK_ACCOUNT_DELETED':
      return `menghapus rekening resmi ${String(field(before, 'bankName') ?? '')}`.trim()
    case 'FAQ_CHANGED':
      return 'memperbarui FAQ chatbot'
    default:
      return `${log.action.toLowerCase().replaceAll('_', ' ')} ${id}`
  }
}

/** Pilihan filter "Jenis aksi" layar O-Log */
export const ACTION_LABELS: Record<string, string> = {
  PRODUCT_CREATED: 'Tambah produk',
  PRICE_CHANGED: 'Ubah harga',
  PRODUCT_UPDATED: 'Ubah data produk',
  PRODUCT_STATUS_CHANGED: 'Ubah status produk',
  PRODUCT_PHOTOS_CHANGED: 'Ubah foto produk',
  PAYMENT_ACCEPTED: 'Terima pembayaran',
  PAYMENT_REJECTED: 'Tolak pembayaran',
  ORDER_STATUS_CHANGED: 'Ubah status pesanan',
  STAFF_CREATED: 'Tambah pegawai',
  USER_STATUS_CHANGED: 'Aktif/nonaktif akun',
  PASSWORD_RESET_SENT: 'Kirim reset password',
  SETTINGS_UPDATED: 'Ubah pengaturan',
  BANK_ACCOUNT_CREATED: 'Tambah rekening',
  BANK_ACCOUNT_UPDATED: 'Ubah rekening',
  BANK_ACCOUNT_DELETED: 'Hapus rekening',
  FAQ_CHANGED: 'Ubah FAQ',
}

/** Badge jenis di samping kalimat log */
export function activityKind(log: ActivityLogDto): string {
  if (log.action.startsWith('PAYMENT_')) return 'Verifikasi'
  if (log.action === 'PRICE_CHANGED') return 'Harga'
  return (
    {
      Order: 'Pesanan',
      Product: 'Produk',
      User: 'Akun',
      StoreSetting: 'Pengaturan',
      BankAccount: 'Pengaturan',
      Faq: 'Pengaturan',
    }[log.entityType] ?? log.entityType
  )
}

const wibDay = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Jakarta' })

/** Kelompokkan log (terbaru dulu) per tanggal WIB; hari ini diberi awalan "Hari ini" */
export function groupByDay(logs: ActivityLogDto[], now = new Date()) {
  const today = wibDay.format(now)
  const groups: { key: string; label: string; items: ActivityLogDto[] }[] = []
  for (const log of logs) {
    const key = wibDay.format(new Date(log.createdAt))
    let group = groups.at(-1)
    if (group?.key !== key) {
      const date = formatLongDate(log.createdAt)
      group = { key, label: key === today ? `Hari ini, ${date}` : date, items: [] }
      groups.push(group)
    }
    group.items.push(log)
  }
  return groups
}
