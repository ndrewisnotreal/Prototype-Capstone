import { flushPromises, mount, RouterLinkStub } from '@vue/test-utils'
import { createPinia } from 'pinia'
import PrimeVue from 'primevue/config'
import ToastService from 'primevue/toastservice'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { CartDto, CartItemDto } from '@ssb/shared'
import { cartApi } from './api/cart.api'
import CartPage from './pages/CartPage.vue'

vi.mock('./api/cart.api', () => ({ cartApi: { get: vi.fn(), add: vi.fn(), remove: vi.fn() } }))

const item = (productId: number, over: Partial<CartItemDto> = {}): CartItemDto => ({
  productId,
  code: `SSB-000${productId}`,
  brand: 'Nike',
  model: `Model ${productId}`,
  sizeEu: 42.5,
  condition: 'GOOD',
  price: 300000,
  status: 'AVAILABLE',
  primaryPhotoUrl: null,
  isNew: false,
  available: true,
  addedAt: '2026-10-11T00:00:00Z',
  ...over,
})
const cart = (items: CartItemDto[]): CartDto => {
  const ok = items.filter((i) => i.available)
  return { items, availableCount: ok.length, total: ok.reduce((a, i) => a + i.price, 0) }
}
const mountPage = async () => {
  const page = mount(CartPage, {
    global: {
      plugins: [createPinia(), PrimeVue, ToastService],
      stubs: { RouterLink: RouterLinkStub },
    },
  })
  await flushPromises()
  return page
}

describe('CartPage', () => {
  beforeEach(() => vi.clearAllMocks())

  it('sepatu yang sudah dipesan orang lain ditandai dan tidak ikut total', async () => {
    vi.mocked(cartApi.get).mockResolvedValue(
      cart([item(1), item(2, { available: false, status: 'RESERVED', price: 280000 })]),
    )
    const page = await mountPage()
    expect(page.get('[role="alert"]').text()).toContain('1 sepatu sudah tidak bisa dibeli.')
    expect(page.text()).toContain('Sedang dipesan orang lain')
    expect(page.find('.line-through').text()).toBe('Rp 280.000')
    expect(page.text()).toContain('Checkout 1 sepatu')
    expect(page.get('aside').text()).toContain('Rp 300.000')
  })

  it('hapus memakai keranjang terbaru dari server; kosong menampilkan ajakan ke katalog', async () => {
    vi.mocked(cartApi.get).mockResolvedValue(cart([item(1)]))
    vi.mocked(cartApi.remove).mockResolvedValue(cart([]))
    const page = await mountPage()
    await page.get('button[aria-label="Hapus Nike Model 1 dari keranjang"]').trigger('click')
    await flushPromises()
    expect(cartApi.remove).toHaveBeenCalledWith(1)
    expect(page.text()).toContain('Keranjang masih kosong')
  })

  it('gagal memuat: pesan dan tombol coba lagi', async () => {
    vi.mocked(cartApi.get).mockRejectedValueOnce(new Error('x')).mockResolvedValue(cart([]))
    const page = await mountPage()
    expect(page.text()).toContain('Keranjang gagal dimuat')
    await page.get('button').trigger('click')
    await flushPromises()
    expect(page.text()).toContain('Keranjang masih kosong')
  })
})
