import { mount } from '@vue/test-utils'
import PrimeVue from 'primevue/config'
import { describe, expect, it } from 'vitest'
import AppDataTable from './AppDataTable.vue'

const mountTable = (props: Record<string, unknown>) =>
  mount(AppDataTable, {
    props: { rows: [], total: 0, page: 1, limit: 12, noun: 'sepatu', ...props },
    // DataTable/Column tidak diuji di sini: cukup state dan paginasi milik pembungkus
    global: { plugins: [PrimeVue], stubs: { DataTable: true, Skeleton: true } },
  })

describe('AppDataTable', () => {
  it('teks rentang dan tombol halaman sesuai posisi', async () => {
    const t = mountTable({ rows: [{ id: 1 }], total: 30, page: 2 })
    expect(t.text()).toContain('Menampilkan 13-24 dari 30 sepatu')
    const [prev, next] = t.findAll('button')
    await prev.trigger('click')
    await next.trigger('click')
    expect(t.emitted('update:page')).toEqual([[1], [3]])
  })

  it('halaman terakhir: tombol berikutnya nonaktif', () => {
    const t = mountTable({ rows: [{ id: 1 }], total: 30, page: 3 })
    expect(t.text()).toContain('Menampilkan 25-30 dari 30 sepatu')
    expect(t.findAll('button')[1].attributes('disabled')).toBeDefined()
  })

  it('error menampilkan pesan dan tombol coba lagi', async () => {
    const t = mountTable({ error: 'Koneksi terputus.' })
    expect(t.text()).toContain('Koneksi terputus.')
    await t.get('button').trigger('click')
    expect(t.emitted('retry')).toHaveLength(1)
  })

  it('kosong menampilkan judul empty state', () => {
    expect(mountTable({ emptyTitle: 'Belum ada sepatu di sini' }).text()).toContain(
      'Belum ada sepatu di sini',
    )
  })
})
