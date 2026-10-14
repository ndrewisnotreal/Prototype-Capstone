<script setup lang="ts">
import { computed } from 'vue'
import {
  ORDER_STATUS_LABELS,
  PAYMENT_STATUS_LABELS,
  PRODUCT_STATUS_LABELS,
  PROOF_STATUS_LABELS,
  type BadgeTone,
  type OrderStatus,
  type PaymentStatus,
  type ProductStatus,
  type ProofStatus,
  type StatusLabel,
} from '@ssb/shared'

// Label dan warna status hanya dari @ssb/shared. Status selalu tampil sebagai teks, bukan warna saja.
const props = defineProps<
  | { type: 'product'; status: ProductStatus }
  | { type: 'order'; status: OrderStatus }
  | { type: 'payment'; status: PaymentStatus }
  | { type: 'proof'; status: ProofStatus }
>()

const LABELS = {
  product: PRODUCT_STATUS_LABELS,
  order: ORDER_STATUS_LABELS,
  payment: PAYMENT_STATUS_LABELS,
  proof: PROOF_STATUS_LABELS,
}
const TONE_CLASS: Record<BadgeTone, string> = {
  success: 'bg-success-bg text-success-fg border-success-line',
  warning: 'bg-warning-bg text-warning-fg border-warning-line',
  brand: 'bg-brand-50 text-brand-700 border-brand-100',
  danger: 'bg-danger-bg text-danger-fg border-danger-line',
  neutral: 'bg-neutral-bg text-neutral-fg border-gray-300',
  outline: 'bg-white text-neutral-fg border-gray-300',
}

const item = computed(() => (LABELS[props.type] as Record<string, StatusLabel>)[props.status])
</script>

<template>
  <span
    class="inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-bold whitespace-nowrap"
    :class="TONE_CLASS[item.tone]"
    >{{ item.label }}</span
  >
</template>
