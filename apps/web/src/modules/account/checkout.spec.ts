import { flushPromises, mount, RouterLinkStub } from '@vue/test-utils'
import { createPinia } from 'pinia'
import PrimeVue from 'primevue/config'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { shallowRef } from 'vue'
import type { CartDto, CartItemDto } from '@ssb/shared'
import { ApiRequestError } from '@/shared/lib'
import { cartApi } from './api/cart.api'
import { ordersApi } from './api/orders.api'
import CheckoutPage from './pages/CheckoutPage.vue'

const replace = vi.fn()
const query: Record<string, string> = {}
vi.mock('vue-router', () => ({ useRoute: () => ({ query }), useRouter: () => ({ replace }) }))
vi.mock('./api/cart.api', () => ({ cartApi: { get: vi.fn() } }))
vi.mock('./api/orders.api', () => ({ ordersApi: { checkout: vi.fn() } }))
vi.mock('@/modules/storefront', () => ({
  paymentDeadlineHours: () => 24,
  useStoreInfo: () => ({
    info: shallowRef({
      address: 'Jl. Toko, Medan',
      openingHours: [],
      fulfillmentMethods: ['PICKUP', 'SHIPPING'],
      bankAccounts: [{ id: 1, bankName: 'BCA', accountNumber: '111', accountName: 'Suwandi' }],
    }),
  }),
}))

const item = (productId: number, over: Partial<CartItemDto> = {}): CartItemDto => ({
  productId,
  code: `SSB-000${productId}`,
  brand: 'Nike',
  model: `Model ${productId}`,
  sizeEu: 43,
  condition: 'GOOD',
  price: 300000,
  status: 'AVAILABLE',
  primaryPhotoUrl: null,
  isNew: false,
  available: true,
  addedAt: '2026-10-11T00:00:00Z',
  ...over,
})
const cart = (items: CartItemDto[]): CartDto => ({
  items,
  availableCount: items.filter((i) => i.available).length,
  total: 0,
})

async function fillAndSubmit() {
  const page = mount(CheckoutPage, {
    global: { plugins: [createPinia(), PrimeVue], stubs: { RouterLink: RouterLinkStub } },
  })
  await flushPromises()
  const [nameInput, phoneInput] = page.findAll('input[type="text"], input[type="tel"]')
  await nameInput.setValue('Rina')
  await phoneInput.setValue('0812-3456-7890')
  await page.get('#agree').setValue(true)
  await page.get('form').trigger('submit')
  await flushPromises()
  return page
}

describe('CheckoutPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    delete query.id
  })

  it('mengirim sepatu yang tersedia lalu pindah ke halaman bayar', async () => {
    vi.mocked(cartApi.get).mockResolvedValue(
      cart([item(1), item(2, { available: false, status: 'SOLD' })]),
    )
    vi.mocked(ordersApi.checkout).mockResolvedValue({ order: { code: 'INV-1' } as never })
    await fillAndSubmit()
    expect(ordersApi.checkout).toHaveBeenCalledWith({
      productIds: [1],
      fulfillment: 'PICKUP',
      recipientName: 'Rina',
      recipientPhone: '081234567890',
      shippingAddress: undefined,
      agree: true,
    })
    expect(replace).toHaveBeenCalledWith('/pesanan/INV-1/bayar')
  })

  it('bentrok 409: sepatu dicoret, total diperbarui, banner menyebut namanya', async () => {
    vi.mocked(cartApi.get)
      .mockResolvedValueOnce(cart([item(1), item(2, { price: 320000 })]))
      .mockResolvedValue(
        cart([item(1), item(2, { price: 320000, available: false, status: 'RESERVED' })]),
      )
    vi.mocked(ordersApi.checkout).mockRejectedValue(
      new ApiRequestError(409, 'PRODUCT_NOT_AVAILABLE', 'x', { unavailableProductIds: [2] }),
    )
    window.scrollTo = vi.fn()
    const page = await fillAndSubmit()
    expect(page.get('[role="alert"]').text()).toContain(
      'Maaf, Nike Model 2 baru saja dipesan orang lain.',
    )
    expect(page.get('aside').text()).toContain('Baru saja dipesan orang lain')
    expect(page.get('aside').text()).toContain('Total transferRp 300.000')
    expect(replace).not.toHaveBeenCalled()
  })

  it('?id= dari Beli Sekarang hanya membeli sepatu itu', async () => {
    query.id = '2'
    vi.mocked(cartApi.get).mockResolvedValue(cart([item(1), item(2)]))
    vi.mocked(ordersApi.checkout).mockResolvedValue({ order: { code: 'INV-2' } as never })
    await fillAndSubmit()
    expect(vi.mocked(ordersApi.checkout).mock.calls[0][0].productIds).toEqual([2])
  })
})
