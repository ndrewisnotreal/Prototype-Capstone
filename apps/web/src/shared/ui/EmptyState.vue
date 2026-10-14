<script setup lang="ts">
import type { Component } from 'vue'

// Slot default = tombol/tautan aksi (mis. "Lihat Katalog").
defineProps<{ title: string; description?: string; icon?: Component }>()
</script>

<template>
  <div class="flex flex-col items-center gap-2.5 rounded-card bg-gray-50 px-5 py-8 text-center">
    <span
      v-if="icon"
      class="flex size-14 items-center justify-center rounded-card bg-brand-50 text-brand-600"
    >
      <component :is="icon" class="size-7" aria-hidden="true" />
    </span>
    <p class="text-[17px] font-extrabold text-gray-900">{{ title }}</p>
    <p v-if="description" class="max-w-[30ch] text-sm text-gray-600">{{ description }}</p>
    <div v-if="$slots.default" class="mt-1"><slot /></div>
  </div>
</template>
