import { flushPromises, mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import PrimeVue from 'primevue/config'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useAuthStore } from '@/modules/auth'
import { ApiRequestError } from '@/shared/lib'
import { accountApi } from './api/account.api'
import ChangePasswordPage from './pages/ChangePasswordPage.vue'

const notify = { success: vi.fn(), error: vi.fn(), info: vi.fn() }
vi.mock('./api/account.api', () => ({ accountApi: { changePassword: vi.fn() } }))
vi.mock('@/shared/composables', async (orig) => ({
  ...(await orig<typeof import('@/shared/composables')>()),
  useNotify: () => notify,
}))

function mountPage() {
  const pinia = createPinia()
  setActivePinia(pinia)
  useAuthStore().user = {
    id: 2,
    name: 'Pegawai Satu',
    email: 'pegawai1@ssb.test',
    phone: null,
    role: 'STAFF',
  }
  return mount(ChangePasswordPage, { global: { plugins: [pinia, PrimeVue] } })
}

describe('ChangePasswordPage (panel)', () => {
  beforeEach(() => vi.clearAllMocks())

  it('password lama salah tampil di field; berhasil mengosongkan form', async () => {
    const page = mountPage()
    const form = page.get('form')
    const [current, next, repeat] = form.findAll('input')

    await current.setValue('lama-12345')
    await next.setValue('baru-12345')
    await repeat.setValue('beda-12345')
    await form.trigger('submit')
    await flushPromises()
    expect(accountApi.changePassword).not.toHaveBeenCalled()
    expect(form.text()).toContain('Password baru belum sama')

    vi.mocked(accountApi.changePassword).mockRejectedValueOnce(
      new ApiRequestError(400, 'WRONG_PASSWORD', 'Password sekarang salah.'),
    )
    await repeat.setValue('baru-12345')
    await form.trigger('submit')
    await flushPromises()
    expect(form.text()).toContain('Password sekarang salah.')

    vi.mocked(accountApi.changePassword).mockResolvedValueOnce(undefined)
    await form.trigger('submit')
    await flushPromises()
    expect(accountApi.changePassword).toHaveBeenLastCalledWith({
      currentPassword: 'lama-12345',
      newPassword: 'baru-12345',
    })
    expect(notify.success).toHaveBeenCalledWith('Password diganti.')
    expect((current.element as HTMLInputElement).value).toBe('')
  })
})
