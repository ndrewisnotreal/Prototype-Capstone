import { flushPromises, mount, RouterLinkStub } from '@vue/test-utils'
import PrimeVue from 'primevue/config'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { PanelOrderDetailDto } from '@ssb/shared'
import { ApiRequestError } from '@/shared/lib'
import { panelOrdersApi } from './api/orders.api'
import OrderDrawer from './components/OrderDrawer.vue'

const confirm = vi.fn()
const notify = { success: vi.fn(), error: vi.fn(), info: vi.fn() }
vi.mock('./api/orders.api', () => ({
  panelOrdersApi: { ready: vi.fn(), ship: vi.fn(), complete: vi.fn(), cancel: vi.fn() },
}))
vi.mock('@/shared/composables', async (orig) => ({
  ...(await orig<typeof import('@/shared/composables')>()),
  useNotify: () => notify,
  useConfirmAction: () => confirm,
}))
// jsdom tidak punya matchMedia (dipakai Select PrimeVue)
window.matchMedia = vi.fn(() => ({
  matches: false,
  addEventListener: vi.fn(),
  removeEventListener: vi.fn(),
})) as unknown as typeof window.matchMedia

const order = (over: Partial<PanelOrderDetailDto> = {}) =>
  ({
    code: 'INV-1',
    status: 'PROCESSING',
    paymentStatus: 'VERIFIED',
    fulfillment: 'PICKUP',
    total: 300000,
    courier: null,
    trackingNumber: null,
    cancelReason: null,
    shippingAddress: null,
    recipient: { name: 'Rina', phone: '0812' },
    customer: { name: 'Rina', email: 'rina@mail.test', phone: null },
    items: [{ productCode: 'SSB-1', brand: 'Nike', model: 'Kobe', sizeEu: 43 }],
    ...over,
  }) as PanelOrderDetailDto

const mountDrawer = (o: PanelOrderDetailDto) =>
  mount(OrderDrawer, {
    props: { order: o },
    global: { plugins: [PrimeVue], stubs: { RouterLink: RouterLinkStub } },
  })
const labels = (w: ReturnType<typeof mountDrawer>) =>
  w
    .findAll('button')
    .map((b) => b.text())
    .filter(Boolean)

describe('OrderDrawer', () => {
  beforeEach(() => vi.clearAllMocks())

  it('aksi mengikuti status dan cara ambil', () => {
    expect(labels(mountDrawer(order()))).toContain('Tandai Siap Diambil')
    expect(labels(mountDrawer(order({ fulfillment: 'SHIPPING' })))).toContain(
      'Simpan resi, tandai Dikirim',
    )
    expect(labels(mountDrawer(order({ status: 'SHIPPED', fulfillment: 'SHIPPING' })))).toContain(
      'Tandai Selesai',
    )
    const done = mountDrawer(order({ status: 'COMPLETED' }))
    expect(done.text()).toContain('Tidak ada aksi untuk status ini.')
    expect(done.text()).not.toContain('Batalkan pesanan') // selesai tidak bisa dibatalkan
    const verifying = mountDrawer(
      order({ status: 'AWAITING_VERIFICATION', paymentStatus: 'PENDING_VERIFICATION' }),
    )
    expect(verifying.findComponent(RouterLinkStub).props('to')).toBe('/panel/verifikasi?kode=INV-1')
  })

  it('resi wajib valid sebelum dikirim; hasil diteruskan ke halaman', async () => {
    const w = mountDrawer(order({ fulfillment: 'SHIPPING' }))
    await w.get('form').trigger('submit')
    expect(panelOrdersApi.ship).not.toHaveBeenCalled()
    expect(w.text()).toContain('Nomor resi 6 sampai 40 huruf/angka')
    const shipped = order({
      status: 'SHIPPED',
      fulfillment: 'SHIPPING',
      trackingNumber: 'JX1234567890',
    })
    vi.mocked(panelOrdersApi.ship).mockResolvedValue(shipped)
    await w.get('input[placeholder="Contoh: JX1234567890"]').setValue('JX1234567890')
    await w.get('form').trigger('submit')
    await flushPromises()
    expect(panelOrdersApi.ship).toHaveBeenCalledWith('INV-1', 'JNE REG', 'JX1234567890')
    expect(w.emitted('changed')?.[0]).toEqual([shipped])
  })

  it('batal: alasan minimal 10 karakter dan konfirmasi; 409 meminta data terbaru', async () => {
    const w = mountDrawer(order())
    const cancelButton = () => w.findAll('button').find((b) => b.text() === 'Batalkan pesanan')!
    await cancelButton().trigger('click')
    expect(confirm).not.toHaveBeenCalled()
    expect(w.text()).toContain('Tulis alasan minimal 10 karakter')

    await w.get('textarea').setValue('Customer minta batal lewat WA')
    confirm.mockResolvedValueOnce(true)
    vi.mocked(panelOrdersApi.cancel).mockRejectedValue(
      new ApiRequestError(409, 'ORDER_CHANGED', 'Status pesanan baru saja berubah.'),
    )
    await cancelButton().trigger('click')
    await flushPromises()
    expect(panelOrdersApi.cancel).toHaveBeenCalledWith('INV-1', 'Customer minta batal lewat WA')
    expect(w.emitted('stale')).toHaveLength(1)
  })
})
