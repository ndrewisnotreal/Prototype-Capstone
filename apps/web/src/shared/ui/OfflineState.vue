<script setup lang="ts">
import { watch } from 'vue'
import { ArrowPathIcon, WifiIcon } from '@heroicons/vue/24/outline'
import { isOffline } from '@/shared/lib'
import AppButton from './AppButton.vue'

// Layar E-Offline untuk area konten yang gagal dimuat karena koneksi putus.
// Memancarkan `retry` dari tombol, dan saat koneksi kembali bila `autoRetry`.
const props = withDefaults(
  defineProps<{
    title?: string
    description?: string
    /** tautan "Hubungi WhatsApp resmi" (ke Kanal Resmi), untuk halaman customer */
    contact?: boolean
    /** muat ulang saat koneksi kembali; tidak perlu untuk data dari useRequest (sudah otomatis) */
    autoRetry?: boolean
  }>(),
  {
    title: 'Data belum bisa dimuat',
    description: 'Cek sinyal atau Wi-Fi kamu, lalu coba lagi.',
  },
)
const emit = defineEmits<{ retry: [] }>()

watch(isOffline, (offline) => !offline && props.autoRetry && emit('retry'))
</script>

<template>
  <div role="alert" class="flex flex-wrap items-center gap-12 py-10 lg:py-20">
    <div class="flex min-w-0 flex-[999_1_420px] flex-col gap-4.5">
      <span
        class="flex size-14 items-center justify-center rounded-card bg-brand-50 text-brand-600"
      >
        <WifiIcon class="size-7" aria-hidden="true" />
      </span>
      <h2 class="text-[28px] leading-tight font-extrabold tracking-tight lg:text-4xl">
        {{ title }}
      </h2>
      <p class="max-w-[48ch] text-[17px] leading-relaxed text-gray-700">{{ description }}</p>
      <div class="flex flex-wrap gap-3">
        <AppButton size="lg" label="Coba lagi" :icon="ArrowPathIcon" @click="emit('retry')" />
        <RouterLink
          v-if="contact"
          to="/kanal-resmi"
          class="inline-flex h-13 items-center rounded-control border border-gray-300 bg-white px-5 font-bold text-gray-900 hover:bg-gray-50"
          >Hubungi WhatsApp resmi</RouterLink
        >
      </div>
    </div>
    <div aria-hidden="true" class="hidden flex-[1_1_300px] grid-cols-2 gap-3 md:grid">
      <span class="aspect-square rounded-card bg-gray-200" />
      <span class="aspect-square rounded-card bg-gray-200 opacity-70" />
      <span class="aspect-square rounded-card bg-gray-200 opacity-50" />
      <span class="aspect-square rounded-card bg-gray-200 opacity-30" />
    </div>
  </div>
</template>
