import type { RouteRecordRaw } from 'vue-router'

export const routes: RouteRecordRaw[] = [
  {
    path: '/akun',
    component: () => import('./pages/AccountPage.vue'),
    meta: { title: 'Akun', backTo: '/', requiresAuth: true, roles: ['CUSTOMER'] },
  },
  {
    path: '/profil',
    component: () => import('./pages/ProfilePage.vue'),
    meta: { title: 'Profil dan alamat', backTo: '/', requiresAuth: true, roles: ['CUSTOMER'] },
  },
  {
    path: '/pesanan',
    component: () => import('./pages/OrdersPage.vue'),
    meta: { title: 'Pesanan saya', backTo: '/', requiresAuth: true, roles: ['CUSTOMER'] },
  },
  {
    path: '/pesanan/:code/invoice',
    component: () => import('./pages/InvoicePage.vue'),
    // pegawai/owner juga boleh (docs/architecture.md, peta route)
    meta: { layout: 'blank', requiresAuth: true, roles: ['CUSTOMER', 'STAFF', 'OWNER'] },
  },
  {
    path: '/pesanan/:code',
    component: () => import('./pages/OrderDetailPage.vue'),
    meta: { title: 'Detail pesanan', backTo: '/pesanan', requiresAuth: true, roles: ['CUSTOMER'] },
  },
  {
    path: '/keranjang',
    component: () => import('./pages/CartPage.vue'),
    meta: { title: 'Keranjang', backTo: '/katalog', requiresAuth: true, roles: ['CUSTOMER'] },
  },
  {
    path: '/checkout',
    component: () => import('./pages/CheckoutPage.vue'),
    meta: {
      title: 'Checkout',
      backTo: '/keranjang',
      requiresAuth: true,
      roles: ['CUSTOMER'],
      hideTabBar: true,
    },
  },
  {
    path: '/pesanan/:code/bayar',
    component: () => import('./pages/PaymentInstructionPage.vue'),
    meta: { title: 'Bayar pesanan', backTo: '/pesanan', requiresAuth: true, roles: ['CUSTOMER'] },
  },
  {
    path: '/pesanan/:code/upload-bukti',
    component: () => import('./pages/UploadProofPage.vue'),
    meta: { title: 'Upload bukti', backTo: '/pesanan', requiresAuth: true, roles: ['CUSTOMER'] },
  },
]
