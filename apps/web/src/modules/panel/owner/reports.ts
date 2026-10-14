import type { Fulfillment } from '@ssb/shared'

export type QuickRange = '7d' | 'thisMonth' | 'lastMonth' | 'thisYear'

const pad = (n: number) => String(n).padStart(2, '0')
/** Date (tanggal kalender di perangkat, = WIB untuk toko di Medan) → "YYYY-MM-DD" */
export const toDateParam = (d: Date) =>
  `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`

/** Rentang cepat layar O-Laporan, inklusif */
export function quickRange(range: QuickRange, today = new Date()): { from: Date; to: Date } {
  const y = today.getFullYear()
  const m = today.getMonth()
  const day = new Date(y, m, today.getDate())
  switch (range) {
    case '7d':
      return { from: new Date(y, m, today.getDate() - 6), to: day }
    case 'thisMonth':
      return { from: new Date(y, m, 1), to: day }
    case 'lastMonth':
      return { from: new Date(y, m - 1, 1), to: new Date(y, m, 0) }
    case 'thisYear':
      return { from: new Date(y, 0, 1), to: day }
  }
}

export function salesQuery(q: { from: string; to: string; fulfillment?: Fulfillment }) {
  const p = new URLSearchParams({ from: q.from, to: q.to })
  if (q.fulfillment) p.set('fulfillment', q.fulfillment)
  return p.toString()
}

/** Tautan unduh: cookie sesi ikut (satu origin), server mengirim Content-Disposition attachment */
export const exportUrl = (
  format: 'pdf' | 'xlsx',
  q: { from: string; to: string; fulfillment?: Fulfillment },
) => `/api/owner/reports/sales/export?format=${format}&${salesQuery(q)}`
