<script setup lang="ts">
import { computed, type Component } from 'vue'
import { useRoute } from 'vue-router'
import {
  AdjustmentsHorizontalIcon,
  ArrowDownTrayIcon,
  ArrowRightStartOnRectangleIcon,
  ChartBarIcon,
  ClockIcon,
  CubeIcon,
  KeyIcon,
  PlusIcon,
  ShieldCheckIcon,
  Squares2X2Icon,
  TagIcon,
  UsersIcon,
} from '@heroicons/vue/24/outline'
import { ROLE_LABELS } from '@ssb/shared'
import BrandLogo from './BrandLogo.vue'
import { initials } from './nav'

// Menu panel (layar AppSidebar). Pegawai dan owner berbagi grup "Operasional"; owner punya grup tambahan.
const props = defineProps<{
  role: 'STAFF' | 'OWNER'
  userName: string
  /** jumlah antrean untuk badge kuning, diisi dari API dashboard */
  counts?: { verification?: number; orders?: number }
}>()
defineEmits<{ logout: [] }>()

interface Item {
  label: string
  to: string
  icon: Component
  badge?: number
}
const groups = computed<{ title: string; items: Item[] }[]>(() => {
  const ops: Item[] = [
    { label: 'Daftar produk', to: '/panel/produk', icon: TagIcon },
    { label: 'Tambah produk', to: '/panel/produk/baru', icon: PlusIcon },
    {
      label: 'Verifikasi bayar',
      to: '/panel/verifikasi',
      icon: ShieldCheckIcon,
      badge: props.counts?.verification,
    },
    { label: 'Kelola pesanan', to: '/panel/pesanan', icon: CubeIcon, badge: props.counts?.orders },
  ]
  return props.role === 'OWNER'
    ? [
        {
          title: 'Bisnis',
          items: [
            { label: 'Dashboard', to: '/panel/owner/dashboard', icon: Squares2X2Icon },
            { label: 'Laporan penjualan', to: '/panel/owner/laporan', icon: ArrowDownTrayIcon },
            { label: 'Performa produk', to: '/panel/owner/performa', icon: ChartBarIcon },
          ],
        },
        { title: 'Operasional', items: ops },
        {
          title: 'Pengelolaan',
          items: [
            { label: 'Akun', to: '/panel/owner/akun', icon: UsersIcon },
            { label: 'Log aktivitas', to: '/panel/owner/log', icon: ClockIcon },
            {
              label: 'Pengaturan toko',
              to: '/panel/owner/pengaturan',
              icon: AdjustmentsHorizontalIcon,
            },
          ],
        },
      ]
    : [
        {
          title: 'Hari ini',
          items: [{ label: 'Dashboard', to: '/panel/dashboard', icon: Squares2X2Icon }],
        },
        { title: 'Operasional', items: ops },
      ]
})

// Menu aktif = tautan terpanjang yang cocok, supaya /panel/produk/baru tidak ikut menyalakan "Daftar produk"
const route = useRoute()
const activeTo = computed(
  () =>
    groups.value
      .flatMap((g) => g.items.map((i) => i.to))
      .filter((to) => route.path === to || route.path.startsWith(`${to}/`))
      .sort((a, b) => b.length - a.length)[0],
)
</script>

<template>
  <nav
    aria-label="Menu panel"
    class="flex h-full flex-col gap-5 bg-brand-900 px-3.5 py-5 text-sm text-brand-100"
  >
    <div class="flex items-center gap-2.5 px-1.5">
      <BrandLogo />
      <span class="flex flex-col leading-[1.15]">
        <span class="font-extrabold text-white">Suwandi SB</span>
        <span class="text-xs text-[#A7B6AF]">{{ ROLE_LABELS[role] }}</span>
      </span>
    </div>

    <div v-for="g in groups" :key="g.title" class="flex flex-col gap-0.5">
      <span class="px-2.5 pb-1.5 text-[11px] font-bold text-[#8FA399]">{{ g.title }}</span>
      <RouterLink
        v-for="it in g.items"
        :key="it.to"
        :to="it.to"
        :aria-current="it.to === activeTo ? 'page' : undefined"
        class="flex min-h-11 items-center gap-2.5 rounded-control px-2.5"
        :class="
          it.to === activeTo ? 'bg-brand-700 font-bold text-white' : 'font-medium hover:bg-white/5'
        "
      >
        <component :is="it.icon" class="size-5" aria-hidden="true" />
        <span class="flex-1">{{ it.label }}</span>
        <span
          v-if="it.badge"
          class="rounded-full bg-accent-400 px-2 py-px text-[11px] font-extrabold text-gray-900"
          :aria-label="`${it.badge} menunggu`"
          >{{ it.badge }}</span
        >
      </RouterLink>
    </div>

    <div class="mt-auto flex items-center gap-2.5 border-t border-[#2A3A33] px-2 pt-3">
      <span
        aria-hidden="true"
        class="flex size-9 items-center justify-center rounded-full bg-brand-600 text-[13px] font-extrabold text-white"
        >{{ initials(userName) }}</span
      >
      <span class="flex flex-1 flex-col leading-[1.2]">
        <span class="font-bold text-white">{{ userName }}</span>
        <span class="text-xs text-[#A7B6AF]">{{ ROLE_LABELS[role] }}</span>
      </span>
      <RouterLink
        to="/panel/password"
        aria-label="Ganti password"
        title="Ganti password"
        class="flex size-11 items-center justify-center rounded-control text-brand-100 hover:bg-white/5 hover:text-white"
      >
        <KeyIcon class="size-5" aria-hidden="true" />
      </RouterLink>
      <button
        type="button"
        aria-label="Keluar"
        class="flex size-11 items-center justify-center rounded-control hover:bg-white/5"
        @click="$emit('logout')"
      >
        <ArrowRightStartOnRectangleIcon class="size-5" aria-hidden="true" />
      </button>
    </div>
  </nav>
</template>
