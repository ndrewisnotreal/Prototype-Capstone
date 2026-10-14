// Batas periode laporan menurut kalender WIB (UTC+7, tanpa DST). Semua fungsi mengembalikan instant UTC biasa.
const WIB_OFFSET_MS = 7 * 60 * 60 * 1000
export const DAY_MS = 24 * 60 * 60 * 1000

/** Komponen tanggal WIB dari sebuah instant. `month` 0-11, `weekday` 0 = Minggu. */
export function wibParts(at: Date) {
  const w = new Date(at.getTime() + WIB_OFFSET_MS)
  return {
    year: w.getUTCFullYear(),
    month: w.getUTCMonth(),
    day: w.getUTCDate(),
    weekday: w.getUTCDay(),
  }
}

/** Awal hari WIB (00.00) untuk tanggal kalender; bulan/hari boleh di luar rentang (Date.UTC menormalkan). */
export const wibStart = (year: number, month: number, day = 1) =>
  new Date(Date.UTC(year, month, day) - WIB_OFFSET_MS)

/** "2026-10-11" (tanggal WIB) → awal hari itu */
export function parseWibDate(value: string): Date {
  const [y, m, d] = value.split('-').map(Number)
  return wibStart(y!, m! - 1, d!)
}

/** Instant → "2026-10-11" menurut tanggal WIB */
export function toWibDate(at: Date): string {
  const { year, month, day } = wibParts(at)
  return `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
}

/** Nomor minggu ISO-8601 (Senin awal minggu) dari tanggal WIB */
export function isoWeek(at: Date): number {
  const { year, month, day, weekday } = wibParts(at)
  // Kamis di minggu yang sama menentukan tahun ISO-nya
  const thursday = Date.UTC(year, month, day + 3 - ((weekday + 6) % 7))
  const yearStart = Date.UTC(new Date(thursday).getUTCFullYear(), 0, 1)
  return Math.ceil(((thursday - yearStart) / DAY_MS + 1) / 7)
}
