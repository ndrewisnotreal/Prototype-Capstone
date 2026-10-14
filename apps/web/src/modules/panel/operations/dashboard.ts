import type { DashboardOrderRowDto } from '@ssb/shared'

/** "Selamat pagi" dst. menurut jam WIB */
export function greeting(now = new Date()): string {
  const hour = Number(
    new Intl.DateTimeFormat('en-GB', {
      hour: 'numeric',
      hour12: false,
      timeZone: 'Asia/Jakarta',
    }).format(now),
  )
  if (hour < 11) return 'Selamat pagi'
  if (hour < 15) return 'Selamat siang'
  if (hour < 18) return 'Selamat sore'
  return 'Selamat malam'
}

/** Aksi berikutnya untuk baris "Perlu tindakan": label tombol + tujuan */
export function nextAction(row: DashboardOrderRowDto): { label: string; to: string } {
  const order = `/panel/pesanan?q=${row.code}`
  switch (row.status) {
    case 'AWAITING_VERIFICATION':
      return { label: 'Periksa bukti', to: `/panel/verifikasi?kode=${row.code}` }
    case 'PROCESSING':
      return {
        label: row.fulfillment === 'SHIPPING' ? 'Input resi' : 'Tandai siap diambil',
        to: order,
      }
    case 'READY_FOR_PICKUP':
    case 'SHIPPED':
      return { label: 'Tandai selesai', to: order }
    default:
      return { label: 'Lihat pesanan', to: order }
  }
}
