import { ref, shallowRef, watch } from 'vue'
import { ApiRequestError, isOffline } from '@/shared/lib'

/**
 * State standar untuk satu panggilan API: data, loading, error, dan run() untuk tombol "Coba lagi".
 * Daftar wajib menampilkan ketiga state (aturan frontend).
 * Gagal karena jaringan: dimuat ulang otomatis saat koneksi kembali.
 */
export function useRequest<T>(fn: () => Promise<T>, { immediate = true } = {}) {
  const data = shallowRef<T | null>(null)
  const loading = ref(false)
  const error = ref('')
  /** kode error dari API (mis. PRODUCT_NOT_FOUND), untuk membedakan 404 dari gangguan jaringan */
  const errorCode = ref('')

  async function run() {
    loading.value = true
    error.value = ''
    errorCode.value = ''
    try {
      data.value = await fn()
    } catch (e) {
      error.value = e instanceof ApiRequestError ? e.message : 'Gagal memuat data. Coba lagi.'
      errorCode.value = e instanceof ApiRequestError ? e.code : 'ERROR'
    } finally {
      loading.value = false
    }
  }

  watch(isOffline, (offline) => {
    if (!offline && errorCode.value === 'NETWORK_ERROR') void run()
  })

  if (immediate) void run()
  return { data, loading, error, errorCode, run }
}
