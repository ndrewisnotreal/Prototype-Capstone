<script setup lang="ts">
import { OfflineBanner } from '@/shared/ui'
</script>

<template>
  <!-- Tanpa navigasi: invoice siap cetak, halaman error, /dev/ui -->
  <div class="min-h-screen bg-gray-100">
    <OfflineBanner class="print:hidden" />
    <slot />
  </div>
</template>
