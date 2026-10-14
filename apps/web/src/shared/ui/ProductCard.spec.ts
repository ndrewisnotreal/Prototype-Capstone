import { mount } from '@vue/test-utils'
import type { ProductCardDto } from '@ssb/shared'
import { describe, expect, it } from 'vitest'
import { formatDate, formatNumber, formatRelativeDays, formatRupiah } from '@/shared/lib/format'
import ProductCard from './ProductCard.vue'

const product = (over: Partial<ProductCardDto> = {}): ProductCardDto => ({
  code: 'SSB-0001',
  brand: 'Nike',
  model: 'Air Jordan 1 High',
  sizeEu: 43,
  condition: 'VERY_GOOD',
  price: 300000,
  status: 'AVAILABLE',
  primaryPhotoUrl: null,
  isNew: true,
  ...over,
})
const mountCard = (p: ProductCardDto) =>
  mount(ProductCard, {
    props: { product: p },
    global: { stubs: { RouterLink: { props: ['to'], template: '<a :href="to"><slot /></a>' } } },
  })

describe('ProductCard', () => {
  it('tersedia: tautan detail, harga rupiah, kondisi, badge Baru masuk', () => {
    const card = mountCard(product())
    expect(card.get('a').attributes('href')).toBe('/sepatu/SSB-0001')
    expect(card.get('a').attributes('aria-label')).toBe(
      'Nike Air Jordan 1 High, Rp 300.000, Tersedia',
    )
    expect(card.text()).toContain('EU 43 · Sangat Baik')
    expect(card.text()).toContain('Baru masuk')
  })

  it('direservasi memakai label customer "Sedang dipesan" dan tanpa badge Baru masuk', () => {
    const card = mountCard(product({ status: 'RESERVED' }))
    expect(card.text()).toContain('Sedang dipesan')
    expect(card.text()).not.toContain('Baru masuk')
  })

  it('foto memakai alt merek + model', () => {
    const card = mountCard(product({ primaryPhotoUrl: '/api/uploads/products/a.jpg' }))
    expect(card.get('img').attributes('alt')).toBe('Nike Air Jordan 1 High')
  })
})

describe('format', () => {
  it('formatRupiah', () => {
    expect(formatRupiah(300000)).toBe('Rp 300.000')
    expect(formatRupiah(1250000)).toBe('Rp 1.250.000')
  })

  it('formatDate (WIB) dan formatNumber (koma desimal)', () => {
    expect(formatDate('2026-10-08T18:30:00Z')).toBe('9 Okt 2026') // 01.30 WIB tanggal 9
    expect([formatNumber(8.5), formatNumber(43), formatNumber(27.5)]).toEqual(['8,5', '43', '27,5'])
  })

  it('formatRelativeDays memakai tanggal WIB', () => {
    const now = new Date('2026-10-11T03:00:00Z') // 10.00 WIB
    expect(formatRelativeDays('2026-10-10T20:00:00Z', now)).toBe('hari ini') // 03.00 WIB tgl 11
    expect(formatRelativeDays('2026-10-10T10:00:00Z', now)).toBe('kemarin')
    expect(formatRelativeDays('2026-10-08T10:00:00Z', now)).toBe('3 hari lalu')
  })
})
