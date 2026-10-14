<script setup lang="ts">
import { ref, watch } from 'vue'
import { CONDITION_LABELS, Condition, type BrandDto, type CategoryDto } from '@ssb/shared'
import type { CatalogFilters } from '../catalog-query'

// Satu komponen untuk sidebar desktop (checkbox) dan bottom sheet ponsel (pil), sesuai layar Katalog dan M-Filter.
const props = defineProps<{
  filters: CatalogFilters
  categories: CategoryDto[]
  brands: BrandDto[]
  variant: 'sidebar' | 'sheet'
}>()
const emit = defineEmits<{ change: [filters: CatalogFilters] }>()

const SIZES = [39, 40, 41, 42, 43, 44, 45]
const CONDITIONS = Object.values(Condition)

type ListKey = 'category' | 'brand' | 'condition' | 'size'
function toggle<K extends ListKey>(key: K, value: NonNullable<CatalogFilters[K]>[number]) {
  const current = (props.filters[key] ?? []) as (typeof value)[]
  const next = current.includes(value) ? current.filter((v) => v !== value) : [...current, value]
  emit('change', { ...props.filters, [key]: next })
}
const has = (key: ListKey, value: string | number) =>
  ((props.filters[key] ?? []) as (string | number)[]).includes(value)

// Harga diterapkan saat keluar dari kolom atau tekan Enter, bukan tiap ketikan
const minPrice = ref<number | null>(null)
const maxPrice = ref<number | null>(null)
watch(
  () => [props.filters.minPrice, props.filters.maxPrice],
  ([min, max]) => {
    minPrice.value = min ?? null
    maxPrice.value = max ?? null
  },
  { immediate: true },
)
function applyPrice() {
  const min = minPrice.value ?? undefined
  const max = maxPrice.value ?? undefined
  if (min === props.filters.minPrice && max === props.filters.maxPrice) return
  emit('change', { ...props.filters, minPrice: min, maxPrice: max })
}

const groups = [
  { key: 'category' as const, title: 'Kategori' },
  { key: 'brand' as const, title: 'Merek' },
]
const options = (key: 'category' | 'brand') =>
  key === 'category'
    ? props.categories.map((c) => ({ value: c.slug, label: c.name }))
    : props.brands.map((b) => ({ value: b.name, label: b.name }))
const pill = (on: boolean) =>
  on
    ? 'border-brand-600 bg-brand-50 font-bold text-brand-700'
    : 'border-gray-300 bg-white font-semibold text-gray-900'
</script>

<template>
  <div class="flex flex-col" :class="variant === 'sheet' && 'gap-1'">
    <fieldset
      v-for="g in groups"
      :key="g.key"
      class="flex flex-col gap-2 border-b border-gray-100 px-5 py-4.5"
    >
      <legend class="float-left mb-2 text-sm font-bold">{{ g.title }}</legend>
      <div v-if="variant === 'sidebar'" class="clear-both flex flex-col gap-0.5">
        <label
          v-for="o in options(g.key)"
          :key="o.value"
          class="flex min-h-10 cursor-pointer items-center gap-2.5 text-sm"
        >
          <Checkbox
            :model-value="has(g.key, o.value)"
            binary
            @update:model-value="toggle(g.key, o.value)"
          />
          {{ o.label }}
        </label>
      </div>
      <div v-else class="clear-both flex flex-wrap gap-2">
        <button
          v-for="o in options(g.key)"
          :key="o.value"
          type="button"
          :aria-pressed="has(g.key, o.value)"
          class="h-11 rounded-full border px-4 text-sm"
          :class="pill(has(g.key, o.value))"
          @click="toggle(g.key, o.value)"
        >
          {{ o.label }}
        </button>
      </div>
    </fieldset>

    <fieldset class="border-b border-gray-100 px-5 py-4.5">
      <legend class="float-left mb-2.5 text-sm font-bold">Ukuran (EU)</legend>
      <div class="clear-both grid grid-cols-4 gap-2" :class="variant === 'sheet' && 'grid-cols-5'">
        <button
          v-for="s in SIZES"
          :key="s"
          type="button"
          :aria-pressed="has('size', s)"
          class="h-11 rounded-control border text-sm font-bold"
          :class="
            has('size', s)
              ? 'border-brand-600 bg-brand-600 text-white'
              : 'border-gray-300 bg-white text-gray-900'
          "
          @click="toggle('size', s)"
        >
          {{ s }}
        </button>
      </div>
    </fieldset>

    <fieldset class="border-b border-gray-100 px-5 py-4.5">
      <legend class="float-left mb-2 text-sm font-bold">Kondisi</legend>
      <div v-if="variant === 'sidebar'" class="clear-both flex flex-col gap-0.5">
        <label
          v-for="c in CONDITIONS"
          :key="c"
          class="flex min-h-10 cursor-pointer items-center gap-2.5 text-sm"
        >
          <Checkbox
            :model-value="has('condition', c)"
            binary
            @update:model-value="toggle('condition', c)"
          />
          {{ CONDITION_LABELS[c] }}
        </label>
      </div>
      <div v-else class="clear-both flex flex-wrap gap-2">
        <button
          v-for="c in CONDITIONS"
          :key="c"
          type="button"
          :aria-pressed="has('condition', c)"
          class="h-11 rounded-full border px-4 text-sm"
          :class="pill(has('condition', c))"
          @click="toggle('condition', c)"
        >
          {{ CONDITION_LABELS[c] }}
        </button>
      </div>
    </fieldset>

    <fieldset class="border-b border-gray-100 px-5 py-4.5">
      <legend class="float-left mb-2.5 text-sm font-bold">Harga</legend>
      <div class="clear-both grid grid-cols-2 gap-2">
        <label class="flex min-w-0 flex-col gap-1.5 text-xs font-semibold text-gray-700">
          Minimum
          <InputNumber
            v-model="minPrice"
            placeholder="Rp 0"
            prefix="Rp "
            locale="id-ID"
            :min="0"
            :max-fraction-digits="0"
            fluid
            @blur="applyPrice"
            @keydown.enter="applyPrice"
          />
        </label>
        <label class="flex min-w-0 flex-col gap-1.5 text-xs font-semibold text-gray-700">
          Maksimum
          <InputNumber
            v-model="maxPrice"
            placeholder="Rp 1.000.000"
            prefix="Rp "
            locale="id-ID"
            :min="0"
            :max-fraction-digits="0"
            fluid
            @blur="applyPrice"
            @keydown.enter="applyPrice"
          />
        </label>
      </div>
    </fieldset>

    <label class="flex min-h-11 cursor-pointer items-center gap-3 px-5 py-4 text-sm">
      <ToggleSwitch
        :model-value="!!filters.hideReserved"
        @update:model-value="emit('change', { ...filters, hideReserved: $event || undefined })"
      />
      Sembunyikan yang sedang dipesan
    </label>
  </div>
</template>
