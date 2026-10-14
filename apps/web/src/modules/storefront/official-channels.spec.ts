import type { OfficialChannelsDto } from '@ssb/shared'
import { describe, expect, it } from 'vitest'
import {
  checkOfficialNumber,
  isRealPhone,
  normalizeNumber,
  whatsappLink,
} from './official-channels'

const channels = {
  whatsapp: '+62 895-3837-13434',
  bankAccounts: [{ id: 1, bankName: 'BCA', accountNumber: '123 456 7890', accountName: 'Suwandi' }],
} as OfficialChannelsDto

describe('cek nomor kanal resmi', () => {
  it('format nomor WA apa pun dikenali sama', () => {
    for (const n of ['0895 3837 13434', '+62 895-3837-13434', '62895383713434']) {
      expect(checkOfficialNumber(n, channels)).toEqual({ kind: 'whatsapp' })
    }
    expect(normalizeNumber('0812-1')).toBe('628121')
  })

  it('nomor rekening resmi dikenali dengan nama banknya', () => {
    expect(checkOfficialNumber('1234567890', channels)).toEqual({ kind: 'bank', bankName: 'BCA' })
  })

  it('nomor lain = bukan kanal resmi, terlalu pendek = belum dinilai', () => {
    expect(checkOfficialNumber('0812 9988 7766', channels)).toEqual({ kind: 'unknown' })
    expect(checkOfficialNumber('0812', channels)).toEqual({ kind: 'too-short' })
  })

  it('placeholder seed tidak dianggap nomor asli; tautan WA memakai 62', () => {
    expect(isRealPhone('[isi oleh owner]')).toBe(false)
    expect(whatsappLink('0895 3837 13434', 'Halo')).toBe('https://wa.me/62895383713434?text=Halo')
  })
})
