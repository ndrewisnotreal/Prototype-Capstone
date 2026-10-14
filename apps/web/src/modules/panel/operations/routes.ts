import type { RouteMeta, RouteRecordRaw } from 'vue-router'

const meta: RouteMeta = { layout: 'panel', roles: ['STAFF', 'OWNER'] }

export const routes: RouteRecordRaw[] = [
  // Pintu masuk panel: guard (roleHome) membawa pegawai ke dashboard-nya dan owner ke dashboard owner
  {
    path: '/panel',
    component: () => import('./pages/StaffDashboardPage.vue'),
    meta: { ...meta, roleHome: true },
  },
  {
    path: '/panel/dashboard',
    component: () => import('./pages/StaffDashboardPage.vue'),
    meta,
  },
  {
    path: '/panel/verifikasi',
    component: () => import('./pages/PaymentVerificationPage.vue'),
    meta,
  },
  { path: '/panel/pesanan', component: () => import('./pages/OrderManagementPage.vue'), meta },
  { path: '/panel/produk', component: () => import('./pages/ProductListPage.vue'), meta },
  { path: '/panel/produk/baru', component: () => import('./pages/ProductFormPage.vue'), meta },
  {
    path: '/panel/produk/:id/edit',
    component: () => import('./pages/ProductFormPage.vue'),
    meta,
  },
  {
    path: '/panel/password',
    component: () => import('./pages/ChangePasswordPage.vue'),
    meta,
  },
]
