<script setup lang="ts">
import { ShieldCheckIcon } from '@heroicons/vue/24/outline'
import { OfflineBanner } from '@/shared/ui'
import storeWall from '@/assets/images/hero-wall.webp'
import BrandLogo from './parts/BrandLogo.vue'

// Masuk/Daftar/Lupa/Reset: panel hijau di kiri (desktop), form di kanan. Di ponsel panel diganti logo kecil.
</script>

<template>
  <div class="flex min-h-screen bg-gray-100">
    <aside
      class="hidden flex-[1_1_460px] flex-col gap-7 bg-brand-700 px-10 py-9 text-white lg:flex"
    >
      <RouterLink
        to="/"
        aria-label="Kembali ke beranda"
        class="flex items-center gap-2.5 text-white"
      >
        <BrandLogo inverted />
        <span class="font-extrabold">Suwandi SecondBranded</span>
      </RouterLink>
      <!-- shortcut: foto contoh (Unsplash, assets/images/CREDITS.md); ganti dengan foto toko asli dari owner -->
      <img
        :src="storeWall"
        alt="Foto rak sepatu di toko"
        class="min-h-80 w-full flex-1 rounded-card bg-brand-600 object-cover"
      />
      <div class="flex flex-col gap-3.5">
        <p class="max-w-[16ch] text-3xl leading-[1.15] font-extrabold tracking-tight">
          Satu akun untuk pesan, bayar, dan pantau pesanan.
        </p>
        <p class="flex items-center gap-2.5 text-sm text-brand-100">
          <ShieldCheckIcon class="size-5" aria-hidden="true" />Pegawai dan owner masuk dari halaman
          yang sama.
        </p>
      </div>
    </aside>

    <div class="flex flex-[1_1_480px] flex-col">
      <OfflineBanner />
      <main class="flex flex-1 flex-col items-center justify-center gap-8 px-6 py-10">
        <RouterLink
          to="/"
          aria-label="Kembali ke beranda"
          class="flex h-11 items-center gap-2 self-start text-gray-900 lg:hidden"
        >
          <BrandLogo size="sm" />
          <span class="text-[15px] font-extrabold"
            >Suwandi <span class="font-medium text-gray-600">SecondBranded</span></span
          >
        </RouterLink>
        <div class="w-full max-w-[420px]"><slot /></div>
      </main>
    </div>
  </div>
</template>
