import { nextOrderCode, orderCodePrefix } from './order-code.js'

describe('kode pesanan', () => {
  it('memakai tanggal WIB, bukan UTC', () => {
    // 20.00 UTC tanggal 10 = 03.00 WIB tanggal 11
    expect(orderCodePrefix(new Date('2026-10-10T20:00:00Z'))).toBe('INV-20261011-')
  })

  it('urut per hari, 4 digit', () => {
    const at = new Date('2026-10-11T03:00:00Z')
    expect(nextOrderCode(at, null)).toBe('INV-20261011-0001')
    expect(nextOrderCode(at, 'INV-20261011-0009')).toBe('INV-20261011-0010')
  })
})
