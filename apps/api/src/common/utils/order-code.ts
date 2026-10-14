// Kode pesanan INV-YYYYMMDD-NNNN, urut per hari menurut tanggal WIB (business-rules: Kode).
const wibDate = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Jakarta' })

/** "INV-20261011-" untuk tanggal WIB dari `at`. */
export const orderCodePrefix = (at: Date) => `INV-${wibDate.format(at).replaceAll('-', '')}-`

/** Kode berikutnya setelah kode terakhir hari itu (null = belum ada pesanan hari itu). */
export function nextOrderCode(at: Date, lastCodeToday: string | null): string {
  const n = lastCodeToday ? Number(lastCodeToday.slice(-4)) + 1 : 1
  return `${orderCodePrefix(at)}${String(n).padStart(4, '0')}`
}
