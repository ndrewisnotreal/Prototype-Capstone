import type { AuthUserDto, Role } from '@ssb/shared'
import type { RouteLocationRaw, RouteMeta } from 'vue-router'

// Aturan akses route, dipisah dari router supaya mudah dites. Ini hanya untuk UX: keamanan tetap di backend.

/** Halaman awal setelah login, sesuai peta route di docs/architecture.md. */
export function homeForRole(role: Role): string {
  return { CUSTOMER: '/', STAFF: '/panel/dashboard', OWNER: '/panel/owner/dashboard' }[role]
}

/** Hanya path internal yang boleh jadi tujuan ?redirect= (mencegah open redirect ke situs lain). */
export function safeRedirect(value: unknown): string | null {
  return typeof value === 'string' &&
    value.startsWith('/') &&
    !value.startsWith('//') &&
    !value.includes('\\')
    ? value
    : null
}

export function resolveAccess(
  meta: RouteMeta,
  user: AuthUserDto | null,
  fullPath: string,
): true | RouteLocationRaw {
  if (meta.guestOnly && user) return homeForRole(user.role)
  if ((meta.requiresAuth || meta.roles) && !user)
    return { path: '/masuk', query: { redirect: fullPath } }
  if (meta.roles && user && !meta.roles.includes(user.role)) return '/403'
  // Pintu masuk (/ dan /panel): yang sudah login dibawa ke halaman awal role-nya. Dibandingkan tanpa ?query/#hash
  // supaya /#cara-belanja milik customer tidak ikut dialihkan.
  if (meta.roleHome && user) {
    const home = homeForRole(user.role)
    if (fullPath.split(/[?#]/)[0] !== home) return home
  }
  return true
}

/**
 * Tujuan setelah masuk/daftar: ?redirect= bila aman DAN boleh dibuka role ini (mis. tamu klik Keranjang lalu login
 * sebagai pegawai tidak boleh berakhir di 403), selain itu halaman awal role. metaOf = router.resolve(path).meta.
 */
export function landingFor(
  user: AuthUserDto,
  redirect: unknown,
  metaOf: (path: string) => RouteMeta,
): string {
  const target = safeRedirect(redirect)
  return target && resolveAccess(metaOf(target), user, target) === true
    ? target
    : homeForRole(user.role)
}
