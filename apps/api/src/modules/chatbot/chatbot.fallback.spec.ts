import { bestFaq, hasProductIntent, parseQuery } from './chatbot.fallback.js'

const BRANDS = ['Nike', 'Adidas', 'New Balance', 'Converse']

describe('parseQuery (mode cadangan)', () => {
  it('merek, ukuran, dan budget dari kalimat customer', () => {
    expect(parseQuery('ada Nike ukuran 42 di bawah 500 ribu?', BRANDS)).toEqual({
      brands: ['Nike'],
      sizes: [42],
      maxPrice: 500000,
    })
    expect(parseQuery('new balance 41,5 budget 1,2 jt', BRANDS)).toEqual({
      brands: ['New Balance'],
      sizes: [41.5],
      maxPrice: 1200000,
    })
  })

  it('angka harga tidak terbaca sebagai ukuran; rentang dan "di atas"', () => {
    expect(parseQuery('sepatu 40 ribu ada?', BRANDS)).toEqual({
      brands: [],
      sizes: [],
      maxPrice: 40000,
    })
    expect(parseQuery('antara Rp 300.000 dan 450rb', BRANDS)).toMatchObject({
      minPrice: 300000,
      maxPrice: 450000,
    })
    expect(parseQuery('di atas 600k', BRANDS)).toMatchObject({ minPrice: 600000 })
    expect(parseQuery('converses', BRANDS).brands).toEqual([]) // bukan kata utuh
  })

  it('pertanyaan umum bukan pencarian produk', () => {
    expect(hasProductIntent(parseQuery('jam buka toko kapan?', BRANDS))).toBe(false)
  })
})

describe('bestFaq', () => {
  const faqs = [
    { question: 'Bagaimana cara bayar?', answer: 'Transfer ke rekening resmi.' },
    { question: 'Jam buka toko kapan?', answer: 'Senin sampai Sabtu.' },
  ]
  it('kata kunci bersama terbanyak; tidak ada kecocokan = null', () => {
    expect(bestFaq('caranya bayar gimana kak', faqs)?.answer).toBe('Transfer ke rekening resmi.')
    expect(bestFaq('toko buka jam berapa', faqs)?.answer).toBe('Senin sampai Sabtu.')
    expect(bestFaq('halo', faqs)).toBeNull()
  })
})
