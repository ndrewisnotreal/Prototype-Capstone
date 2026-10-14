import type { OfficialChannelsDto } from '@ssb/shared'

/** Hanya digit; nomor Indonesia disamakan ke awalan 62 ("0812..", "+62 812..", "62812.." sama). */
export function normalizeNumber(input: string): string {
  const digits = input.replace(/\D/g, '')
  return digits.startsWith('0') ? `62${digits.slice(1)}` : digits
}

export type NumberCheck =
  | { kind: 'too-short' }
  | { kind: 'whatsapp' }
  | { kind: 'bank'; bankName: string }
  | { kind: 'unknown' }

/** Cocokkan nomor yang menghubungi customer dengan WA resmi dan rekening aktif. */
export function checkOfficialNumber(input: string, channels: OfficialChannelsDto): NumberCheck {
  const raw = input.replace(/\D/g, '')
  if (raw.length < 8) return { kind: 'too-short' }
  if (normalizeNumber(input) === normalizeNumber(channels.whatsapp)) return { kind: 'whatsapp' }
  // nomor rekening dibandingkan apa adanya (tanpa awalan 62)
  const bank = channels.bankAccounts.find((b) => b.accountNumber.replace(/\D/g, '') === raw)
  return bank ? { kind: 'bank', bankName: bank.bankName } : { kind: 'unknown' }
}

/** Nomor WA terlihat seperti nomor sungguhan (bukan placeholder seed "[isi oleh owner]"). */
export const isRealPhone = (wa: string) => normalizeNumber(wa).length >= 10

export const whatsappLink = (wa: string, text: string) =>
  `https://wa.me/${normalizeNumber(wa)}?text=${encodeURIComponent(text)}`

export const mapsLink = (address: string) =>
  `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}`
