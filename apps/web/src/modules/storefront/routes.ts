import type { RouteRecordRaw } from 'vue-router'

export const routes: RouteRecordRaw[] = [
  { path: '/', component: () => import('./pages/HomePage.vue'), meta: { roleHome: true } },
  {
    path: '/katalog',
    component: () => import('./pages/CatalogPage.vue'),
    meta: { title: 'Katalog', backTo: '/' },
  },
  {
    path: '/kanal-resmi',
    component: () => import('./pages/OfficialChannelPage.vue'),
    meta: { title: 'Kanal resmi', backTo: '/' },
  },
  {
    path: '/sepatu/:code',
    component: () => import('./pages/ProductDetailPage.vue'),
    meta: { title: 'Detail sepatu', backTo: '/katalog', hideTabBar: true },
  },
]
