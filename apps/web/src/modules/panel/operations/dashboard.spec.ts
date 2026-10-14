import { describe, expect, it } from 'vitest'
import type { DashboardOrderRowDto } from '@ssb/shared'
import { greeting, nextAction } from './dashboard'

const row = (over: Partial<DashboardOrderRowDto>) =>
  ({ code: 'INV-1', fulfillment: 'PICKUP', status: 'PROCESSING', ...over }) as DashboardOrderRowDto

describe('dashboard pegawai', () => {
  it('sapaan mengikuti jam WIB, bukan zona perangkat', () => {
    expect(greeting(new Date('2026-10-11T01:00:00Z'))).toBe('Selamat pagi') // 08.00 WIB
    expect(greeting(new Date('2026-10-11T06:00:00Z'))).toBe('Selamat siang') // 13.00 WIB
    expect(greeting(new Date('2026-10-11T09:30:00Z'))).toBe('Selamat sore') // 16.30 WIB
    expect(greeting(new Date('2026-10-11T13:00:00Z'))).toBe('Selamat malam') // 20.00 WIB
  })

  it('aksi berikutnya sesuai status dan cara ambil', () => {
    expect(nextAction(row({ status: 'AWAITING_VERIFICATION' }))).toEqual({
      label: 'Periksa bukti',
      to: '/panel/verifikasi?kode=INV-1',
    })
    expect(nextAction(row({ fulfillment: 'SHIPPING' })).label).toBe('Input resi')
    expect(nextAction(row({})).label).toBe('Tandai siap diambil')
    expect(nextAction(row({ status: 'READY_FOR_PICKUP' }))).toEqual({
      label: 'Tandai selesai',
      to: '/panel/pesanan?q=INV-1',
    })
  })
})
