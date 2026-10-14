<script setup lang="ts">
import { PhotoIcon } from '@heroicons/vue/24/outline'
import { CONDITION_LABELS, type ProductCardDto } from '@ssb/shared'
import { formatNumber, formatRupiah } from '@/shared/lib'

// Kartu sepatu mini di dalam chat (hasil pencarian asisten, hanya yang tersedia).
const props = defineProps<{ product: ProductCardDto }>()
defineEmits<{ open: [] }>()
const name = `${props.product.brand} ${props.product.model}`
</script>

<template>
  <div
    class="flex w-[290px] max-w-full items-center gap-2.5 self-start rounded-card border border-gray-200 bg-white p-2"
  >
    <img
      v-if="product.primaryPhotoUrl"
      :src="product.primaryPhotoUrl"
      :alt="name"
      class="size-16 flex-none rounded-control object-cover"
    />
    <span
      v-else
      role="img"
      :aria-label="`Foto ${name} belum ada`"
      class="flex size-16 flex-none items-center justify-center rounded-control bg-photo text-gray-500"
      ><PhotoIcon class="size-6" aria-hidden="true"
    /></span>
    <span class="flex min-w-0 flex-1 flex-col gap-0.5">
      <span class="truncate text-[13px] font-bold">{{ name }}</span>
      <span class="text-xs text-gray-600"
        >EU {{ formatNumber(product.sizeEu) }} · {{ CONDITION_LABELS[product.condition] }}</span
      >
      <span class="text-sm font-extrabold tabular-nums">{{ formatRupiah(product.price) }}</span>
    </span>
    <RouterLink
      :to="`/sepatu/${product.code}`"
      :aria-label="`Lihat ${name}`"
      class="flex h-11 items-center rounded-control bg-brand-50 px-3 text-xs font-extrabold text-brand-700 hover:bg-brand-100 lg:h-9"
      @click="$emit('open')"
      >Lihat</RouterLink
    >
  </div>
</template>
