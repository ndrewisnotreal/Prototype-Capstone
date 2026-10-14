import type { RouterScrollBehavior } from 'vue-router'

// Kembali/maju: posisi tersimpan. Tautan dengan #bagian (mis. "Cara Belanja" = /#cara-belanja): gulir ke bagian itu.
// Selain itu: ke atas halaman.
export const scrollBehavior: RouterScrollBehavior = (to, _from, saved) => {
  if (saved) return saved
  if (to.hash) return { el: to.hash, top: 16, behavior: 'smooth' }
  return { top: 0 }
}
