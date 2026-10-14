<script setup lang="ts">
import { ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { MagnifyingGlassIcon, ShoppingBagIcon } from '@heroicons/vue/24/outline'
import BrandLogo from './BrandLogo.vue'
import { STOREFRONT_LINKS, initials } from './nav'

// Header desktop (layar SiteHeader). user kosong = tamu (tombol Masuk).
// accountTo: customer → /pesanan, pegawai/owner → panelnya
withDefaults(
  defineProps<{
    user?: { name: string } | null
    cartCount?: number
    accountTo?: string
    /** false untuk pegawai/owner (keranjang khusus customer) */
    showCart?: boolean
  }>(),
  {
    accountTo: '/pesanan',
    showCart: true,
  },
)

const route = useRoute()
const router = useRouter()
const query = ref('')
const isActive = (to: string) =>
  to === '/' ? route.path === '/' && !route.hash : route.fullPath.startsWith(to)
const search = () =>
  router.push({ path: '/katalog', query: query.value.trim() ? { q: query.value.trim() } : {} })
</script>

<template>
  <header class="border-b border-gray-200 bg-white">
    <div class="mx-auto flex max-w-7xl flex-wrap items-center gap-x-7 gap-y-3 px-6 py-3.5">
      <RouterLink
        to="/"
        aria-label="Suwandi SecondBranded, beranda"
        class="flex items-center gap-2.5 text-gray-900"
      >
        <BrandLogo />
        <span class="flex flex-col leading-[1.1]">
          <span class="font-extrabold">Suwandi</span>
          <span class="text-xs font-medium text-gray-600">SecondBranded</span>
        </span>
      </RouterLink>

      <nav aria-label="Utama" class="flex flex-wrap gap-1">
        <RouterLink
          v-for="l in STOREFRONT_LINKS"
          :key="l.to"
          :to="l.to"
          :aria-current="isActive(l.to) ? 'page' : undefined"
          class="inline-flex min-h-10 items-center rounded-full px-3.5 text-[15px]"
          :class="
            isActive(l.to)
              ? 'bg-brand-50 font-bold text-brand-700'
              : 'font-semibold text-gray-700 hover:bg-gray-50'
          "
          >{{ l.label }}</RouterLink
        >
      </nav>

      <form role="search" class="ml-auto max-w-[380px] flex-[1_1_260px]" @submit.prevent="search">
        <label
          class="focus-within:outline-3 focus-within:outline-offset-2 focus-within:outline-brand-600/45 flex h-11 items-center gap-2.5 rounded-control border border-gray-200 bg-gray-100 px-3.5 text-gray-600 focus-within:border-brand-600"
        >
          <MagnifyingGlassIcon class="size-5" aria-hidden="true" />
          <span class="sr-only">Cari sepatu</span>
          <input
            v-model="query"
            type="search"
            placeholder="Cari merek, model, ukuran"
            class="min-w-0 flex-1 bg-transparent text-sm text-gray-900 outline-none placeholder:text-gray-500"
          />
        </label>
      </form>

      <div class="flex items-center gap-2">
        <RouterLink
          v-if="showCart"
          to="/keranjang"
          :aria-label="`Keranjang, ${cartCount ?? 0} sepatu`"
          class="relative flex size-11 items-center justify-center rounded-control border border-gray-200 text-gray-900 hover:bg-gray-50"
        >
          <ShoppingBagIcon class="size-[22px]" aria-hidden="true" />
          <span
            v-if="cartCount"
            aria-hidden="true"
            class="absolute -top-1.5 -right-1.5 flex h-5 min-w-5 items-center justify-center rounded-full border-2 border-white bg-accent-400 px-1 text-[11px] font-extrabold text-gray-900"
            >{{ cartCount }}</span
          >
        </RouterLink>
        <RouterLink
          v-if="!user"
          to="/masuk"
          class="flex h-11 items-center rounded-control bg-brand-600 px-4.5 text-sm font-bold text-white hover:bg-brand-700"
          >Masuk</RouterLink
        >
        <RouterLink
          v-else
          :to="accountTo"
          :aria-label="`Akun ${user.name}`"
          class="flex h-11 items-center gap-2 rounded-full border border-gray-200 pr-3 pl-1 text-sm font-semibold text-gray-900 hover:bg-gray-50"
        >
          <span
            aria-hidden="true"
            class="flex size-9 items-center justify-center rounded-full bg-brand-100 text-[13px] font-extrabold text-brand-700"
            >{{ initials(user.name) }}</span
          >{{ user.name.split(' ')[0] }}
        </RouterLink>
      </div>
    </div>
  </header>
</template>
