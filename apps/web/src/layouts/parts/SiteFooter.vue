<script setup lang="ts">
import { ClockIcon, MapPinIcon, PhoneIcon, ShieldCheckIcon } from '@heroicons/vue/24/outline'
import type { OfficialChannelsDto } from '@ssb/shared'
import BrandLogo from './BrandLogo.vue'
import { STOREFRONT_LINKS } from './nav'

// Alamat dan kontak HANYA dari API (StoreSetting), tidak di-hardcode. Tanpa store, kolom itu disembunyikan.
defineProps<{ store?: OfficialChannelsDto | null }>()
</script>

<template>
  <footer class="border-t border-gray-200 bg-white">
    <div class="mx-auto flex max-w-7xl flex-col gap-9 px-6 pt-12 pb-7">
      <div class="grid grid-cols-[repeat(auto-fit,minmax(220px,1fr))] gap-8">
        <div class="flex flex-col gap-3.5">
          <div class="flex items-center gap-2.5">
            <BrandLogo />
            <span class="font-extrabold">Suwandi SecondBranded</span>
          </div>
          <p class="max-w-[34ch] text-sm leading-relaxed text-gray-600">
            Sepatu bekas bermerek dari Medan. Setiap pasang dicek dan difoto apa adanya.
          </p>
        </div>

        <template v-if="store">
          <div class="flex flex-col gap-3 text-sm">
            <p class="font-bold">Toko</p>
            <p class="flex gap-2.5 leading-normal text-gray-700">
              <MapPinIcon class="size-5 shrink-0" aria-hidden="true" />{{ store.address }}
            </p>
            <p
              v-for="h in store.openingHours"
              :key="h.days"
              class="flex gap-2.5 leading-normal text-gray-700"
            >
              <ClockIcon class="size-5 shrink-0" aria-hidden="true" />{{ h.days }} {{ h.hours }}
            </p>
          </div>
          <div class="flex flex-col gap-3 text-sm">
            <p class="font-bold">Kontak resmi</p>
            <p class="flex gap-2.5 text-gray-700">
              <PhoneIcon class="size-5 shrink-0" aria-hidden="true" />WhatsApp {{ store.whatsapp }}
            </p>
            <p v-if="store.instagram || store.tiktok" class="text-gray-700">
              Instagram &amp; TikTok:
              {{ [store.instagram, store.tiktok].filter(Boolean).join(' / ') }}
            </p>
          </div>
        </template>

        <nav aria-label="Tautan footer" class="flex flex-col text-sm lg:gap-2.5">
          <p class="mb-1 font-bold lg:mb-0">Belanja</p>
          <RouterLink
            v-for="l in STOREFRONT_LINKS.slice(1)"
            :key="l.to"
            :to="l.to"
            class="flex min-h-11 items-center text-gray-700 hover:text-brand-700 lg:min-h-0"
            >{{ l.label }}</RouterLink
          >
          <RouterLink
            to="/pesanan"
            class="flex min-h-11 items-center text-gray-700 hover:text-brand-700 lg:min-h-0"
            >Pesanan Saya</RouterLink
          >
        </nav>
      </div>

      <div
        class="flex flex-wrap justify-between gap-3 border-t border-gray-200 pt-5 text-[13px] text-gray-600"
      >
        <span>© {{ new Date().getFullYear() }} Suwandi SecondBranded</span>
        <span class="inline-flex items-center gap-1.5">
          <ShieldCheckIcon class="size-4" aria-hidden="true" />
          Kami tidak pernah meminta transfer di luar rekening di halaman Kanal Resmi.
        </span>
      </div>
    </div>
  </footer>
</template>
