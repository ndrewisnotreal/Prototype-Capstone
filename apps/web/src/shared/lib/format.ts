// Satu-satunya tempat format uang dan waktu (aturan frontend). Uang selalu rupiah integer.
const rupiah = new Intl.NumberFormat('id-ID', {
  style: 'currency',
  currency: 'IDR',
  maximumFractionDigits: 0,
})

/** 300000 → "Rp 300.000" (spasi biasa, bukan non-breaking, supaya mudah dibandingkan dan dites) */
export const formatRupiah = (amount: number) => rupiah.format(amount).replace(/\s/g, ' ')

const DAY_MS = 24 * 60 * 60 * 1000
const jakartaDay = (d: Date) =>
  new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Jakarta' }).format(d)

/** "hari ini", "kemarin", "3 hari lalu" menurut tanggal WIB. */
export function formatRelativeDays(iso: string, now = new Date()): string {
  const days = Math.round(
    (Date.parse(jakartaDay(now)) - Date.parse(jakartaDay(new Date(iso)))) / DAY_MS,
  )
  if (days <= 0) return 'hari ini'
  if (days === 1) return 'kemarin'
  return `${days} hari lalu`
}

const dateFormat = new Intl.DateTimeFormat('id-ID', {
  day: 'numeric',
  month: 'short',
  year: 'numeric',
  timeZone: 'Asia/Jakarta',
})
/** "2026-10-09T..." → "9 Okt 2026" (WIB) */
export const formatDate = (iso: string) => dateFormat.format(new Date(iso))

/** 8.5 → "8,5" (desimal gaya Indonesia, untuk ukuran dan cm) */
export const formatNumber = (n: number) => n.toLocaleString('id-ID')

const dateTimeFormat = new Intl.DateTimeFormat('id-ID', {
  weekday: 'long',
  day: 'numeric',
  month: 'short',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
  timeZone: 'Asia/Jakarta',
})
/** "2026-10-12T07:32:00Z" → "Senin, 12 Okt 2026 pukul 14.32 WIB" */
export const formatDateTime = (iso: string) => {
  const parts = Object.fromEntries(
    dateTimeFormat.formatToParts(new Date(iso)).map((p) => [p.type, p.value]),
  )
  return `${parts.weekday}, ${parts.day} ${parts.month} ${parts.year} pukul ${parts.hour}.${parts.minute} WIB`
}

/** sisa milidetik → "23:59:12" (jam bisa lebih dari 24); negatif = "00:00:00" */
export function formatCountdown(ms: number): string {
  const t = Math.max(0, Math.floor(ms / 1000))
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${pad(Math.floor(t / 3600))}:${pad(Math.floor((t % 3600) / 60))}:${pad(t % 60)}`
}

const longDateFormat = new Intl.DateTimeFormat('id-ID', {
  weekday: 'long',
  day: 'numeric',
  month: 'long',
  year: 'numeric',
  timeZone: 'Asia/Jakarta',
})
/** "Minggu, 11 Oktober 2026" (WIB) */
export const formatLongDate = (d: Date | string) => longDateFormat.format(new Date(d))

/** "baru saja", "20 menit lalu", "13 jam lalu", "2 hari lalu" (antrean verifikasi) */
export function formatTimeAgo(iso: string, now = new Date()): string {
  const minutes = Math.floor((now.getTime() - Date.parse(iso)) / 60_000)
  if (minutes < 1) return 'baru saja'
  if (minutes < 60) return `${minutes} menit lalu`
  if (minutes < 24 * 60) return `${Math.floor(minutes / 60)} jam lalu`
  return `${Math.floor(minutes / (24 * 60))} hari lalu`
}

const timeFormat = new Intl.DateTimeFormat('id-ID', {
  hour: '2-digit',
  minute: '2-digit',
  timeZone: 'Asia/Jakarta',
})
/** "10.02" (WIB) */
export const formatTime = (iso: string) => timeFormat.format(new Date(iso))
