import { flushPromises, mount, RouterLinkStub } from '@vue/test-utils'
import PrimeVue from 'primevue/config'
import ToastService from 'primevue/toastservice'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { shallowRef } from 'vue'
import type { OrderDetailDto, PaymentInstructionsDto } from '@ssb/shared'
import { ordersApi } from './api/orders.api'
import { CountdownTimer } from '@/shared/ui'
import PaymentInstructionPage from './pages/PaymentInstructionPage.vue'

vi.mock('vue-router', () => ({ useRoute: () => ({ params: { code: 'INV-20261011-0007' } }) }))
vi.mock('./api/orders.api', () => ({
  ordersApi: { detail: vi.fn(), paymentInstructions: vi.fn() },
}))
vi.mock('@/modules/storefront', () => ({
  useStoreInfo: () => ({ info: shallowRef({ address: 'Jl. Toko, Medan' }) }),
}))

const NOW = new Date('2026-10-11T07:32:00Z')
const HOUR = 3600_000

describe('CountdownTimer', () => {
  beforeEach(() => vi.useFakeTimers({ now: NOW }))
  afterEach(() => vi.useRealTimers())

  it('berdetak tiap detik dan memancarkan expired sekali di nol', async () => {
    const t = mount(CountdownTimer, {
      props: { expiresAt: new Date(NOW.getTime() + 2000).toISOString() },
    })
    expect(t.text()).toBe('00:00:02')
    await vi.advanceTimersByTimeAsync(1000)
    expect(t.text()).toBe('00:00:01')
    await vi.advanceTimersByTimeAsync(3000)
    expect(t.text()).toBe('00:00:00')
    expect(t.emitted('expired')).toHaveLength(1)
  })
})

describe('PaymentInstructionPage', () => {
  const pay = (over: Partial<PaymentInstructionsDto> = {}): PaymentInstructionsDto => ({
    code: 'INV-20261011-0007',
    status: 'AWAITING_PAYMENT',
    paymentStatus: 'UNPAID',
    total: 620000,
    expiresAt: new Date(NOW.getTime() + 24 * HOUR).toISOString(),
    bankAccounts: [
      { id: 1, bankName: 'BCA', accountNumber: '123 456 7890', accountName: 'Suwandi' },
    ],
    lastRejectReason: null,
    ...over,
  })
  const order = {
    code: 'INV-20261011-0007',
    status: 'AWAITING_PAYMENT',
    paymentStatus: 'UNPAID',
    fulfillment: 'PICKUP',
    items: [],
    cancelReason: null,
  } as unknown as OrderDetailDto

  const mountPage = async (p: PaymentInstructionsDto) => {
    vi.mocked(ordersApi.detail).mockResolvedValue({ ...order, status: p.status })
    vi.mocked(ordersApi.paymentInstructions).mockResolvedValue(p)
    const page = mount(PaymentInstructionPage, {
      global: { plugins: [PrimeVue, ToastService], stubs: { RouterLink: RouterLinkStub } },
    })
    await flushPromises()
    return page
  }

  beforeEach(() => vi.useFakeTimers({ now: NOW, toFake: ['Date'] }))
  afterEach(() => vi.useRealTimers())

  it('menunggu bayar: total, rekening, batas WIB, salin nomor tanpa spasi', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined)
    Object.assign(navigator, { clipboard: { writeText } })
    const page = await mountPage(pay())
    expect(page.text()).toContain('Pesanan dibuat, sepatumu sudah direservasi')
    expect(page.text()).toContain('Rp 620.000')
    expect(page.text()).toContain('Senin, 12 Okt 2026 pukul 14.32 WIB')
    expect(page.get('[role="timer"]').text()).toBe('24:00:00')
    await page.get('button[aria-label="Salin nomor BCA"]').trigger('click')
    await flushPromises()
    expect(writeText).toHaveBeenCalledWith('1234567890')
    expect(page.get('button[aria-label="Salin nomor BCA"]').text()).toContain('Tersalin')
  })

  it('bukti ditolak: alasan tampil dan tetap bisa unggah ulang', async () => {
    const page = await mountPage(
      pay({ paymentStatus: 'REJECTED', lastRejectReason: 'Nominal kurang dari total' }),
    )
    expect(page.text()).toContain('Bukti transfer ditolak, unggah ulang ya')
    expect(page.text()).toContain('Nominal kurang dari total')
    expect(page.text()).toContain('Upload Bukti Transfer')
  })

  it('lewat batas atau sudah diunggah: instruksi transfer disembunyikan', async () => {
    const late = await mountPage(pay({ expiresAt: new Date(NOW.getTime() - 1000).toISOString() }))
    expect(late.text()).toContain('Waktu pembayaran habis')
    expect(late.text()).not.toContain('Transfer tepat sejumlah')

    const sent = await mountPage(
      pay({ status: 'AWAITING_VERIFICATION', paymentStatus: 'PENDING_VERIFICATION' }),
    )
    expect(sent.text()).toContain('Bukti transfer sudah kami terima')
    expect(sent.text()).not.toContain('Upload Bukti Transfer')
  })
})
