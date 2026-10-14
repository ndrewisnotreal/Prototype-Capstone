import { describe, expect, it } from 'vitest'
import type { ActivityLogDto } from '@ssb/shared'
import { activityKind, describeActivity, groupByDay } from './activity'

const log = (over: Partial<ActivityLogDto>): ActivityLogDto => ({
  id: 1,
  actorName: 'Andi',
  action: 'PAYMENT_ACCEPTED',
  entityType: 'Order',
  entityId: 'INV-20261011-0009',
  before: null,
  after: null,
  createdAt: '2026-10-11T03:00:00Z',
  ...over,
})

describe('describeActivity', () => {
  it('pembayaran dan status pesanan', () => {
    expect(describeActivity(log({}))).toBe('menerima pembayaran INV-20261011-0009')
    expect(
      describeActivity(
        log({ action: 'ORDER_STATUS_CHANGED', after: { status: 'READY_FOR_PICKUP' } }),
      ),
    ).toBe('mengubah status INV-20261011-0009 ke Siap Diambil')
    expect(
      describeActivity(log({ action: 'ORDER_STATUS_CHANGED', after: { status: 'CANCELLED' } })),
    ).toBe('membatalkan pesanan INV-20261011-0009')
  })

  it('produk: kode dari id, harga lama ke baru', () => {
    expect(
      describeActivity(
        log({
          action: 'PRODUCT_CREATED',
          entityType: 'Product',
          entityId: '152',
          after: { model: 'Dunk Low' },
        }),
      ),
    ).toBe('menambah sepatu SSB-0152 Dunk Low')
    expect(
      describeActivity(
        log({
          action: 'PRICE_CHANGED',
          entityType: 'Product',
          entityId: '122',
          before: { price: 420000 },
          after: { price: 400000 },
        }),
      ),
    ).toBe('mengubah harga SSB-0122 Rp 420.000 ke Rp 400.000')
  })

  it('aksi tak dikenal tetap terbaca', () => {
    expect(describeActivity(log({ action: 'SOMETHING_NEW', entityId: 'X' }))).toBe(
      'something new X',
    )
  })
})

describe('groupByDay', () => {
  it('per tanggal WIB, hari ini diberi awalan', () => {
    const now = new Date('2026-10-11T05:00:00Z')
    const groups = groupByDay(
      [
        log({ id: 3, createdAt: '2026-10-11T03:00:00Z' }),
        log({ id: 2, createdAt: '2026-10-10T18:00:00Z' }), // 11 Okt 01.00 WIB
        log({ id: 1, createdAt: '2026-10-10T09:00:00Z' }),
      ],
      now,
    )
    expect(groups.map((g) => [g.label, g.items.map((i) => i.id)])).toEqual([
      ['Hari ini, Minggu, 11 Oktober 2026', [3, 2]],
      ['Sabtu, 10 Oktober 2026', [1]],
    ])
    expect(activityKind(log({}))).toBe('Verifikasi')
  })
})
