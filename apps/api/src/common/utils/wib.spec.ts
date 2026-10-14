import { isoWeek, parseWibDate, toWibDate, wibParts, wibStart } from './wib.js'

describe('tanggal WIB', () => {
  it('awal hari WIB = 17.00 UTC hari sebelumnya', () => {
    expect(wibStart(2026, 9, 11).toISOString()).toBe('2026-10-10T17:00:00.000Z')
    expect(parseWibDate('2026-10-11').toISOString()).toBe('2026-10-10T17:00:00.000Z')
    // bulan/hari di luar rentang dinormalkan: 0 Oktober = 30 September
    expect(toWibDate(wibStart(2026, 9, 0))).toBe('2026-09-30')
  })

  it('jam 23.30 UTC sudah tanggal berikutnya di WIB', () => {
    const at = new Date('2026-10-11T23:30:00Z')
    expect(toWibDate(at)).toBe('2026-10-12')
    expect(wibParts(at)).toMatchObject({ month: 9, day: 12, weekday: 1 }) // Senin
  })

  it('minggu ISO', () => {
    expect(isoWeek(new Date('2026-10-11T05:00:00Z'))).toBe(41) // Minggu 11 Okt 2026
    expect(isoWeek(new Date('2026-10-12T05:00:00Z'))).toBe(42) // Senin 12 Okt 2026
    expect(isoWeek(new Date('2026-01-01T05:00:00Z'))).toBe(1)
    expect(isoWeek(new Date('2027-01-01T05:00:00Z'))).toBe(53) // Jumat, ikut minggu terakhir 2026
  })
})
