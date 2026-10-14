<script setup lang="ts">
import { computed } from 'vue'
import { CheckIcon, ClockIcon, NoSymbolIcon, PhotoIcon } from '@heroicons/vue/24/outline'
import { CONDITION_LABELS, PRODUCT_STATUS_CUSTOMER_LABELS, type ProductCardDto } from '@ssb/shared'
import { formatNumber, formatRupiah } from '@/shared/lib/format'

// Kartu sepatu katalog (layar ProductCard): Tersedia, Sedang dipesan, Terjual.
const props = defineProps<{ product: ProductCardDto }>()

const p = computed(() => props.product)
const name = computed(() => `${p.value.brand} ${p.value.model}`)
const statusLabel = computed(() => PRODUCT_STATUS_CUSTOMER_LABELS[p.value.status])
const STATUS = {
  AVAILABLE: { icon: CheckIcon, class: 'bg-success-bg text-success-fg' },
  RESERVED: { icon: ClockIcon, class: 'bg-warning-bg text-warning-fg' },
  SOLD: { icon: NoSymbolIcon, class: 'bg-neutral-bg text-neutral-fg' },
  INACTIVE: { icon: NoSymbolIcon, class: 'bg-neutral-bg text-neutral-fg' },
}
const sold = computed(() => p.value.status === 'SOLD')
</script>

<template>
  <RouterLink
    :to="`/sepatu/${p.code}`"
    :aria-label="`${name}, ${formatRupiah(p.price)}, ${statusLabel}`"
    class="flex h-full flex-col overflow-hidden rounded-card border border-gray-200 bg-white text-gray-900 shadow-card transition-shadow hover:shadow-pop"
  >
    <div class="aspect-square bg-photo" :class="sold && 'opacity-55'">
      <img
        v-if="p.primaryPhotoUrl"
        :src="p.primaryPhotoUrl"
        :alt="name"
        loading="lazy"
        class="size-full object-cover"
      />
      <div
        v-else
        role="img"
        :aria-label="`Foto ${name} belum ada`"
        class="flex size-full items-center justify-center text-gray-600"
      >
        <PhotoIcon class="size-8" aria-hidden="true" />
      </div>
    </div>

    <div class="flex flex-1 flex-col gap-1.5 px-3 pt-3 pb-3.5 sm:px-4 sm:pt-3.5 sm:pb-4">
      <div class="flex min-h-[22px] items-center justify-between gap-2">
        <span class="text-xs font-bold text-gray-600">{{ p.brand }}</span>
        <span
          v-if="p.isNew && p.status === 'AVAILABLE'"
          class="rounded-full bg-accent-400 px-2 py-[3px] text-[11px] font-bold whitespace-nowrap text-gray-900"
          >Baru masuk</span
        >
      </div>
      <p class="line-clamp-2 min-h-10 text-sm leading-[1.35] font-bold sm:text-[15px]">
        {{ p.model }}
      </p>
      <p class="text-[13px] text-gray-600">
        EU {{ formatNumber(p.sizeEu) }} · {{ CONDITION_LABELS[p.condition] }}
      </p>
      <p
        class="mt-auto pt-1.5 text-base font-extrabold tabular-nums sm:text-lg"
        :class="sold ? 'text-gray-500' : 'text-gray-900'"
      >
        {{ formatRupiah(p.price) }}
      </p>
      <span
        class="inline-flex items-center gap-[5px] self-start rounded-full py-1 pr-2.5 pl-[7px] text-xs font-bold"
        :class="STATUS[p.status].class"
      >
        <component
          :is="STATUS[p.status].icon"
          class="size-3.5"
          stroke-width="2"
          aria-hidden="true"
        />{{ statusLabel }}
      </span>
    </div>
  </RouterLink>
</template>
