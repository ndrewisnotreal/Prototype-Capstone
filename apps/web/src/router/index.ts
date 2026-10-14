import { createRouter, createWebHistory } from 'vue-router'
import { routes as storefront } from '@/modules/storefront'
import { routes as account } from '@/modules/account'
import { routes as auth } from '@/modules/auth'
import { routes as operations } from '@/modules/panel/operations'
import { routes as owner } from '@/modules/panel/owner'
import { routes as system } from '@/modules/system'
import { installGuards } from './guards'
import { scrollBehavior } from './scroll'

export const router = createRouter({
  history: createWebHistory(),
  // system terakhir: berisi catch-all 404
  routes: [...storefront, ...account, ...auth, ...operations, ...owner, ...system],
  scrollBehavior,
})
installGuards(router)
