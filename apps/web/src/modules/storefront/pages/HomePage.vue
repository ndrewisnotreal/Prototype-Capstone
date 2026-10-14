<script setup lang="ts">
import { useChatStore } from '@/modules/chatbot'
import { computed, nextTick, watch } from 'vue'
import { useRoute } from 'vue-router'
import {
  ArrowRightIcon,
  ArrowUpTrayIcon,
  ChartBarIcon,
  ChevronRightIcon,
  MagnifyingGlassIcon,
  ShieldCheckIcon,
  ShoppingBagIcon,
  SparklesIcon,
  TagIcon,
  TruckIcon,
} from '@heroicons/vue/24/outline'
import { useRequest } from '@/shared/composables'
import { formatRelativeDays } from '@/shared/lib'
import { AppButton, EmptyState, ProductCard, ProductCardSkeleton } from '@/shared/ui'
import categoryRunning from '@/assets/images/category-running.webp'
import categorySneakers from '@/assets/images/category-sneakers.webp'
import heroDetail from '@/assets/images/hero-detail.webp'
import heroStore from '@/assets/images/hero-store.webp'
import heroWall from '@/assets/images/hero-wall.webp'
import { productsApi } from '../api/products.api'
import { paymentDeadlineHours } from '../store-info'

// Layar Main (desktop) + M-Beranda (mobile). Semua data sepatu, merek, dan kategori dari API.
const fresh = useRequest(() => productsApi.list({ sort: 'newest', limit: 4 }))
const sold = useRequest(() => productsApi.recentlySold())
const brands = useRequest(() => productsApi.brands())
const categories = useRequest(() => productsApi.categories())

// Datang dari halaman lain lewat "Cara Belanja" (/#cara-belanja): router sudah menggulir, tetapi bagian di atasnya baru
// terisi setelah data dimuat sehingga posisinya bergeser. Gulir ulang sekali setelah semua data selesai.
const route = useRoute()
const settled = computed(() => ![fresh, sold, brands, categories].some((r) => r.loading.value))
watch(settled, async (done) => {
  if (!done || !route.hash) return
  await nextTick()
  const el = document.querySelector(route.hash)
  if (el)
    window.scrollTo({
      top: el.getBoundingClientRect().top + window.scrollY - 16,
      behavior: 'smooth',
    })
})

const SIZES = [39, 40, 41, 42, 43, 44, 45]
// Gaya 4 petak "Pilih dari gayamu" (desain bento); petak diisi kategori dari API sesuai urutan.
// Ponsel (M-Beranda): petak 1 tinggi di kiri, petak 2-3 bertumpuk di kanan (teks di bawah), petak 4 selebar penuh.
const TILES = [
  'row-span-2 lg:col-span-2 lg:row-span-2 bg-brand-100 text-brand-900',
  'justify-end lg:col-span-2 bg-accent-100 text-[#3D2B00]',
  'justify-end border border-gray-200 bg-white text-gray-900',
  'col-span-2 justify-center lg:col-span-1 bg-brand-600 text-white',
]
const TAGLINES: Record<string, string> = { running: 'Ringan untuk dipakai harian' }
// Foto contoh per kategori (assets/images/CREDITS.md); petak 1 = foto besar di atas, petak 2 = foto di kanan (desain Main)
const CATEGORY_PHOTOS: Record<string, string> = {
  sneakers: categorySneakers,
  running: categoryRunning,
}

const chat = useChatStore()
const openChat = () => chat.open()

// computed: teks batas bayar ikut berubah setelah info toko termuat
const STEPS = computed(() => [
  {
    icon: MagnifyingGlassIcon,
    title: 'Pilih sepatunya',
    text: 'Cek ukuran, kondisi, dan foto minusnya. Stok cuma satu.',
  },
  {
    icon: ShoppingBagIcon,
    title: 'Checkout',
    text: `Sepatu langsung direservasi untukmu selama ${paymentDeadlineHours()} jam.`,
  },
  {
    icon: ArrowUpTrayIcon,
    title: 'Transfer dan unggah bukti',
    text: 'Transfer ke rekening resmi, lalu unggah foto bukti transfernya.',
  },
  {
    icon: TruckIcon,
    title: 'Ambil atau terima paket',
    text: 'Setelah diverifikasi, ambil di toko atau tunggu kiriman ekspedisi.',
    accent: true,
  },
])
</script>

