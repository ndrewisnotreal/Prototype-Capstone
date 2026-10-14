<script setup lang="ts">
import { XMarkIcon } from '@heroicons/vue/24/outline'

// Chip filter katalog. active = filter terpasang (tampil ikon hapus), disabled = pilihan kosong.
defineProps<{ label: string; active?: boolean; disabled?: boolean }>()
defineEmits<{ click: [] }>()
</script>

<template>
  <button
    type="button"
    :aria-pressed="active"
    :disabled="disabled"
    class="inline-flex h-9 items-center gap-1.5 rounded-full border px-3.5 text-[13px] whitespace-nowrap transition-colors"
    :class="
      active
        ? 'border-brand-600 bg-brand-50 pr-2.5 font-bold text-brand-700'
        : disabled
          ? 'cursor-not-allowed border-dashed border-gray-300 bg-gray-50 font-semibold text-gray-500'
          : 'border-gray-300 bg-white font-semibold text-gray-900 hover:border-gray-400'
    "
    @click="$emit('click')"
  >
    {{ label }}
    <XMarkIcon v-if="active" class="size-4" stroke-width="2" aria-label="Hapus filter" role="img" />
  </button>
</template>
