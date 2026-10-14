import 'vue-router'
import type { Role } from '@ssb/shared'

declare module 'vue-router' {
  interface RouteMeta {
    /** layout halaman, default storefront (App.vue) */
    layout?: 'storefront' | 'panel' | 'auth' | 'blank'
    /** judul di MobileTopBar; diisi bersama backTo untuk halaman dalam */
    title?: string
    backTo?: string
    /** sembunyikan MobileTabBar (halaman dengan bar aksi sendiri di bawah, mis. detail sepatu) */
    hideTabBar?: boolean
    requiresAuth?: boolean
    /** hanya untuk tamu (Masuk/Daftar); yang sudah login diarahkan ke halaman awal role-nya */
    guestOnly?: boolean
    /** pintu masuk (/ dan /panel): yang sudah login dibawa ke halaman awal role-nya (halaman toko lain tetap terbuka) */
    roleHome?: boolean
    roles?: Role[]
  }
}
