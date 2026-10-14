<script setup lang="ts">
import { useRouter } from 'vue-router'
import { LockClosedIcon } from '@heroicons/vue/24/outline'
import { useAuthStore } from '@/modules/auth'
import { AppButton } from '@/shared/ui'

// Layar E-403
const auth = useAuthStore()
const router = useRouter()
async function switchAccount() {
  await auth.logout()
  await router.push('/masuk')
}
</script>

<template>
  <div class="mx-auto flex max-w-[1080px] flex-wrap items-center gap-12 px-6 py-16 lg:py-24">
    <div class="flex min-w-0 flex-[999_1_420px] flex-col gap-4.5">
      <span
        class="flex size-14 items-center justify-center rounded-card bg-danger-bg text-danger-fg"
      >
        <LockClosedIcon class="size-7" aria-hidden="true" />
      </span>
      <h1 class="text-4xl leading-[1.1] font-extrabold tracking-tight lg:text-[40px]">
        Halaman ini khusus pegawai toko
      </h1>
      <p class="max-w-[46ch] text-[17px] leading-relaxed text-gray-700">
        Akunmu tidak punya akses ke sini. Kalau kamu pegawai, minta owner mengubah role akunmu.
      </p>
      <div class="flex flex-wrap gap-3">
        <RouterLink
          to="/"
          class="inline-flex h-12 items-center rounded-control bg-brand-600 px-5 font-extrabold text-white hover:bg-brand-700"
          >Ke Beranda</RouterLink
        >
        <AppButton
          variant="secondary"
          label="Masuk dengan akun lain"
          class="h-12!"
          @click="switchAccount"
        />
      </div>
    </div>
    <div
      aria-hidden="true"
      class="flex-[1_1_280px] text-[120px] leading-none font-extrabold tracking-[-0.06em] text-brand-100 lg:text-[168px]"
    >
      403
    </div>
  </div>
</template>
