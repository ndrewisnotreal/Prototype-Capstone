<script setup lang="ts">
import { CONDITION_LABELS, type Condition } from '@ssb/shared'

defineProps<{ condition: Condition }>()

// Makin tua hijaunya makin bagus kondisinya (DS-Components)
const CLASS: Record<Condition, string> = {
  LIKE_NEW: 'bg-brand-900 text-white border-brand-900',
  VERY_GOOD: 'bg-brand-600 text-white border-brand-600',
  GOOD: 'bg-brand-100 text-brand-900 border-brand-200',
  FAIR: 'bg-white text-brand-700 border-brand-200',
}
</script>

<template>
  <span
    class="inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-bold whitespace-nowrap"
    :class="CLASS[condition]"
    >{{ CONDITION_LABELS[condition] }}</span
  >
</template>
