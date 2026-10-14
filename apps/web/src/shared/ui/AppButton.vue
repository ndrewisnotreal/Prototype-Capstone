<script setup lang="ts">
import { computed, type Component } from 'vue'

// Semua tombol aksi lewat komponen ini (ADR-0004). Varian dan ukuran mengikuti DS-Components.
const props = withDefaults(
  defineProps<{
    label?: string
    variant?: 'primary' | 'accent' | 'secondary' | 'ghost' | 'danger'
    size?: 'sm' | 'md' | 'lg'
    icon?: Component
    loading?: boolean
    disabled?: boolean
    type?: 'button' | 'submit'
  }>(),
  { variant: 'primary', size: 'md', type: 'button' },
)

const severity = computed(
  () =>
    ({
      primary: undefined,
      accent: 'warn',
      secondary: 'secondary',
      ghost: undefined,
      danger: 'danger',
    })[props.variant],
)
// sm 36px (aksi tabel, chip), md 44px (minimal di mobile), lg 52px (CTA utama mobile)
const sizeClass = {
  sm: 'h-9 px-3.5 text-[13px]',
  md: 'h-11 px-4 text-sm',
  lg: 'h-13 px-6 text-base',
}
</script>

<template>
  <Button
    :type="type"
    :label="label"
    :severity="severity"
    :variant="variant === 'ghost' ? 'text' : undefined"
    :loading="loading"
    :disabled="disabled || loading"
    :class="sizeClass[size]"
  >
    <template v-if="icon" #icon>
      <component :is="icon" class="size-5" aria-hidden="true" />
    </template>
    <slot />
  </Button>
</template>
