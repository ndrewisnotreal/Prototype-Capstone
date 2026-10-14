import { flushPromises, mount } from '@vue/test-utils'
import PrimeVue from 'primevue/config'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { PendingProofDto } from '@ssb/shared'
import { ApiRequestError } from '@/shared/lib'
import { paymentsApi } from './api/payments.api'
import PaymentVerificationPage from './pages/PaymentVerificationPage.vue'

// jsdom tidak punya ResizeObserver (dipakai Textarea auto-resize PrimeVue)
globalThis.ResizeObserver ??= class {
  observe() {}
  unobserve() {}
  disconnect() {}
} as unknown as typeof ResizeObserver

const notify = { success: vi.fn(), error: vi.fn(), info: vi.fn() }
const query: Record<string, string> = {}
vi.mock('vue-router', () => ({ useRoute: () => ({ query }) }))
vi.mock('./api/payments.api', () => ({
  paymentsApi: { pending: vi.fn(), accept: vi.fn(), reject: vi.fn() },
}))
vi.mock('@/shared/composables', async (orig) => ({
  ...(await orig<typeof import('@/shared/composables')>()),
  useNotify: () => notify,
}))

const proof = (id: number, over: Partial<PendingProofDto> = {}): PendingProofDto => ({
  id,
  senderName: 'RINA',
  senderBank: 'BCA',
  amount: 450000,
  createdAt: new Date().toISOString(),
  order: {
    code: `INV-${id}`,
    total: 450000,
    expiresAt: new Date(Date.now() + 3600_000).toISOString(),
    itemNames: ['Nike Kobe'],
    customerName: `Customer ${id}`,
    recipientPhone: '0812',
  },
  ...over,
})
const button = (page: Awaited<ReturnType<typeof mountPage>>, label: string) =>
  page.findAll('button').find((b) => b.text() === label)!

async function mountPage(list: PendingProofDto[]) {
  vi.mocked(paymentsApi.pending).mockResolvedValue(list)
  const page = mount(PaymentVerificationPage, { global: { plugins: [PrimeVue] } })
  await flushPromises()
  return page
}

describe('PaymentVerificationPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    delete query.kode
  })

  it('terima baru aktif setelah dana dicentang; lalu lanjut ke bukti berikutnya', async () => {
    const page = await mountPage([proof(1), proof(2)])
    expect(button(page, 'Terima pembayaran').attributes('disabled')).toBeDefined()
    await page.get('#funds').setValue(true)
    vi.mocked(paymentsApi.accept).mockResolvedValue({} as never)
    await button(page, 'Terima pembayaran').trigger('click')
    await flushPromises()
    expect(paymentsApi.accept).toHaveBeenCalledWith(1)
    expect(page.get('#det-h').text()).toBe('INV-2')
    expect(page.text()).toContain('1 bukti menunggu')
  })

  it('nominal beda ditandai; tolak butuh alasan minimal 10 karakter', async () => {
    const page = await mountPage([proof(1, { amount: 400000 })])
    expect(page.text()).toContain('Nominal tidak sama dengan total pesanan.')
    await button(page, 'Tolak').trigger('click')
    // nominal beda: alasan terisi otomatis
    expect((page.get('#reject-reason').element as HTMLTextAreaElement).value).toBe(
      'Nominal kurang dari total pesanan.',
    )
    await page.get('#reject-reason').setValue('buram')
    expect(button(page, 'Tolak dengan alasan').attributes('disabled')).toBeDefined()
    await page.get('#reject-reason').setValue('Bukti buram, mohon unggah ulang')
    vi.mocked(paymentsApi.reject).mockResolvedValue({} as never)
    await button(page, 'Tolak dengan alasan').trigger('click')
    await flushPromises()
    expect(paymentsApi.reject).toHaveBeenCalledWith(1, 'Bukti buram, mohon unggah ulang')
    expect(page.text()).toContain('Tidak ada bukti yang menunggu')
  })

  it('?kode= memilih bukti itu; 409 memuat ulang antrean', async () => {
    query.kode = 'INV-2'
    const page = await mountPage([proof(1), proof(2)])
    expect(page.get('#det-h').text()).toBe('INV-2')
    await page.get('#funds').setValue(true)
    vi.mocked(paymentsApi.accept).mockRejectedValue(
      new ApiRequestError(409, 'PROOF_NOT_PENDING', 'Bukti ini sudah diperiksa.'),
    )
    await button(page, 'Terima pembayaran').trigger('click')
    await flushPromises()
    expect(notify.error).toHaveBeenCalledWith('Bukti ini sudah diperiksa.')
    expect(paymentsApi.pending).toHaveBeenCalledTimes(2)
  })
})
