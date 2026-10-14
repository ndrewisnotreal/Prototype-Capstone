import type { OrderDetailDto, OrderHistoryDto, OrderStatus } from '@ssb/shared'

export type StepState = 'done' | 'current' | 'todo' | 'problem'
export interface TimelineStep {
  label: string
  /** waktu kejadian (ISO) bila sudah terjadi */
  at: string | null
  /** keterangan tambahan: alasan, ekspedisi, "Batas ..." */
  note: string | null
  state: StepState
}

const shortTime = new Intl.DateTimeFormat('id-ID', {
  day: 'numeric',
  month: 'short',
  hour: '2-digit',
  minute: '2-digit',
  timeZone: 'Asia/Jakarta',
})
/** "3 Okt, 10.12" (WIB) untuk keterangan timeline */
export const formatShortTime = (iso: string) =>
  shortTime.format(new Date(iso)).replace(' pukul ', ', ')

function eventLabel(
  h: OrderHistoryDto,
  order: OrderDetailDto,
): { label: string; problem?: boolean } {
  if (h.fromStatus === null) return { label: 'Pesanan dibuat' }
  switch (h.toStatus) {
    case 'AWAITING_VERIFICATION':
      return { label: 'Bukti transfer diunggah' }
    case 'AWAITING_PAYMENT':
      return { label: 'Bukti ditolak', problem: true } // dari AWAITING_VERIFICATION
    case 'PROCESSING':
      return { label: 'Pembayaran diverifikasi' }
    case 'READY_FOR_PICKUP':
      return { label: 'Siap diambil' }
    case 'SHIPPED':
      return { label: order.courier ? `Dikirim, ${order.courier}` : 'Dikirim' }
    case 'COMPLETED':
      return { label: 'Selesai' }
    case 'CANCELLED':
      return { label: 'Dibatalkan', problem: true }
  }
}

/**
 * Timeline customer: kejadian nyata dari history, lalu langkah yang masih akan datang.
 * Verifikasi langsung memindahkan pesanan ke PROCESSING, jadi "diverifikasi" dan "diproses" satu langkah.
 */
export function buildTimeline(order: OrderDetailDto): TimelineStep[] {
  const steps: TimelineStep[] = order.history.map((h) => {
    const { label, problem } = eventLabel(h, order)
    return { label, at: h.createdAt, note: h.note, state: problem ? 'problem' : 'done' }
  })
  const finalStep = order.fulfillment === 'PICKUP' ? 'Siap diambil' : 'Dikirim'
  const doneNote =
    order.fulfillment === 'PICKUP' ? 'Setelah sepatu kamu ambil' : 'Setelah paket diterima'
  const ahead = (from: OrderStatus): TimelineStep[] => {
    const rest: [OrderStatus, string, string | null][] = [
      ['AWAITING_VERIFICATION', 'Bukti transfer diunggah', null],
      ['PROCESSING', 'Pembayaran diverifikasi', null],
      [order.fulfillment === 'PICKUP' ? 'READY_FOR_PICKUP' : 'SHIPPED', finalStep, null],
      ['COMPLETED', 'Selesai', doneNote],
    ]
    const sequence: OrderStatus[] = ['AWAITING_PAYMENT', ...rest.map((r) => r[0])]
    return rest
      .filter(([s]) => sequence.indexOf(s) > sequence.indexOf(from))
      .map(([, label, note]) => ({ label, at: null, note, state: 'todo' }))
  }

  switch (order.status) {
    case 'CANCELLED':
      return steps
    case 'COMPLETED':
      return steps
    case 'AWAITING_PAYMENT': {
      const label =
        order.paymentStatus === 'REJECTED' ? 'Menunggu bukti baru' : 'Menunggu pembayaran'
      const wait: TimelineStep = {
        label,
        at: null,
        note: `Batas ${formatShortTime(order.expiresAt)}`,
        state: 'current',
      }
      return [...steps, wait, ...ahead('AWAITING_VERIFICATION')]
    }
    default: {
      // langkah terakhir yang sudah terjadi = posisi sekarang
      const last = steps[steps.length - 1]
      if (last && last.state === 'done') last.state = 'current'
      if (order.status === 'AWAITING_VERIFICATION' && last)
        last.note ??= 'Menunggu pegawai memeriksa pembayaran'
      return [...steps, ...ahead(order.status)]
    }
  }
}
