import type { RouteRecordRaw } from 'vue-router'

export const routes: RouteRecordRaw[] = [
  { path: '/panel/owner', redirect: '/panel/owner/dashboard' },
  {
    path: '/panel/owner/dashboard',
    component: () => import('./pages/OwnerDashboardPage.vue'),
    meta: { layout: 'panel', roles: ['OWNER'] },
  },
  {
    path: '/panel/owner/laporan',
    component: () => import('./pages/SalesReportPage.vue'),
    meta: { layout: 'panel', roles: ['OWNER'] },
  },
  {
    path: '/panel/owner/performa',
    component: () => import('./pages/ProductPerformancePage.vue'),
    meta: { layout: 'panel', roles: ['OWNER'] },
  },
  {
    path: '/panel/owner/akun',
    component: () => import('./pages/AccountsPage.vue'),
    meta: { layout: 'panel', roles: ['OWNER'] },
  },
  {
    path: '/panel/owner/log',
    component: () => import('./pages/ActivityLogPage.vue'),
    meta: { layout: 'panel', roles: ['OWNER'] },
  },
  {
    path: '/panel/owner/pengaturan',
    component: () => import('./pages/StoreSettingsPage.vue'),
    meta: { layout: 'panel', roles: ['OWNER'] },
  },
]
