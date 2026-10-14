import { shallowRef } from 'vue'
import type { OfficialChannelsDto } from '@ssb/shared'
import { storeApi } from './api/store.api'

// Info toko (rekening, WA, alamat, jam buka, batas bayar) dipakai footer, Beranda, detail, dan Kanal Resmi.
// Diambil sekali per muat halaman lalu dibagi; gagal = null dan dicoba lagi pada pemanggilan berikutnya.
const info = shallowRef<OfficialChannelsDto | null>(null)
let loading: Promise<void> | null = null

export function useStoreInfo() {
  const ready = (loading ??= storeApi
    .officialChannels()
    .then((data) => {
      info.value = data
    })
    .catch(() => {
      loading = null
    }))
  return { info, ready }
}

/** Batas bayar untuk teks "direservasi N jam"; 24 = default [KONFIRMASI] no. 2 selama info belum termuat. */
export const paymentDeadlineHours = () => info.value?.paymentDeadlineHours ?? 24
