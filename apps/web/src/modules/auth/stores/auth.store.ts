import { defineStore } from 'pinia'
import { ref } from 'vue'
import type { AuthUserDto } from '@ssb/shared'
import { ApiRequestError } from '@/shared/lib'
import { authApi } from '../api/auth.api'

export const useAuthStore = defineStore('auth', () => {
  const user = ref<AuthUserDto | null>(null)
  /** true = server tidak terjangkau saat dicek, jadi belum tahu login atau tamu (bukan berarti tamu) */
  const unknown = ref(false)
  let loading: Promise<void> | null = null

  /** Sekali per muat halaman: tanya server siapa yang login (cookie httpOnly tidak bisa dibaca JS). */
  function ensureLoaded() {
    loading ??= authApi
      .me()
      .then((res) => {
        user.value = res.user
        unknown.value = false
      })
      .catch((e: unknown) => {
        user.value = null
        // 401 = tamu. Error lain (API mati) jangan bikin halaman publik gagal; ulangi di navigasi berikutnya.
        unknown.value = !(e instanceof ApiRequestError && e.status === 401)
        if (unknown.value) loading = null
      })
    return loading
  }

  async function login(email: string, password: string) {
    user.value = (await authApi.login({ email, password })).user
    return user.value
  }

  async function register(data: Parameters<typeof authApi.register>[0]) {
    user.value = (await authApi.register(data)).user
    return user.value
  }

  async function logout() {
    await authApi.logout()
    user.value = null
  }

  /** Sesi berakhir di server (cookie kedaluwarsa, akun dinonaktifkan, keluar di tab lain) */
  function signedOut() {
    user.value = null
    unknown.value = false
    loading = Promise.resolve()
  }

  return { user, unknown, ensureLoaded, login, register, logout, signedOut }
})
