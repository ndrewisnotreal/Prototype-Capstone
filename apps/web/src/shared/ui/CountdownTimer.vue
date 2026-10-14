<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import { formatCountdown } from '@/shared/lib'

// Hitung mundur ke batas waktu dari server (expiresAt). Memancarkan `expired` sekali saat menyentuh nol.
const props = defineProps<{ expiresAt: string }>()
const emit = defineEmits<{ expired: [] }>()

const now = ref(Date.now())
const timer = setInterval(() => (now.value = Date.now()), 1000)
onBeforeUnmount(() => clearInterval(timer))

const left = computed(() => Date.parse(props.expiresAt) - now.value)
watch(
  () => left.value <= 0,
  (done) => done && emit('expired'),
  { immediate: true },
)
</script>

<template>
  <span role="timer" aria-live="off" aria-label="Sisa waktu" class="tabular-nums">{{
    formatCountdown(left)
  }}</span>
</template>
