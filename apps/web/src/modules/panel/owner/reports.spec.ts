import { describe, expect, it } from 'vitest'
import { exportUrl, quickRange, toDateParam } from './reports'

const today = new Date(2026, 9, 11) // 11 Okt 2026
const range = (r: Parameters<typeof quickRange>[0]) => {
  const { from, to } = quickRange(r, today)
  return [toDateParam(from), toDateParam(to)]
}

describe('rentang laporan', () => {
  it('rentang cepat inklusif, bulan lalu sampai hari terakhirnya', () => {
    expect(range('7d')).toEqual(['2026-10-05', '2026-10-11'])
    expect(range('thisMonth')).toEqual(['2026-10-01', '2026-10-11'])
    expect(range('lastMonth')).toEqual(['2026-09-01', '2026-09-30'])
    expect(range('thisYear')).toEqual(['2026-01-01', '2026-10-11'])
    expect(toDateParam(quickRange('lastMonth', new Date(2026, 0, 15)).from)).toBe('2025-12-01')
  })

  it('URL ekspor membawa filter yang sama', () => {
    expect(
      exportUrl('xlsx', { from: '2026-10-01', to: '2026-10-11', fulfillment: 'SHIPPING' }),
    ).toBe(
      '/api/owner/reports/sales/export?format=xlsx&from=2026-10-01&to=2026-10-11&fulfillment=SHIPPING',
    )
  })
})
