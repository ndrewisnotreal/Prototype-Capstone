import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import { createMemoryHistory, createRouter } from 'vue-router'
import AppSidebar from './AppSidebar.vue'

const mountAt = async (path: string, role: 'STAFF' | 'OWNER' = 'STAFF') => {
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [{ path: '/:p(.*)*', component: { template: '<div />' } }],
  })
  await router.push(path)
  return mount(AppSidebar, {
    props: { role, userName: 'Andi Lubis' },
    global: { plugins: [router] },
  })
}
const current = (w: Awaited<ReturnType<typeof mountAt>>) =>
  w.findAll('[aria-current="page"]').map((a) => a.text())

describe('AppSidebar', () => {
  it('hanya menu paling spesifik yang aktif', async () => {
    expect(current(await mountAt('/panel/produk/baru'))).toEqual(['Tambah produk'])
    expect(current(await mountAt('/panel/produk/12/edit'))).toEqual(['Daftar produk'])
  })

  it('pegawai tidak melihat menu owner', async () => {
    const staff = (await mountAt('/panel/dashboard')).text()
    expect(staff).not.toContain('Laporan penjualan')
    expect((await mountAt('/panel/owner/dashboard', 'OWNER')).text()).toContain('Laporan penjualan')
  })
})