<template>
  <div
    class="mx-auto flex max-w-7xl flex-col gap-14 px-4 pt-4 pb-14 sm:px-6 lg:gap-[72px] lg:pt-14 lg:pb-[72px]"
  >
    <!-- Mobile: kolom cari di atas (M-Beranda) -->
    <RouterLink
      to="/katalog"
      class="flex h-12 items-center gap-2.5 rounded-control border border-gray-200 bg-white px-3.5 text-[15px] text-gray-600 lg:hidden"
    >
      <MagnifyingGlassIcon class="size-5" aria-hidden="true" />Cari merek, model, ukuran
    </RouterLink>

    <section
      aria-labelledby="hero-h"
      class="-mt-8 flex flex-wrap items-center gap-6 lg:mt-0 lg:gap-10"
    >
      <div class="flex min-w-0 flex-[999_1_520px] flex-col gap-5 lg:gap-6">
        <h1
          id="hero-h"
          class="max-w-[14ch] text-[32px] leading-[1.05] font-extrabold tracking-[-0.03em] lg:text-[clamp(36px,4.6vw,60px)]"
        >
          Sepatu branded bekas, dicek satu per satu.
        </h1>
        <p class="max-w-[46ch] text-base leading-relaxed text-gray-700 lg:text-lg">
          Tiap pasang cuma ada satu. Lihat foto asli, ukuran, dan minusnya, lalu bayar aman lewat
          kanal resmi.
        </p>
        <div class="flex flex-wrap gap-3">
          <RouterLink
            to="/katalog"
            class="inline-flex h-13 w-full items-center justify-center gap-2.5 rounded-control bg-brand-600 px-6 font-bold text-white shadow-[0_6px_16px_rgb(59_93_80/0.25)] hover:bg-brand-700 sm:w-auto"
          >
            Lihat Katalog<ArrowRightIcon class="size-5" aria-hidden="true" />
          </RouterLink>
          <AppButton
            variant="secondary"
            size="lg"
            label="Tanya Asisten"
            :icon="SparklesIcon"
            class="hidden! sm:inline-flex!"
            @click="openChat"
          />
        </div>
      </div>

      <!-- shortcut: foto contoh (Unsplash, assets/images/CREDITS.md); ganti dengan foto toko asli dari owner -->
      <div
        class="order-first grid w-full flex-[1_1_420px] grid-cols-5 gap-3 lg:order-none lg:w-auto"
      >
        <img
          :src="heroWall"
          alt="Deretan sneakers bermerek di rak dinding toko"
          width="1200"
          height="902"
          fetchpriority="high"
          class="col-span-5 aspect-[4/3] w-full rounded-card bg-photo object-cover lg:col-span-3 lg:aspect-[3/4]"
        />
        <!-- gambar absolut: tinggi kolom ini mengikuti foto utama, bukan ukuran asli gambar -->
        <div class="col-span-2 hidden grid-rows-2 gap-3 lg:grid">
          <div class="relative overflow-hidden rounded-card bg-photo">
            <img
              :src="heroDetail"
              alt="Detail sepatu Converse high-top bekas yang sudah dicek"
              loading="lazy"
              class="absolute inset-0 size-full object-cover"
            />
          </div>
          <div class="relative overflow-hidden rounded-card bg-photo">
            <img
              :src="heroStore"
              alt="Rak sepatu di dinding toko"
              loading="lazy"
              class="absolute inset-0 size-full object-cover"
            />
          </div>
        </div>
      </div>
    </section>

    <section aria-label="Cari cepat berdasarkan ukuran" class="-mt-6 lg:-mt-4">
      <div
        class="flex flex-wrap items-center gap-3 rounded-card border border-gray-200 bg-white px-4 py-4 lg:px-5"
      >
        <span class="mr-1 w-full text-[15px] font-bold sm:w-auto">Ukuranmu berapa?</span>
        <RouterLink
          v-for="size in SIZES"
          :key="size"
          :to="{ path: '/katalog', query: { size } }"
          :aria-label="`Lihat sepatu ukuran EU ${size}`"
          class="inline-flex h-11 min-w-13 items-center justify-center rounded-full border border-gray-300 px-3.5 text-sm font-bold text-gray-900 hover:border-brand-600 hover:bg-brand-50"
          >{{ size }}</RouterLink
        >
        <RouterLink
          to="/katalog"
          class="ml-auto hidden min-h-11 items-center gap-1.5 text-sm font-bold text-brand-700 sm:inline-flex"
        >
          Semua ukuran<ChevronRightIcon class="size-4" aria-hidden="true" />
        </RouterLink>
      </div>
    </section>

    <section aria-labelledby="new-h" class="flex flex-col gap-5 lg:gap-6">
      <div class="flex items-end justify-between gap-3">
        <h2 id="new-h" class="text-2xl font-extrabold tracking-tight lg:text-[32px]">Baru masuk</h2>
        <RouterLink
          to="/katalog"
          class="inline-flex min-h-11 items-center gap-1.5 font-bold text-brand-700"
        >
          Lihat semua<ArrowRightIcon class="size-4" aria-hidden="true" />
        </RouterLink>
      </div>
      <div v-if="fresh.loading.value" class="grid grid-cols-2 gap-3 sm:gap-5 lg:grid-cols-4">
        <ProductCardSkeleton v-for="i in 4" :key="i" />
      </div>
      <div
        v-else-if="fresh.error.value"
        role="alert"
        class="flex flex-wrap items-center justify-between gap-3 rounded-card border border-danger-line bg-danger-bg px-5 py-4 text-sm font-semibold text-danger-fg"
      >
        {{ fresh.error.value }}
        <AppButton variant="secondary" size="sm" label="Coba lagi" @click="fresh.run" />
      </div>
      <EmptyState
        v-else-if="!fresh.data.value?.data.length"
        title="Belum ada sepatu baru"
        description="Stok baru sedang difoto. Mampir lagi sebentar, ya."
        :icon="ShoppingBagIcon"
      />
      <div v-else class="grid grid-cols-2 gap-3 sm:gap-5 lg:grid-cols-4">
        <ProductCard v-for="p in fresh.data.value.data" :key="p.code" :product="p" />
      </div>
    </section>

    <section
      v-if="categories.data.value?.length"
      aria-labelledby="cat-h"
      class="flex flex-col gap-5 lg:gap-6"
    >
      <h2 id="cat-h" class="text-2xl font-extrabold tracking-tight lg:text-[32px]">
        Pilih dari gayamu
      </h2>
      <div
        class="grid grid-cols-2 grid-rows-[104px_104px_64px] gap-2.5 lg:grid-cols-4 lg:grid-rows-none lg:auto-rows-[200px] lg:gap-4"
      >
        <RouterLink
          v-for="(c, i) in categories.data.value.slice(0, 4)"
          :key="c.id"
          :to="{ path: '/katalog', query: { category: c.slug } }"
          class="flex min-w-0 flex-col rounded-card p-4 lg:justify-between lg:p-6"
          :class="[
            TILES[i],
            i === 1 && CATEGORY_PHOTOS[c.slug] && 'lg:flex-row lg:items-end lg:gap-4',
          ]"
        >
          <img
            v-if="i === 0 && CATEGORY_PHOTOS[c.slug]"
            :src="CATEGORY_PHOTOS[c.slug]"
            :alt="`Foto kategori ${c.name}`"
            loading="lazy"
            class="mb-3 min-h-0 w-full flex-1 rounded-control bg-brand-300 object-cover lg:mb-5"
          />
          <ChartBarIcon v-if="i === 2" class="hidden size-7 lg:block" aria-hidden="true" />
          <TagIcon v-if="i === 3" class="hidden size-7 lg:block" aria-hidden="true" />
          <span class="flex items-end justify-between gap-2">
            <span class="flex flex-col gap-1.5">
              <span
                class="font-extrabold lg:text-[22px]"
                :class="i === 0 ? 'text-xl lg:text-[28px]' : 'text-[17px]'"
                >{{ c.name }}</span
              >
              <span
                v-if="TAGLINES[c.slug] && i === 1"
                class="hidden text-sm text-[#5C4300] lg:block"
                >{{ TAGLINES[c.slug] }}</span
              >
            </span>
            <!-- panah: ponsel hanya di petak selebar penuh (desain M-Beranda); desktop kecuali petak berfoto samping -->
            <ArrowRightIcon
              class="size-5 shrink-0"
              :class="[
                i !== 3 && 'hidden lg:block',
                i === 1 && CATEGORY_PHOTOS[c.slug] && 'lg:hidden',
              ]"
              aria-hidden="true"
            />
          </span>
          <img
            v-if="i === 1 && CATEGORY_PHOTOS[c.slug]"
            :src="CATEGORY_PHOTOS[c.slug]"
            :alt="`Foto kategori ${c.name}`"
            loading="lazy"
            class="hidden h-full w-[46%] shrink-0 rounded-control bg-accent-400/30 object-cover lg:block"
          />
        </RouterLink>
      </div>
      <div v-if="brands.data.value?.length" class="flex flex-wrap items-center gap-2.5">
        <span class="mr-1 text-sm font-semibold text-gray-600">Merek populer:</span>
        <RouterLink
          v-for="b in brands.data.value"
          :key="b.id"
          :to="{ path: '/katalog', query: { brand: b.name } }"
          class="inline-flex h-11 items-center rounded-full border border-gray-200 bg-white px-4 text-sm font-bold text-gray-900 hover:border-brand-600"
          >{{ b.name }}</RouterLink
        >
      </div>
    </section>

    <section aria-labelledby="safe-h">
      <div
        class="flex flex-wrap items-center gap-5 rounded-card bg-brand-700 p-6 text-white lg:gap-7 lg:p-10"
      >
        <span
          class="flex size-14 shrink-0 items-center justify-center rounded-card bg-accent-400/16 text-accent-400 lg:size-16"
        >
          <ShieldCheckIcon class="size-8" aria-hidden="true" />
        </span>
        <div class="flex min-w-0 flex-[1_1_420px] flex-col gap-2">
          <h2 id="safe-h" class="text-xl font-extrabold lg:text-[26px]">
            Belanja aman di kanal resmi
          </h2>
          <p class="max-w-[60ch] leading-relaxed text-brand-100">
            Ada penipu yang mengatasnamakan toko kami. Transfer hanya ke rekening yang tercantum di
            halaman Kanal Resmi atau di halaman pesananmu.
          </p>
        </div>
        <RouterLink
          to="/kanal-resmi"
          class="inline-flex h-13 w-full shrink-0 items-center justify-center rounded-control bg-accent-400 px-5.5 text-[15px] font-extrabold text-gray-900 hover:bg-accent-500 sm:w-auto"
          >Cek Kanal Resmi</RouterLink
        >
      </div>
    </section>

    <section
      id="cara-belanja"
      aria-labelledby="how-h"
      class="flex scroll-mt-24 flex-col gap-5 lg:gap-7"
    >
      <h2 id="how-h" class="text-2xl font-extrabold tracking-tight lg:text-[32px]">Cara belanja</h2>
      <ol
        class="grid grid-cols-1 overflow-hidden rounded-card border border-gray-200 bg-white sm:grid-cols-2 lg:grid-cols-4"
      >
        <li
          v-for="(s, i) in STEPS"
          :key="s.title"
          class="flex gap-3.5 border-gray-200 p-5 lg:flex-col lg:gap-3 lg:p-7 [&:not(:last-child)]:border-b lg:[&:not(:last-child)]:border-r lg:[&:not(:last-child)]:border-b-0"
        >
          <span
            class="flex size-12 shrink-0 items-center justify-center rounded-control"
            :class="s.accent ? 'bg-warning-bg text-warning-fg' : 'bg-brand-50 text-brand-600'"
          >
            <component :is="s.icon" class="size-6" aria-hidden="true" />
          </span>
          <span class="flex flex-col gap-1 lg:gap-3">
            <span class="text-[17px] font-extrabold"
              ><span class="sr-only">Langkah {{ i + 1 }}: </span>{{ s.title }}</span
            >
            <span class="text-sm leading-relaxed text-gray-600">{{ s.text }}</span>
          </span>
        </li>
      </ol>
    </section>

    <!-- Bukti sosial saja: disembunyikan kalau kosong atau gagal dimuat -->
    <section v-if="sold.data.value?.length" aria-labelledby="sold-h" class="flex flex-col gap-5">
      <div class="flex flex-col gap-1.5">
        <h2 id="sold-h" class="text-2xl font-extrabold">Baru terjual</h2>
        <p class="text-[15px] text-gray-600">Yang sudah pindah ke pemilik baru belakangan ini.</p>
      </div>
      <!-- tabindex: daftar geser bisa digulir dengan keyboard -->
      <ul
        tabindex="0"
        aria-labelledby="sold-h"
        class="-mx-4 flex snap-x snap-mandatory gap-3.5 overflow-x-auto px-4 pb-2 sm:mx-0 sm:px-0"
      >
        <li
          v-for="s in sold.data.value"
          :key="s.code"
          class="flex w-[280px] shrink-0 snap-start items-center gap-3 rounded-card border border-gray-200 bg-white p-2.5"
        >
          <img
            v-if="s.primaryPhotoUrl"
            :src="s.primaryPhotoUrl"
            :alt="`${s.brand} ${s.model}`"
            loading="lazy"
            class="size-16 shrink-0 rounded-control object-cover opacity-60"
          />
          <span
            v-else
            role="img"
            :aria-label="`Foto ${s.brand} ${s.model}`"
            class="size-16 shrink-0 rounded-control bg-photo opacity-60"
          />
          <span class="flex min-w-0 flex-col gap-1">
            <span class="truncate text-sm font-bold">{{ s.brand }} {{ s.model }}</span>
            <span class="text-xs text-gray-600"
              >EU {{ s.sizeEu }} · {{ formatRelativeDays(s.soldAt) }}</span
            >
            <span
              class="self-start rounded-full bg-neutral-bg px-2 py-0.5 text-[11px] font-bold text-neutral-fg"
              >Terjual</span
            >
          </span>
        </li>
      </ul>
    </section>
  </div>
</template>
