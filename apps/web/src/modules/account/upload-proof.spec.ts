import { flushPromises, mount, RouterLinkStub } from '@vue/test-utils'
import PrimeVue from 'primevue/config'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { PaymentInstructionsDto } from '@ssb/shared'
import { ApiRequestError } from '@/shared/lib'
import { UploadDropzone } from '@/shared/ui'
import { ordersApi } from './api/orders.api'
import UploadProofPage from './pages/UploadProofPage.vue'

vi.mock('vue-router', () => ({ useRoute: () => ({ params: { code: 'INV-1' } }) }))
vi.mock('./api/orders.api', () => ({
  ordersApi: { paymentInstructions: vi.fn(), submitProof: vi.fn() },
}))
URL.createObjectURL = vi.fn(() => 'blob:preview')
URL.revokeObjectURL = vi.fn()
// jsdom tidak punya matchMedia (dipakai Select PrimeVue)
window.matchMedia = vi.fn(() => ({
  matches: false,
  addEventListener: vi.fn(),
  removeEventListener: vi.fn(),
})) as unknown as typeof window.matchMedia

const pay = (over: Partial<PaymentInstructionsDto> = {}): PaymentInstructionsDto => ({
  code: 'INV-1',
  status: 'AWAITING_PAYMENT',
  paymentStatus: 'UNPAID',
  total: 620000,
  expiresAt: new Date(Date.now() + 3600_000).toISOString(),
  bankAccounts: [],
  lastRejectReason: null,
  ...over,
})
const png = (size = 1000) => new File([new Uint8Array(size)], 'bukti.png', { type: 'image/png' })

async function mountPage(p = pay()) {
  vi.mocked(ordersApi.paymentInstructions).mockResolvedValue(p)
  const page = mount(UploadProofPage, {
    global: { plugins: [PrimeVue], stubs: { RouterLink: RouterLinkStub } },
  })
  await flushPromises()
  return page
}

describe('UploadProofPage', () => {
  beforeEach(() => vi.clearAllMocks())

  it('menolak tipe dan ukuran file yang tidak didukung sebelum diunggah', async () => {
    const page = await mountPage()
    const zone = page.findComponent(UploadDropzone)
    zone.vm.$emit('select', new File(['x'], 'a.txt', { type: 'text/plain' }))
    await flushPromises()
    expect(page.text()).toContain('File harus foto (JPG, PNG, WEBP) atau PDF.')
    zone.vm.$emit('select', png(5 * 1024 * 1024 + 1))
    await flushPromises()
    expect(page.text()).toContain('Ukuran file maksimal 5 MB.')
    expect(page.find('form').exists()).toBe(false)
  })

  it('pratinjau → kirim FormData lengkap → Bukti terkirim', async () => {
    vi.mocked(ordersApi.submitProof).mockResolvedValue({} as never)
    const page = await mountPage()
    page.findComponent(UploadDropzone).vm.$emit('select', png())
    await flushPromises()
    expect(page.get('img').attributes('src')).toBe('blob:preview')
    await page.get('input[autocomplete="name"]').setValue('RIZKY SIREGAR')
    const bank = page.get('input[placeholder="Pilih bank"]')
    await bank.setValue('BCA')
    await page.get('form').trigger('submit')
    await flushPromises()

    const [code, data] = vi.mocked(ordersApi.submitProof).mock.calls[0]
    expect(code).toBe('INV-1')
    expect(data.get('senderName')).toBe('RIZKY SIREGAR')
    expect(data.get('senderBank')).toBe('BCA')
    expect(data.get('amount')).toBe('620000') // default = total pesanan
    expect((data.get('file') as File).name).toBe('bukti.png')
    expect(page.text()).toContain('Bukti terkirim')
  })

  it('field kosong tidak dikirim; 409 dari server ditampilkan', async () => {
    vi.mocked(ordersApi.submitProof).mockRejectedValue(
      new ApiRequestError(409, 'ORDER_EXPIRED', 'Batas waktu pembayaran sudah lewat.'),
    )
    const page = await mountPage()
    page.findComponent(UploadDropzone).vm.$emit('select', png())
    await flushPromises()
    await page.get('form').trigger('submit')
    await flushPromises()
    expect(ordersApi.submitProof).not.toHaveBeenCalled()
    expect(page.text()).toContain('Nama pengirim 2 sampai 100 karakter')

    await page.get('input[autocomplete="name"]').setValue('Rina')
    await page.get('input[placeholder="Pilih bank"]').setValue('BCA')
    await page.get('form').trigger('submit')
    await flushPromises()
    expect(page.text()).toContain('Batas waktu pembayaran sudah lewat.')
  })

  it('bukti sudah diunggah: tidak menampilkan form', async () => {
    const page = await mountPage(
      pay({ status: 'AWAITING_VERIFICATION', paymentStatus: 'PENDING_VERIFICATION' }),
    )
    expect(page.text()).toContain('Bukti transfer sudah kami terima')
    expect(page.findComponent(UploadDropzone).exists()).toBe(false)
  })
})
