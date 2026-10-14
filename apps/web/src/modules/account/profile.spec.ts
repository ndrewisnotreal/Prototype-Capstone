import { flushPromises, mount, RouterLinkStub } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import PrimeVue from 'primevue/config'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useAuthStore } from '@/modules/auth'
import { ApiRequestError } from '@/shared/lib'
import { profileApi } from './api/profile.api'
import ProfilePage from './pages/ProfilePage.vue'

const notify = { success: vi.fn(), error: vi.fn(), info: vi.fn() }
vi.mock('vue-router', () => ({
  useRoute: () => ({ path: '/profil' }),
  useRouter: () => ({ push: vi.fn() }),
}))
vi.mock('./api/profile.api', () => ({
  profileApi: {
    update: vi.fn(),
    changePassword: vi.fn(),
    addresses: vi.fn(),
    createAddress: vi.fn(),
    updateAddress: vi.fn(),
    deleteAddress: vi.fn(),
  },
}))
vi.mock('@/shared/composables', async (orig) => ({
  ...(await orig<typeof import('@/shared/composables')>()),
  useNotify: () => notify,
  useConfirmAction: () => vi.fn(),
}))

async function mountPage() {
  const pinia = createPinia()
  setActivePinia(pinia)
  useAuthStore().user = {
    id: 1,
    name: 'Rina',
    email: 'rina@mail.test',
    phone: '081200000001',
    role: 'CUSTOMER',
  }
  vi.mocked(profileApi.addresses).mockResolvedValue([
    {
      id: 1,
      label: 'Rumah',
      line: 'Jl. Sei Batang Hari 12',
      city: 'Medan',
      postalCode: '20122',
      isPrimary: true,
    },
  ])
  const page = mount(ProfilePage, {
    global: { plugins: [pinia, PrimeVue], stubs: { RouterLink: RouterLinkStub, Dialog: true } },
  })
  await flushPromises()
  return page
}
const form = (page: Awaited<ReturnType<typeof mountPage>>, heading: string) =>
  page.findAll('form').find((f) => f.text().includes(heading))!

describe('ProfilePage', () => {
  beforeEach(() => vi.clearAllMocks())

  it('simpan profil memperbarui user di store (nama di header ikut berubah)', async () => {
    const page = await mountPage()
    vi.mocked(profileApi.update).mockResolvedValue({
      user: {
        id: 1,
        name: 'Rina Siregar',
        email: 'rina@mail.test',
        phone: '081234567890',
        role: 'CUSTOMER',
      },
    })
    await page.get('input[autocomplete="name"]').setValue('Rina Siregar')
    await page.get('input[type="tel"]').setValue('0812-3456-7890')
    await form(page, 'Data diri').trigger('submit')
    await flushPromises()
    expect(profileApi.update).toHaveBeenCalledWith({ name: 'Rina Siregar', phone: '081234567890' })
    expect(useAuthStore().user?.name).toBe('Rina Siregar')
    expect(page.text()).toContain('Tersimpan')
  })

  it('alamat utama tidak bisa dihapus langsung (tanpa tombol Hapus)', async () => {
    const page = await mountPage()
    expect(page.text()).toContain('Utama')
    expect(page.find('button[aria-label="Hapus alamat Rumah"]').exists()).toBe(false)
  })

  it('password baru tidak sama: tidak dikirim; password lama salah tampil di field', async () => {
    const page = await mountPage()
    const pw = form(page, 'Ganti password')
    const [current, next, repeat] = pw.findAll('input')
    await current.setValue('lama-12345')
    await next.setValue('baru-12345')
    await repeat.setValue('beda-12345')
    await pw.trigger('submit')
    await flushPromises()
    expect(profileApi.changePassword).not.toHaveBeenCalled()
    expect(pw.text()).toContain('Password baru belum sama')

    vi.mocked(profileApi.changePassword).mockRejectedValue(
      new ApiRequestError(400, 'WRONG_PASSWORD', 'Password sekarang salah.'),
    )
    await repeat.setValue('baru-12345')
    await pw.trigger('submit')
    await flushPromises()
    expect(pw.text()).toContain('Password sekarang salah.')
  })
})
