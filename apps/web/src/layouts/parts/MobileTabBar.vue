<script setup lang="ts">
import { computed } from 'vue'
import { useRoute } from 'vue-router'
import {
  HomeIcon,
  ShoppingBagIcon,
  SparklesIcon,
  Squares2X2Icon,
  UserCircleIcon,
} from '@heroicons/vue/24/outline'

// Navigasi bawah mobile (layar MobileTabBar). "Asisten" membuka chat, bukan pindah halaman.
const props = withDefaults(
  defineProps<{ cartCount?: number; loggedIn?: boolean; accountTo?: string; showCart?: boolean }>(),
  { showCart: true },
)
defineEmits<{ chat: [] }>()

const route = useRoute()
const tabs = computed(() =>
  [
    { label: 'Beranda', to: '/', icon: HomeIcon, active: route.path === '/' },
    {
      label: 'Katalog',
      to: '/katalog',
      icon: Squares2X2Icon,
      active: route.path.startsWith('/katalog'),
    },
    { label: 'Asisten', icon: SparklesIcon, active: false },
    {
      label: 'Keranjang',
      to: '/keranjang',
      icon: ShoppingBagIcon,
      active: route.path === '/keranjang',
      badge: props.cartCount,
    },
    {
      label: 'Akun',
      to: props.loggedIn ? (props.accountTo ?? '/akun') : '/masuk',
      icon: UserCircleIcon,
      active: ['/akun', '/pesanan', '/profil', '/masuk'].some((p) => route.path.startsWith(p)),
    },
  ].filter((t) => props.showCart || t.to !== '/keranjang'),
)
</script>

<template>
  <nav
    aria-label="Navigasi bawah"
    class="grid grid-cols-5 border-t border-gray-200 bg-white px-2 pt-2 pb-[max(12px,env(safe-area-inset-bottom))]"
  >
    <component
      :is="t.to ? 'RouterLink' : 'button'"
      v-for="t in tabs"
      :key="t.label"
      v-bind="t.to ? { to: t.to } : { type: 'button' }"
      :aria-current="t.active ? 'page' : undefined"
      class="relative flex min-h-14 flex-col items-center justify-center gap-[3px] text-[11px]"
      :class="t.active ? 'font-extrabold text-brand-700' : 'font-semibold text-gray-600'"
      @click="!t.to && $emit('chat')"
    >
      <span
        class="flex h-[30px] w-12 items-center justify-center rounded-full"
        :class="t.active && 'bg-brand-50'"
      >
        <component :is="t.icon" class="size-[22px]" aria-hidden="true" />
      </span>
      {{ t.label }}
      <span
        v-if="t.badge"
        aria-hidden="true"
        class="absolute top-0.5 left-1/2 ml-2 flex h-[18px] min-w-[18px] items-center justify-center rounded-full border-2 border-white bg-accent-400 text-[10px] font-extrabold text-gray-900"
        >{{ t.badge }}</span
      >
    </component>
  </nav>
</template>
