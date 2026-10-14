import type { RouteRecordRaw } from 'vue-router'

const DevUiPage = () => import('./pages/DevUiPage.vue')
const DevLayoutPage = () => import('./pages/DevLayoutPage.vue')

export const routes: RouteRecordRaw[] = [
  { path: '/403', component: () => import('./pages/ForbiddenPage.vue') },
  // Halaman dev untuk mencocokkan komponen dan layout dengan desain; tidak ikut build produksi.
  ...(import.meta.env.DEV
    ? [
        { path: '/dev/ui', component: DevUiPage, meta: { layout: 'blank' as const } },
        { path: '/dev/layout/storefront', component: DevLayoutPage },
        {
          path: '/dev/layout/storefront-dalam',
          component: DevLayoutPage,
          meta: { title: 'Detail sepatu', backTo: '/dev/layout/storefront' },
        },
        { path: '/dev/layout/auth', component: DevLayoutPage, meta: { layout: 'auth' as const } },
        { path: '/dev/layout/panel', component: DevLayoutPage, meta: { layout: 'panel' as const } },
        {
          path: '/dev/layout/panel-owner',
          component: DevLayoutPage,
          meta: { layout: 'panel' as const },
        },
      ]
    : []),
  // harus paling akhir (router/index.ts menaruh modul system di urutan terakhir)
  { path: '/:pathMatch(.*)*', component: () => import('./pages/NotFoundPage.vue') },
]
