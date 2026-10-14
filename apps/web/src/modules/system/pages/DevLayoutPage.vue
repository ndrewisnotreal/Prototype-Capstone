<script setup lang="ts">
import { useRoute } from 'vue-router'

// Isi contoh untuk melihat layout di /dev/layout/* (hanya mode dev, diganti halaman asli nanti).
const route = useRoute()
</script>

<template>
  <div class="mx-auto flex w-full max-w-7xl flex-col gap-4 p-6">
    <h1 class="text-3xl font-extrabold tracking-tight">
      Pratinjau layout: {{ route.meta.layout ?? 'storefront' }}
    </h1>
    <p class="text-gray-600">
      Isi halaman muncul di sini. Path: <code>{{ route.path }}</code>
    </p>
    <div class="h-[60vh] rounded-card border border-dashed border-gray-300 bg-white" />
  </div>
</template>
