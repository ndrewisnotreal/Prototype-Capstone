import type { RouteRecordRaw } from 'vue-router'

const meta = { layout: 'auth', guestOnly: true } as const

export const routes: RouteRecordRaw[] = [
  { path: '/masuk', component: () => import('./pages/LoginPage.vue'), meta },
  { path: '/daftar', component: () => import('./pages/RegisterPage.vue'), meta },
  { path: '/lupa-password', component: () => import('./pages/ForgotPasswordPage.vue'), meta },
  // bukan guestOnly: tautan reset harus tetap bisa dibuka walau browser masih login
  {
    path: '/reset-password',
    component: () => import('./pages/ResetPasswordPage.vue'),
    meta: { layout: 'auth' },
  },
]
