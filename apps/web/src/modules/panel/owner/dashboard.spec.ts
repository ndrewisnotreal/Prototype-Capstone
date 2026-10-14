import { describe, expect, it } from 'vitest'
import { buildKpis } from './dashboard'

const base = {
  revenue: 14870000,
  previousRevenue: 12560000,
  sold: 47,
  previousSold: 50,
  available: 132,
  newProducts: 21,
  activeOrders: 16,
  awaitingVerification: 4,
}

describe('buildKpis', () => {
  it('persen pendapatan, selisih terjual, warna sesuai arah', () => {
    const [revenue, sold, available, active] = buildKpis(base)
    expect(revenue).toMatchObject({
      value: 'Rp 14.870.000',
      delta: '+18,4% vs bulan lalu',
      tone: 'success',
    })
    expect(sold).toMatchObject({ value: '47', delta: '-3 vs bulan lalu', tone: 'danger' })
    expect(available.delta).toBe('+21 masuk bulan ini')
    expect(active).toMatchObject({ delta: '4 menunggu verifikasi', tone: 'warning' })
  })

  it('bulan lalu kosong: tidak membagi dengan nol', () => {
    const [revenue] = buildKpis({ ...base, previousRevenue: 0 })
    expect(revenue).toMatchObject({ delta: 'Bulan lalu belum ada penjualan', tone: 'neutral' })
  })
})
