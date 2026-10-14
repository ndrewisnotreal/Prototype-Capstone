import { flushPromises, mount } from '@vue/test-utils'
import { createPinia } from 'pinia'
import PrimeVue from 'primevue/config'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { InvoiceDto } from '@ssb/shared'
import { ApiRequestError } from '@/shared/lib'
import { ordersApi } from './api/orders.api'
import InvoicePage from './pages/InvoicePage.vue'

vi.mock('vue-router', () => ({
  useRoute: () => ({ params: { code: 'INV-20260921-0011' } }),
  useRouter: () => ({ push: vi.fn(), back: vi.fn() }),
}))
vi.mock('./api/orders.api', () => ({ ordersApi: { invoice: vi.fn() } }))

const invoice: InvoiceDto = {
  code: 'INV-20260921-0011',
  createdAt: '2026-09-21T07:00:00Z',
  verifiedAt: '2026-09-21T08:42:00Z',
  fulfillment: 'PICKUP',
  customer: { name: 'Rizky', email: 'rizky@mail.test' },
  recipient: { name: 'Rizky Siregar', phone: '081265432190' },
  shippingAddress: null,
  items: [
    {
      productCode: 'SSB-0097',
      brand: 'Nike',
      model: 'Air Force 1',
      sizeEu: 42,
      condition: 'GOOD',
      price: 350000,
      photoUrl: null,
    },
  ],
  total: 350000,
  store: { address: 'Jl. Toko No. 1, Medan', whatsapp: '+62 812' },
  payment: { senderBank: 'BCA', senderName: 'RIZKY SIREGAR', verifiedBy: 'Andi' },
}

const mountPage = async () => {
  const page = mount(InvoicePage, { global: { plugins: [createPinia(), PrimeVue] } })
  await flushPromises()
  return page
}

describe('InvoicePage', () => {
  beforeEach(() => vi.clearAllMocks())

  it('data invoice dari API, judul dokumen = nama file PDF, tombol memanggil print', async () => {
    vi.mocked(ordersApi.invoice).mockResolvedValue(invoice)
    window.print = vi.fn()
    const page = await mountPage()
    const text = page.text()
    expect(text).toContain('Jl. Toko No. 1, Medan')
    expect(text).toContain('LUNAS')
    expect(text).toContain('SSB-0097')
    expect(text).toContain('Rp 350.000')
    expect(text).toContain('Diverifikasi oleh pegawai Andi pada 21 Sep, 15.42 WIB')
    expect(document.title).toBe('Invoice INV-20260921-0011')
    await page
      .findAll('button')
      .find((b) => b.text().includes('Unduh PDF'))!
      .trigger('click')
    expect(window.print).toHaveBeenCalled()
  })

  it('belum terverifikasi: pesan dari server, tanpa tombol cetak', async () => {
    vi.mocked(ordersApi.invoice).mockRejectedValue(
      new ApiRequestError(
        409,
        'INVOICE_NOT_AVAILABLE',
        'Invoice tersedia setelah pembayaran diverifikasi.',
      ),
    )
    const page = await mountPage()
    expect(page.text()).toContain('Invoice belum tersedia')
    expect(page.findAll('button').some((b) => b.text().includes('Cetak'))).toBe(false)
  })
})
