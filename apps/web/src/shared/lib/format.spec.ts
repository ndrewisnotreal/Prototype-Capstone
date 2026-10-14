import { describe, expect, it } from 'vitest'
import { formatCountdown, formatDateTime, formatRupiah, formatTimeAgo } from './format'

describe('format', () => {
  it('rupiah integer', () => expect(formatRupiah(620000)).toBe('Rp 620.000'))

  it('tanggal-jam selalu WIB, apa pun zona perangkat', () => {
    expect(formatDateTime('2026-10-12T07:32:00Z')).toBe('Senin, 12 Okt 2026 pukul 14.32 WIB')
    // lewat tengah malam WIB = sudah hari berikutnya
    expect(formatDateTime('2026-10-12T17:05:00Z')).toBe('Selasa, 13 Okt 2026 pukul 00.05 WIB')
  })

  it('hitung mundur jam:menit:detik, tidak pernah negatif', () => {
    expect(formatCountdown((23 * 3600 + 59 * 60 + 12) * 1000 + 999)).toBe('23:59:12')
    expect(formatCountdown(0)).toBe('00:00:00')
    expect(formatCountdown(-5000)).toBe('00:00:00')
  })

  it('waktu relatif untuk antrean', () => {
    const now = new Date('2026-10-12T10:00:00Z')
    expect(formatTimeAgo('2026-10-12T09:59:40Z', now)).toBe('baru saja')
    expect(formatTimeAgo('2026-10-12T09:40:00Z', now)).toBe('20 menit lalu')
    expect(formatTimeAgo('2026-10-11T21:00:00Z', now)).toBe('13 jam lalu')
    expect(formatTimeAgo('2026-10-10T09:00:00Z', now)).toBe('2 hari lalu')
  })
})
