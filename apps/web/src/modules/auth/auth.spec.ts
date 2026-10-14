import type { AuthUserDto } from '@ssb/shared'
import { describe, expect, it } from 'vitest'
import type { RouteMeta } from 'vue-router'
import { homeForRole, landingFor, resolveAccess, safeRedirect } from './access'
import { passwordStrength, rules, validate } from './validation'

const user = (role: AuthUserDto['role']): AuthUserDto => ({
  id: 1,
  name: 'Rizky',
  email: 'r@x.test',
  phone: null,
  role,
})

describe('resolveAccess', () => {
  it('tamu yang membuka halaman ber-role diarahkan ke /masuk dengan redirect', () => {
    expect(resolveAccess({ roles: ['CUSTOMER'] }, null, '/pesanan?tab=unpaid')).toEqual({
      path: '/masuk',
      query: { redirect: '/pesanan?tab=unpaid' },
    })
  })

  it('role yang tidak cocok ke /403', () => {
    expect(resolveAccess({ roles: ['OWNER'] }, user('STAFF'), '/panel/owner/log')).toBe('/403')
    expect(resolveAccess({ roles: ['STAFF', 'OWNER'] }, user('CUSTOMER'), '/panel/dashboard')).toBe(
      '/403',
    )
  })

  it('yang sudah login tidak bisa membuka halaman tamu', () => {
    expect(resolveAccess({ guestOnly: true }, user('OWNER'), '/masuk')).toBe(
      '/panel/owner/dashboard',
    )
  })

  it('pintu masuk / membawa pegawai/owner ke panelnya; tamu dan customer tetap di Beranda', () => {
    expect(resolveAccess({ roleHome: true }, user('STAFF'), '/')).toBe('/panel/dashboard')
    expect(resolveAccess({ roleHome: true }, user('OWNER'), '/')).toBe('/panel/owner/dashboard')
    expect(resolveAccess({ roleHome: true }, user('CUSTOMER'), '/')).toBe(true)
    // ?query dan #hash tidak membuat customer dialihkan (Cara Belanja = /#cara-belanja)
    expect(resolveAccess({ roleHome: true }, user('CUSTOMER'), '/#cara-belanja')).toBe(true)
    expect(resolveAccess({ roleHome: true }, null, '/')).toBe(true)
    // halaman toko lain tetap bisa dibuka pegawai (mis. mengecek tampilan sepatu)
    expect(resolveAccess({}, user('STAFF'), '/katalog')).toBe(true)
  })

  it('pintu masuk /panel: pegawai ke dashboard, owner ke dashboard owner, customer 403, tamu ke Masuk', () => {
    const panel: RouteMeta = { roles: ['STAFF', 'OWNER'], roleHome: true }
    expect(resolveAccess(panel, user('STAFF'), '/panel')).toBe('/panel/dashboard')
    expect(resolveAccess(panel, user('OWNER'), '/panel')).toBe('/panel/owner/dashboard')
    expect(resolveAccess(panel, user('CUSTOMER'), '/panel')).toBe('/403')
    expect(resolveAccess(panel, null, '/panel')).toEqual({
      path: '/masuk',
      query: { redirect: '/panel' },
    })
  })

  it('halaman publik dan role yang cocok lolos', () => {
    expect(resolveAccess({}, null, '/katalog')).toBe(true)
    expect(resolveAccess({ roles: ['STAFF', 'OWNER'] }, user('OWNER'), '/panel/produk')).toBe(true)
  })

  it('halaman awal per role', () => {
    expect([homeForRole('CUSTOMER'), homeForRole('STAFF'), homeForRole('OWNER')]).toEqual([
      '/',
      '/panel/dashboard',
      '/panel/owner/dashboard',
    ])
  })
})

describe('safeRedirect', () => {
  it('hanya menerima path internal', () => {
    expect(safeRedirect('/pesanan/INV-1')).toBe('/pesanan/INV-1')
    for (const evil of [
      'https://jahat.test',
      '//jahat.test',
      '/\\jahat.test',
      'javascript:alert(1)',
      ['/x'],
      undefined,
    ]) {
      expect(safeRedirect(evil)).toBeNull()
    }
  })
})

describe('validasi form auth', () => {
  it('mengisi pesan per field dan menerima nomor dengan spasi', () => {
    const errors = { name: '', email: '', phone: '', password: '' }
    const ok = validate(
      { name: 'A', email: 'rizky@', phone: '0812 3456 7890', password: 'abc12' },
      rules,
      errors,
    )
    expect(ok).toBe(false)
    expect(errors).toEqual({
      name: 'Nama minimal 2 karakter',
      email: 'Format email belum benar, contoh: nama@gmail.com',
      phone: '',
      password: 'Password minimal 8 karakter.',
    })
  })

  it('meteran kekuatan password', () => {
    expect(passwordStrength('').score).toBe(0)
    expect(passwordStrength('abc').score).toBe(1)
    expect(passwordStrength('sepatuhijau').score).toBe(2)
    expect(passwordStrength('sepatuhijau43').score).toBe(3)
    expect(passwordStrength('Sepatu-Hijau-43').score).toBe(4)
  })
})

describe('landingFor', () => {
  // peta meta sebagian route asli
  const META: Record<string, RouteMeta> = {
    '/keranjang': { requiresAuth: true, roles: ['CUSTOMER'] },
    '/panel/verifikasi': { roles: ['STAFF', 'OWNER'] },
    '/panel/owner/log': { roles: ['OWNER'] },
    '/': { roleHome: true },
  }
  const metaOf = (path: string) => META[path.split('?')[0]!] ?? {}

  it('redirect yang boleh dibuka role ini dipakai', () => {
    expect(landingFor(user('CUSTOMER'), '/keranjang', metaOf)).toBe('/keranjang')
    expect(landingFor(user('STAFF'), '/panel/verifikasi?kode=INV-1', metaOf)).toBe(
      '/panel/verifikasi?kode=INV-1',
    )
  })

  it('redirect yang berujung 403 atau dialihkan diganti halaman awal role', () => {
    // tamu klik Keranjang lalu login sebagai pegawai
    expect(landingFor(user('STAFF'), '/keranjang', metaOf)).toBe('/panel/dashboard')
    expect(landingFor(user('STAFF'), '/panel/owner/log', metaOf)).toBe('/panel/dashboard')
    expect(landingFor(user('OWNER'), '/', metaOf)).toBe('/panel/owner/dashboard')
  })

  it('redirect tidak aman atau kosong diabaikan', () => {
    expect(landingFor(user('CUSTOMER'), 'https://penipu.example', metaOf)).toBe('/')
    expect(landingFor(user('OWNER'), undefined, metaOf)).toBe('/panel/owner/dashboard')
  })
})
