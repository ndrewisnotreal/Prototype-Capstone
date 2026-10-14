import { readonly, ref } from 'vue'

// Status koneksi ke API untuk banner global dan OfflineState (layar E-Offline).
// Putus = event `offline` browser atau fetch gagal di http.ts. Selama putus, /api/health dicoba berkala;
// respons apa pun (termasuk 503 database) berarti server terjangkau lagi.
export const RECONNECT_INTERVAL_MS = 5000

const offline = ref(typeof navigator !== 'undefined' && navigator.onLine === false)
let probeTimer: ReturnType<typeof setInterval> | undefined

async function probe() {
  try {
    await fetch('/api/health', { cache: 'no-store' })
    markOnline()
  } catch {
    // masih putus, dicoba lagi di putaran berikutnya
  }
}

export function markOffline() {
  offline.value = true
  probeTimer ??= setInterval(probe, RECONNECT_INTERVAL_MS)
}

export function markOnline() {
  if (!offline.value) return
  offline.value = false
  clearInterval(probeTimer)
  probeTimer = undefined
}

if (typeof window !== 'undefined') {
  window.addEventListener('offline', markOffline)
  window.addEventListener('online', () => void probe())
  if (offline.value) markOffline()
}

export const isOffline = readonly(offline)
