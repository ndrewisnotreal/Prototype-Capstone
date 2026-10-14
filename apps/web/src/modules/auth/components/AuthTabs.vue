<script setup lang="ts">
import { useRoute } from 'vue-router'

// Pemilih Masuk/Daftar di atas form (layar Auth). Berupa tautan, karena keduanya punya URL sendiri.
const route = useRoute()
const tabs = [
  { label: 'Masuk', to: '/masuk' },
  { label: 'Daftar', to: '/daftar' },
]
</script>

<template>
  <nav aria-label="Masuk atau daftar" class="grid grid-cols-2 rounded-control bg-gray-200 p-1">
    <RouterLink
      v-for="t in tabs"
      :key="t.to"
      :to="{ path: t.to, query: route.query }"
      :aria-current="route.path === t.to ? 'page' : undefined"
      class="flex h-11 items-center justify-center rounded-[10px] text-[15px] text-gray-900"
      :class="
        route.path === t.to
          ? 'bg-white font-extrabold shadow-[0_1px_3px_rgb(17_24_39/0.12)]'
          : 'font-semibold'
      "
      >{{ t.label }}</RouterLink
    >
  </nav>
</template>
