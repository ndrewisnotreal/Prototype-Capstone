// Mode cadangan chatbot (tanpa AI): baca merek, ukuran, dan budget dari teks; cocokkan FAQ dengan kata kunci.

export interface ParsedQuery {
  brands: string[]
  sizes: number[]
  maxPrice?: number
  minPrice?: number
}

const MONEY = /(\d+(?:[.,]\d+)?)\s*(ribu|rb|k|jt|juta)\b|rp\.?\s*(\d{1,3}(?:[.,]\d{3})+|\d+)/gi
const toRupiah = (m: RegExpMatchArray) => {
  if (m[3]) return Number(m[3].replace(/[.,]/g, ''))
  const n = Number(m[1]!.replace(',', '.'))
  return Math.round(n * (/^(jt|juta)$/i.test(m[2]!) ? 1_000_000 : 1_000))
}

/** "ada Nike ukuran 42 di bawah 500 ribu?" → { brands: ['Nike'], sizes: [42], maxPrice: 500000 } */
export function parseQuery(text: string, knownBrands: string[]): ParsedQuery {
  const lower = text.toLowerCase()
  const brands = knownBrands.filter((b) =>
    new RegExp(
      `(^|[^a-z0-9])${b.toLowerCase().replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}([^a-z0-9]|$)`,
    ).test(lower),
  )

  const money = [...lower.matchAll(MONEY)]
  const prices = money.map(toRupiah)
  // angka harga dibuang dulu supaya "40 ribu" tidak terbaca ukuran 40
  const withoutMoney = money.reduce((s, m) => s.replace(m[0], ' '), lower)
  const sizes = [...withoutMoney.matchAll(/\b(3[5-9]|4[0-8])(?:[.,](5))?\b/g)].map((m) =>
    Number(`${m[1]}${m[2] ? '.5' : ''}`),
  )

  const result: ParsedQuery = { brands, sizes: [...new Set(sizes)] }
  if (prices.length) {
    if (/(di ?atas|lebih dari|minimal|min\.?)\s*(rp\.?\s*)?\d/.test(lower))
      result.minPrice = Math.min(...prices)
    else if (prices.length >= 2) {
      result.minPrice = Math.min(...prices)
      result.maxPrice = Math.max(...prices)
    } else result.maxPrice = prices[0]
  }
  return result
}

export const hasProductIntent = (q: ParsedQuery) =>
  q.brands.length > 0 || q.sizes.length > 0 || q.maxPrice !== undefined || q.minPrice !== undefined

const STOPWORDS = new Set(
  'apa apakah ada bisa saya aku kamu yang di ke dari dan atau untuk dengan ini itu kah gimana bagaimana berapa kapan mana kak min ya tidak nggak gak sudah belum mau'.split(
    ' ',
  ),
)
const words = (s: string) =>
  s
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter((w) => w.length > 2 && !STOPWORDS.has(w))

/** FAQ paling cocok (kata kunci bersama terbanyak, minimal 1), atau null */
export function bestFaq<T extends { question: string; answer: string }>(
  text: string,
  faqs: T[],
): T | null {
  const asked = new Set(words(text))
  let best: T | null = null
  let bestScore = 0
  for (const f of faqs) {
    const score = words(f.question).filter((w) => asked.has(w)).length
    if (score > bestScore) {
      best = f
      bestScore = score
    }
  }
  return best
}
