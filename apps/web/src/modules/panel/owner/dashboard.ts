import type { OwnerDashboardDto } from '@ssb/shared'
import { formatNumber, formatRupiah } from '@/shared/lib'

type Tone = 'success' | 'danger' | 'warning' | 'neutral'
export interface Kpi {
  label: string
  value: string
  delta: string
  tone: Tone
}

const signed = (n: number) => `${n > 0 ? '+' : ''}${formatNumber(n)}`

/** Empat KPI layar O-Dashboard, dibanding periode yang sama bulan lalu */
export function buildKpis(k: OwnerDashboardDto['kpis']): Kpi[] {
  const revenueDelta =
    k.previousRevenue === 0
      ? { delta: 'Bulan lalu belum ada penjualan', tone: 'neutral' as Tone }
      : (() => {
          const pct = Math.round(((k.revenue - k.previousRevenue) / k.previousRevenue) * 1000) / 10
          return {
            delta: `${signed(pct)}% vs bulan lalu`,
            tone: (pct >= 0 ? 'success' : 'danger') as Tone,
          }
        })()
  const soldDiff = k.sold - k.previousSold
  return [
    { label: 'Pendapatan', value: formatRupiah(k.revenue), ...revenueDelta },
    {
      label: 'Sepatu terjual',
      value: formatNumber(k.sold),
      delta: `${signed(soldDiff)} vs bulan lalu`,
      tone: soldDiff > 0 ? 'success' : soldDiff < 0 ? 'danger' : 'neutral',
    },
    {
      label: 'Sepatu tersedia',
      value: formatNumber(k.available),
      delta: `+${formatNumber(k.newProducts)} masuk bulan ini`,
      tone: k.newProducts > 0 ? 'success' : 'neutral',
    },
    {
      label: 'Pesanan aktif',
      value: formatNumber(k.activeOrders),
      delta: `${formatNumber(k.awaitingVerification)} menunggu verifikasi`,
      tone: k.awaitingVerification > 0 ? 'warning' : 'neutral',
    },
  ]
}
