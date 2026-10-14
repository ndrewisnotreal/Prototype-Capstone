import { flushPromises, mount, RouterLinkStub } from '@vue/test-utils'
import { createPinia } from 'pinia'
import PrimeVue from 'primevue/config'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { shallowRef } from 'vue'
import type { OrderDetailDto } from '@ssb/shared'
import { ordersApi } from './api/orders.api'
import OrderDetailPage from './pages/OrderDetailPage.vue'

const confirm = vi.fn()
const notify = { success: vi.fn(), error: vi.fn(), info: vi.fn() }
vi.mock('vue-router', () => ({ useRoute: () => ({ params: { code: 'INV-1' } }) }))
vi.mock('./api/orders.api', () => ({ ordersApi: { detail: vi.fn(), cancel: vi.fn() } }))
vi.mock('@/modules/storefront', () => ({
  useStoreInfo: () => ({ info: shallowRef({ address: 'Jl. Toko, Medan', openingHours: [] }) }),
}))
vi.mock('@/shared/composables', async (orig) => ({
  ...(await orig<typeof import('@/shared/composables')>()),
  useConfirmAction: () => confirm,
  useNotify: () => notify,
}))

const base: OrderDetailDto = {
  code: 'INV-1',
  createdAt: '2026-10-11T03:00:00Z',
  status: 'AWAITING_PAYMENT',
  paymentStatus: 'UNPAID',
  fulfillment: 'PICKUP',
  total: 450000,
  itemCount: 1,
  thumbnails: [],
  itemNames: ['New Balance 550'],
  expiresAt: new Date(Date.now() + 3600_000).toISOString(),
  courier: null,
  trackingNumber: null,
  cancelReason: null,
  rejectReason: null,
  items: [
    {
      productCode: 'SSB-0151',
      brand: 'New Balance',
      model: '550',
      sizeEu: 41,
      condition: 'VERY_GOOD',
      price: 450000,
      photoUrl: null,
    },
  ],
  history: [
    {
      fromStatus: null,
      toStatus: 'AWAITING_PAYMENT',
      note: null,
      createdAt: '2026-10-11T03:00:00Z',
    },
  ],
  proofs: [],
  recipient: { name: 'Rina', phone: '0812' },
  shippingAddress: null,
}

async function mountPage(order: OrderDetailDto) {
  vi.mocked(ordersApi.detail).mockResolvedValue(order)
  const page = mount(OrderDetailPage, {
    global: { plugins: [createPinia(), PrimeVue], stubs: { RouterLink: RouterLinkStub } },
  })
  await flushPromises()
  return page
}

describe('OrderDetailPage', () => {
  beforeEach(() => vi.clearAllMocks())

  it('bukti ditolak: alasan, hitung mundur, dan tautan unggah ulang', async () => {
    const page = await mountPage({
      ...base,
      paymentStatus: 'REJECTED',
      rejectReason: 'Nominal kurang Rp 50.000',
    })
    expect(page.get('[role="alert"]').text()).toContain(
      'Alasan dari pegawai: Nominal kurang Rp 50.000',
    )
    expect(page.find('[role="timer"]').exists()).toBe(true)
    const links = page.findAllComponents(RouterLinkStub).map((l) => l.props('to'))
    expect(links).toContain('/pesanan/INV-1/upload-bukti')
    expect(links).not.toContain('/pesanan/INV-1/invoice') // invoice hanya setelah VERIFIED
  })

  it('batal hanya setelah konfirmasi; hasilnya langsung tampil', async () => {
    const page = await mountPage(base)
    const button = () => page.findAll('button').find((b) => b.text().includes('Batalkan pesanan'))!
    confirm.mockResolvedValueOnce(false)
    await button().trigger('click')
    await flushPromises()
    expect(ordersApi.cancel).not.toHaveBeenCalled()

    confirm.mockResolvedValueOnce(true)
    vi.mocked(ordersApi.cancel).mockResolvedValue({
      ...base,
      status: 'CANCELLED',
      cancelReason: 'Dibatalkan oleh customer',
      history: [
        ...base.history,
        {
          fromStatus: 'AWAITING_PAYMENT',
          toStatus: 'CANCELLED',
          note: 'Dibatalkan oleh customer',
          createdAt: '2026-10-11T04:00:00Z',
        },
      ],
    })
    await button().trigger('click')
    await flushPromises()
    expect(ordersApi.cancel).toHaveBeenCalledWith('INV-1')
    expect(page.text()).toContain('Dibatalkan')
    expect(page.findAll('button').some((b) => b.text().includes('Batalkan pesanan'))).toBe(false)
  })

  it('terverifikasi + dikirim: resi dan tombol invoice tampil', async () => {
    const page = await mountPage({
      ...base,
      status: 'SHIPPED',
      paymentStatus: 'VERIFIED',
      fulfillment: 'SHIPPING',
      courier: 'JNE REG',
      trackingNumber: 'JX123',
      shippingAddress: 'Jl. Sei Batang Hari No. 12',
    })
    expect(page.text()).toContain('JX123')
    expect(page.findAllComponents(RouterLinkStub).map((l) => l.props('to'))).toContain(
      '/pesanan/INV-1/invoice',
    )
  })
})
