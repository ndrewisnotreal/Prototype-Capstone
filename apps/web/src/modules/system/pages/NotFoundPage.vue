<script setup lang="ts">
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { MagnifyingGlassIcon } from '@heroicons/vue/24/outline'
import { AppButton } from '@/shared/ui'

// Layar E-404. Dipakai juga untuk sepatu yang sudah tidak tampil (terjual/nonaktif).
const router = useRouter()
const query = ref('')
const search = () =>
  router.push({ path: '/katalog', query: query.value.trim() ? { q: query.value.trim() } : {} })
</script>

<template>
  <div class="mx-auto flex max-w-[1080px] flex-wrap items-center gap-12 px-6 py-16 lg:py-24">
    <div class="flex min-w-0 flex-[999_1_420px] flex-col gap-4.5">
      <h1 class="text-4xl leading-[1.1] font-extrabold tracking-tight lg:text-[40px]">
        Sepatunya sudah pindah rak
      </h1>
      <p class="max-w-[46ch] text-[17px] leading-relaxed text-gray-700">
        Halaman ini tidak ada, atau sepatunya sudah terjual dan disembunyikan. Coba cari yang mirip.
      </p>
      <form role="search" class="flex max-w-[520px] flex-wrap gap-2.5" @submit.prevent="search">
        <label
          class="focus-within:outline-3 focus-within:outline-offset-2 focus-within:outline-brand-600/45 flex h-12 flex-[1_1_260px] items-center gap-2.5 rounded-control border border-gray-300 bg-white px-3.5 text-gray-600 focus-within:border-brand-600"
        >
          <MagnifyingGlassIcon class="size-5" aria-hidden="true" />
          <span class="sr-only">Cari sepatu</span>
          <input
            v-model="query"
            type="search"
            placeholder="Cari merek atau model"
            class="min-w-0 flex-1 bg-transparent text-[15px] text-gray-900 outline-none"
          />
        </label>
        <AppButton type="submit" label="Lihat Katalog" class="h-12! px-5!" />
      </form>
    </div>
    <div
      aria-hidden="true"
      class="flex-[1_1_280px] text-[120px] leading-none font-extrabold tracking-[-0.06em] text-brand-100 lg:text-[168px]"
    >
      404
    </div>
  </div>
</template>
