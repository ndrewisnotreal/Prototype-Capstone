<script setup lang="ts">
// Kartu KPI (dashboard owner): label, nilai besar, badge perubahan berwarna sesuai arah.
defineProps<{
  label: string
  value: string
  delta?: string
  tone?: 'success' | 'danger' | 'warning' | 'neutral'
}>()
const TONE = {
  success: 'bg-success-bg text-success-fg',
  danger: 'bg-danger-bg text-danger-fg',
  warning: 'bg-warning-bg text-warning-fg',
  neutral: 'bg-gray-100 text-gray-700',
}
</script>

<template>
  <div class="flex flex-col gap-2 rounded-card border border-gray-200 bg-white p-4.5">
    <span class="text-[13px] font-semibold text-gray-600">{{ label }}</span>
    <span class="text-[28px] font-extrabold tracking-tight tabular-nums">{{ value }}</span>
    <span
      v-if="delta"
      class="self-start rounded-full px-2.5 py-0.5 text-xs font-bold"
      :class="TONE[tone ?? 'neutral']"
      >{{ delta }}</span
    >
  </div>
</template>
