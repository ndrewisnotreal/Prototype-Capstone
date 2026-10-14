import { flushPromises, mount } from '@vue/test-utils'
import PrimeVue from 'primevue/config'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { OwnerUserDto, StoreSettingsDto } from '@ssb/shared'
import { ApiRequestError } from '@/shared/lib'
import { ownerAdminApi } from './api/admin.api'
import AccountsPage from './pages/AccountsPage.vue'
import StoreSettingsPage from './pages/StoreSettingsPage.vue'

const notify = { success: vi.fn(), error: vi.fn(), info: vi.fn() }
vi.mock('./api/admin.api', () => ({
  ownerAdminApi: {
    users: vi.fn(),
    createStaff: vi.fn(),
    setActive: vi.fn(),
    sendReset: vi.fn(),
    settings: vi.fn(),
    saveSettings: vi.fn(),
    bankAccounts: vi.fn(),
    createBankAccount: vi.fn(),
    faqs: vi.fn(),
  },
}))
vi.mock('@/shared/composables', async (orig) => ({
  ...(await orig<typeof import('@/shared/composables')>()),
  useNotify: () => notify,
  useConfirmAction: () => vi.fn(),
}))
// Dialog dirender sebagai isi biasa supaya form di dalamnya bisa diuji
const DialogStub = { template: '<div><slot /><slot name="footer" /></div>' }
const global = { plugins: [PrimeVue], stubs: { RouterLink: true, Dialog: DialogStub } }

const user = (over: Partial<OwnerUserDto>): OwnerUserDto => ({
  id: 2,
  name: 'Andi Lubis',
  email: 'andi@ssb.test',
  phone: '0812',
  role: 'STAFF',
  isActive: true,
  lastLoginAt: null,
  createdAt: '2026-09-01T00:00:00Z',
  orderCount: 0,
  ...over,
})
const buttonByText = (w: ReturnType<typeof mount>, text: string) =>
  w.findAll('button').find((b) => b.text() === text)!

describe('AccountsPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(ownerAdminApi.users).mockResolvedValue({
      data: [user({ id: 1, name: 'Pak Suwandi', role: 'OWNER' }), user({})],
      meta: { page: 1, limit: 20, total: 2 },
    })
  })

  it('owner tanpa aksi; nonaktifkan pegawai memperbarui baris', async () => {
    const w = mount(AccountsPage, { global })
    await flushPromises()
    expect(w.findAll('button[aria-label^="Kirim tautan reset"]')).toHaveLength(1)
    vi.mocked(ownerAdminApi.setActive).mockResolvedValue(undefined)
    await w.get('input[aria-label="Akun Andi Lubis aktif"]').setValue(false)
    await flushPromises()
    expect(ownerAdminApi.setActive).toHaveBeenCalledWith(2, false)
    expect(w.text()).toContain('Nonaktif')
  })

  it('undangan: validasi dulu, email terdaftar tampil di field', async () => {
    const w = mount(AccountsPage, { global })
    await flushPromises()
    await buttonByText(w, 'Tambah pegawai').trigger('click')
    await w.get('#invite-form').trigger('submit')
    expect(ownerAdminApi.createStaff).not.toHaveBeenCalled()
    const [name, email, phone] = w.get('#invite-form').findAll('input')
    await name!.setValue('Maya Rangkuti')
    await email!.setValue('maya@ssb.test')
    await phone!.setValue('0813-7720-5561')
    vi.mocked(ownerAdminApi.createStaff).mockRejectedValue(
      new ApiRequestError(409, 'EMAIL_TAKEN', 'Email sudah terdaftar.'),
    )
    await w.get('#invite-form').trigger('submit')
    await flushPromises()
    expect(ownerAdminApi.createStaff).toHaveBeenCalledWith({
      name: 'Maya Rangkuti',
      email: 'maya@ssb.test',
      phone: '081377205561',
    })
    expect(w.get('#invite-form').text()).toContain('Email sudah terdaftar.')
  })

  it('undangan gagal terkirim: pesan dari server tampil dan daftar dimuat ulang', async () => {
    const w = mount(AccountsPage, { global })
    await flushPromises()
    await buttonByText(w, 'Tambah pegawai').trigger('click')
    const [name, email, phone] = w.get('#invite-form').findAll('input')
    await name!.setValue('Doni')
    await email!.setValue('doni@ssb.test')
    await phone!.setValue('081377205562')
    const message = 'Akun pegawai sudah dibuat, tetapi email undangan belum terkirim.'
    vi.mocked(ownerAdminApi.createStaff).mockRejectedValue(
      new ApiRequestError(503, 'INVITE_MAIL_FAILED', message),
    )
    const loadsBefore = vi.mocked(ownerAdminApi.users).mock.calls.length
    await w.get('#invite-form').trigger('submit')
    await flushPromises()
    expect(notify.error).toHaveBeenCalledWith(message)
    expect(vi.mocked(ownerAdminApi.users).mock.calls.length).toBeGreaterThan(loadsBefore)
  })
})

describe('StoreSettingsPage', () => {
  const settings: StoreSettingsDto = {
    whatsapp: '0895383713434',
    instagram: null,
    tiktok: null,
    address: 'Jl. Karya Wisata Ujung No. 43, Medan',
    openingHours: [{ days: 'Senin sampai Sabtu', hours: '10.00 - 21.00' }],
    paymentDeadlineHours: 24,
    fulfillmentMethods: ['PICKUP', 'SHIPPING'],
    updatedAt: '2026-10-12T00:00:00Z',
  }
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(ownerAdminApi.settings).mockResolvedValue(settings)
    vi.mocked(ownerAdminApi.bankAccounts).mockResolvedValue([])
    vi.mocked(ownerAdminApi.faqs).mockResolvedValue([])
  })

  it('bar simpan muncul saat berubah; payload tanpa updatedAt; Batalkan mengembalikan', async () => {
    const w = mount(StoreSettingsPage, { global })
    await flushPromises()
    expect(w.text()).not.toContain('Ada perubahan belum disimpan')
    await w
      .findAll('button[role="radio"]')
      .find((b) => b.text() === '48 jam')!
      .trigger('click')
    expect(w.text()).toContain('Ada perubahan belum disimpan')

    vi.mocked(ownerAdminApi.saveSettings).mockResolvedValue({
      ...settings,
      paymentDeadlineHours: 48,
    })
    await w.get('#settings-form').trigger('submit')
    await flushPromises()
    const payload = vi.mocked(ownerAdminApi.saveSettings).mock.calls[0]![0]
    expect(payload).not.toHaveProperty('updatedAt')
    expect(payload.paymentDeadlineHours).toBe(48)
    expect(w.text()).not.toContain('Ada perubahan belum disimpan')
  })

  it('rekening baru tidak dikirim tanpa password owner', async () => {
    const w = mount(StoreSettingsPage, { global })
    await flushPromises()
    await buttonByText(w, 'Tambah rekening').trigger('click')
    await w.get('#bank-form').trigger('submit')
    expect(ownerAdminApi.createBankAccount).not.toHaveBeenCalled()
    expect(w.get('#bank-form').text()).toContain('Masukkan password owner untuk konfirmasi.')
  })
})
