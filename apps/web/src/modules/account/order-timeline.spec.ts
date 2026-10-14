import { describe, expect, it } from 'vitest'
import type { OrderDetailDto, OrderHistoryDto } from '@ssb/shared'
import { buildTimeline, formatShortTime } from './order-timeline'

const h = (
  fromStatus: OrderHistoryDto['fromStatus'],
  toStatus: OrderHistoryDto['toStatus'],
  note: string | null = null,
): OrderHistoryDto => ({ fromStatus, toStatus, note, createdAt: '2026-10-03T03:12:00Z' })

const order = (over: Partial<OrderDetailDto>): OrderDetailDto =>
  ({
    status: 'AWAITING_PAYMENT',
    paymentStatus: 'UNPAID',
    fulfillment: 'PICKUP',
    courier: null,
    expiresAt: '2026-10-04T03:12:00Z',
    history: [h(null, 'AWAITING_PAYMENT')],
    ...over,
  }) as OrderDetailDto

const view = (o: OrderDetailDto) => buildTimeline(o).map((s) => `${s.state}:${s.label}`)

describe('buildTimeline', () => {
  it('waktu singkat WIB', () => {
    expect(formatShortTime('2026-10-03T03:12:00Z')).toBe('3 Okt, 10.12')
  })

  it('menunggu bayar: langkah berikutnya sesuai cara ambil', () => {
    const steps = buildTimeline(order({}))
    expect(steps.map((s) => `${s.state}:${s.label}`)).toEqual([
      'done:Pesanan dibuat',
      'current:Menunggu pembayaran',
      'todo:Pembayaran diverifikasi',
      'todo:Siap diambil',
      'todo:Selesai',
    ])
    expect(steps[1].note).toBe('Batas 4 Okt, 10.12')
  })

  it('bukti ditolak: kejadian tolak bertanda masalah, lalu menunggu bukti baru', () => {
    const o = order({
      paymentStatus: 'REJECTED',
      fulfillment: 'SHIPPING',
      history: [
        h(null, 'AWAITING_PAYMENT'),
        h('AWAITING_PAYMENT', 'AWAITING_VERIFICATION'),
        h('AWAITING_VERIFICATION', 'AWAITING_PAYMENT', 'Nominal kurang'),
      ],
    })
    expect(view(o)).toEqual([
      'done:Pesanan dibuat',
      'done:Bukti transfer diunggah',
      'problem:Bukti ditolak',
      'current:Menunggu bukti baru',
      'todo:Pembayaran diverifikasi',
      'todo:Dikirim',
      'todo:Selesai',
    ])
  })

  it('dikirim: posisi sekarang = kejadian terakhir, sisa hanya Selesai', () => {
    const o = order({
      status: 'SHIPPED',
      paymentStatus: 'VERIFIED',
      fulfillment: 'SHIPPING',
      courier: 'JNE REG',
      history: [
        h(null, 'AWAITING_PAYMENT'),
        h('AWAITING_PAYMENT', 'AWAITING_VERIFICATION'),
        h('AWAITING_VERIFICATION', 'PROCESSING'),
        h('PROCESSING', 'SHIPPED'),
      ],
    })
    expect(view(o)).toEqual([
      'done:Pesanan dibuat',
      'done:Bukti transfer diunggah',
      'done:Pembayaran diverifikasi',
      'current:Dikirim, JNE REG',
      'todo:Selesai',
    ])
  })

  it('dibatalkan dan selesai: tanpa langkah berikutnya', () => {
    const cancelled = order({
      status: 'CANCELLED',
      history: [h(null, 'AWAITING_PAYMENT'), h('AWAITING_PAYMENT', 'CANCELLED', 'Lewat batas')],
    })
    expect(view(cancelled)).toEqual(['done:Pesanan dibuat', 'problem:Dibatalkan'])
    expect(buildTimeline(cancelled)[1].note).toBe('Lewat batas')
  })
})
