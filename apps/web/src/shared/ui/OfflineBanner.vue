<script setup lang="ts">
import { WifiIcon } from '@heroicons/vue/24/outline'
import { isOffline } from '@/shared/lib'

// Banner global layar E-Offline, dipasang di setiap layout di bawah header.
</script>

<template>
  <div
    v-if="isOffline"
    role="alert"
    class="border-b border-warning-line bg-warning-bg text-warning-fg"
  >
    <p class="mx-auto flex max-w-7xl items-center gap-2.5 px-4 py-3 text-sm font-semibold md:px-6">
      <WifiIcon class="size-5 shrink-0" aria-hidden="true" />Koneksi terputus. Kami coba sambungkan
      lagi otomatis.
    </p>
  </div>
</template>
