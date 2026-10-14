import type { Router } from 'vue-router'
import { landingFor, resolveAccess, useAuthStore } from '@/modules/auth'
import { setUnauthenticatedHandler } from '@/shared/lib'

const CHUNK_RELOAD_KEY = 'ssb:chunk-reload'
// Pesan Chrome/Edge, Safari, Firefox saat file halaman (lazy import) tidak ada lagi
const CHUNK_ERROR =
  /Failed to fetch dynamically imported module|Importing a module script failed|error loading dynamically imported module/i

// Guard UX saja: keamanan sebenarnya di backend (@Roles). Aturan ada di modules/auth/access.ts.
export function installGuards(router: Router) {
  const metaOf = (path: string) => router.resolve(path).meta

  router.beforeEach(async (to) => {
    const auth = useAuthStore()
    await auth.ensureLoaded()
    // Sudah login tetapi membuka Masuk/Daftar (mis. bookmark ?redirect=): langsung ke tujuan yang boleh dibuka
    if (to.meta.guestOnly && auth.user) return landingFor(auth.user, to.query.redirect, metaOf)
    // Server tak terjangkau: belum tahu login atau tamu. Jangan lempar ke Masuk; halaman menampilkan error koneksi
    // dan backend tetap menolak data tanpa sesi. Status dicek ulang di navigasi berikutnya.
    if (!auth.user && auth.unknown) return true
    return resolveAccess(to.meta, auth.user, to.fullPath)
  })

  // Sesi berakhir saat aplikasi terbuka: keluar, dan bila halaman ini butuh login kembali ke Masuk
  setUnauthenticatedHandler(() => {
    useAuthStore().signedOut()
    const current = router.currentRoute.value
    if (current.meta.requiresAuth || current.meta.roles)
      void router.replace({ path: '/masuk', query: { redirect: current.fullPath, sesi: 'habis' } })
  })

  // Setelah deploy baru, file halaman versi lama hilang: muat ulang penuh ke tujuan, sekali saja (cegah loop)
  router.onError((error: unknown, to) => {
    if (!CHUNK_ERROR.test(error instanceof Error ? error.message : String(error))) return
    try {
      if (sessionStorage.getItem(CHUNK_RELOAD_KEY)) return
      sessionStorage.setItem(CHUNK_RELOAD_KEY, '1')
    } catch {
      // storage diblokir: tetap coba muat ulang sekali
    }
    window.location.assign(to.fullPath)
  })
  router.afterEach(() => {
    try {
      sessionStorage.removeItem(CHUNK_RELOAD_KEY)
    } catch {
      // abaikan
    }
  })
}
