<script setup lang="ts">
import { computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import {
  ArrowRightStartOnRectangleIcon,
  ShieldCheckIcon,
  ShoppingBagIcon,
  UserCircleIcon,
} from '@heroicons/vue/24/outline'
import { useAuthStore } from '@/modules/auth'

// Navigasi akun customer (sisi kiri layar Pesanan dan Profil).
const auth = useAuthStore()
const route = useRoute()
const router = useRouter()

const initials = computed(() =>
  (auth.user?.name ?? '')
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase())
    .join(''),
)
const links = [
  { to: '/pesanan', label: 'Pesanan saya', icon: ShoppingBagIcon },
  { to: '/profil', label: 'Profil dan alamat', icon: UserCircleIcon },
  { to: '/kanal-resmi', label: 'Kanal resmi', icon: ShieldCheckIcon },
]
async function logout() {
  await auth.logout()
  await router.push('/')
}
</script>

<template>
  <nav
    aria-label="Akun"
    class="flex flex-col gap-0.5 rounded-card border border-gray-200 bg-white p-3"
  >
    <div class="mb-1.5 flex items-center gap-3 border-b border-gray-100 px-2 pt-2 pb-3.5">
      <span
        aria-hidden="true"
        class="flex size-11 flex-none items-center justify-center rounded-full bg-brand-100 font-extrabold text-brand-700"
        >{{ initials }}</span
      >
      <span class="flex min-w-0 flex-col">
        <span class="truncate font-extrabold">{{ auth.user?.name }}</span>
        <span class="truncate text-xs text-gray-600">{{ auth.user?.email }}</span>
      </span>
    </div>
    <RouterLink
      v-for="l in links"
      :key="l.to"
      :to="l.to"
      :aria-current="route.path.startsWith(l.to) ? 'page' : undefined"
      class="flex min-h-11 items-center gap-2.5 rounded-control px-3 text-sm"
      :class="
        route.path.startsWith(l.to)
          ? 'bg-brand-50 font-extrabold text-brand-700'
          : 'font-semibold text-gray-700 hover:bg-gray-50'
      "
    >
      <component :is="l.icon" class="size-5" aria-hidden="true" />{{ l.label }}
    </RouterLink>
    <button
      type="button"
      class="flex min-h-11 items-center gap-2.5 rounded-control px-3 text-left text-sm font-semibold text-danger-fg hover:bg-danger-bg"
      @click="logout"
    >
      <ArrowRightStartOnRectangleIcon class="size-5" aria-hidden="true" />Keluar
    </button>
  </nav>
</template>
