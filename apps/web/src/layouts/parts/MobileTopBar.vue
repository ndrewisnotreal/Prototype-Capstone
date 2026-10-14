<script setup lang="ts">
import { ArrowLeftIcon, MagnifyingGlassIcon, ShoppingBagIcon } from '@heroicons/vue/24/outline'
import BrandLogo from './BrandLogo.vue'

// Halaman utama: logo. Halaman dalam: tombol kembali + judul (dari route.meta.title / backTo).
withDefaults(
  defineProps<{
    title?: string
    backTo?: string
    /** false untuk pegawai/owner (keranjang khusus customer) */
    showCart?: boolean
  }>(),
  { showCart: true },
)
</script>

<template>
  <header class="flex h-16 items-center gap-1 border-b border-gray-200 bg-white pr-2 pl-3">
    <template v-if="backTo">
      <RouterLink
        :to="backTo"
        aria-label="Kembali"
        class="-ml-1.5 flex size-11 items-center justify-center rounded-control text-gray-900"
      >
        <ArrowLeftIcon class="size-[22px]" aria-hidden="true" />
      </RouterLink>
      <span class="flex-1 truncate text-[17px] font-extrabold">{{ title }}</span>
    </template>
    <RouterLink
      v-else
      to="/"
      aria-label="Suwandi SecondBranded, beranda"
      class="flex h-11 flex-1 items-center gap-2 text-gray-900"
    >
      <BrandLogo size="sm" />
      <span class="text-[15px] font-extrabold"
        >Suwandi <span class="font-medium text-gray-600">SecondBranded</span></span
      >
    </RouterLink>
    <RouterLink
      to="/katalog"
      aria-label="Cari sepatu"
      class="flex size-11 items-center justify-center rounded-control text-gray-900"
    >
      <MagnifyingGlassIcon class="size-[22px]" aria-hidden="true" />
    </RouterLink>
    <RouterLink
      v-if="showCart"
      to="/keranjang"
      aria-label="Keranjang"
      class="flex size-11 items-center justify-center rounded-control text-gray-900"
    >
      <ShoppingBagIcon class="size-[22px]" aria-hidden="true" />
    </RouterLink>
  </header>
</template>
