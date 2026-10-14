<script setup lang="ts">
import { useChatStore } from '@/modules/chatbot'
import { computed, ref, shallowRef, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import {
  AdjustmentsHorizontalIcon,
  MagnifyingGlassIcon,
  XMarkIcon,
} from '@heroicons/vue/24/outline'
import { CONDITION_LABELS, type ProductCardDto } from '@ssb/shared'
import { useRequest } from '@/shared/composables'
import { ApiRequestError, formatRupiah } from '@/shared/lib'
import { AppButton, OfflineState, ProductCard, ProductCardSkeleton } from '@/shared/ui'
import { productsApi } from '../api/products.api'
import {
  activeFilterCount,
  parseCatalogQuery,
  toRouteQuery,
  type CatalogFilters as Filters,
} from '../catalog-query'
import CatalogFilters from '../components/CatalogFilters.vue'

// Layar Katalog (desktop) + M-Katalog dan M-Filter (ponsel). Filter hidup di URL.
const PAGE_SIZE = 12
const route = useRoute()
const router = useRouter()

const categories = useRequest(() => productsApi.categories())
const brands = useRequest(() => productsApi.brands())

const filters = computed(() => parseCatalogQuery(route.query))
const setFilters = (f: Filters) => router.replace({ query: toRouteQuery(f) })
const reset = () => setFilters({ sort: filters.value.sort })

// ---- Daftar sepatu + "Muat lebih banyak" ----
const items = shallowRef<ProductCardDto[]>([])
const total = ref(0)
const page = ref(1)
const loading = ref(true)
const loadingMore = ref(false)
const error = ref('')
const networkError = ref(false)
let requestId = 0 // abaikan respons lama kalau filter sudah berubah lagi

async function load(more = false) {
  const id = ++requestId
  const nextPage = more ? page.value + 1 : 1
  ;(more ? loadingMore : loading).value = true
  error.value = ''
  networkError.value = false
  try {
    const res = await productsApi.list({ ...filters.value, page: nextPage, limit: PAGE_SIZE })
    if (id !== requestId) return
    items.value = more ? [...items.value, ...res.data] : res.data
    total.value = res.meta.total
    page.value = nextPage
  } catch (e) {
    if (id !== requestId) return
    error.value = e instanceof ApiRequestError ? e.message : 'Gagal memuat katalog. Coba lagi.'
    networkError.value = e instanceof ApiRequestError && e.code === 'NETWORK_ERROR'
  } finally {
    if (id === requestId) loading.value = loadingMore.value = false
  }
}
watch(
  () => route.query,
  () => route.path === '/katalog' && load(),
  { immediate: true },
)
const hasMore = computed(() => items.value.length < total.value)

// ---- Chip filter aktif ----
const chips = computed(() => {
  const f = filters.value
  const without =
    <K extends keyof Filters>(key: K, value?: unknown) =>
    () =>
      setFilters({
        ...f,
        [key]: Array.isArray(f[key]) ? (f[key] as unknown[]).filter((v) => v !== value) : undefined,
      })
  const catName = (slug: string) =>
    categories.data.value?.find((c) => c.slug === slug)?.name ?? slug
  return [
    ...(f.q ? [{ label: `"${f.q}"`, remove: without('q') }] : []),
    ...(f.category ?? []).map((v) => ({ label: catName(v), remove: without('category', v) })),
    ...(f.brand ?? []).map((v) => ({ label: v, remove: without('brand', v) })),
    ...(f.size ?? []).map((v) => ({ label: `EU ${v}`, remove: without('size', v) })),
    ...(f.condition ?? []).map((v) => ({
      label: CONDITION_LABELS[v],
      remove: without('condition', v),
    })),
    ...(f.minPrice !== undefined || f.maxPrice !== undefined
      ? [
          {
            label: `${f.minPrice !== undefined ? formatRupiah(f.minPrice) : 'Rp 0'} - ${f.maxPrice !== undefined ? formatRupiah(f.maxPrice) : 'berapa pun'}`,
            remove: () => setFilters({ ...f, minPrice: undefined, maxPrice: undefined }),
          },
        ]
      : []),
    ...(f.hideReserved ? [{ label: 'Hanya tersedia', remove: without('hideReserved') }] : []),
  ]
})

const SORT_OPTIONS = [
  { value: 'newest', label: 'Terbaru' },
  { value: 'price_asc', label: 'Termurah' },
  { value: 'price_desc', label: 'Termahal' },
]

// ---- Ponsel: kolom cari + bottom sheet filter ----
const search = ref('')
watch(
  () => filters.value.q,
  (q) => (search.value = q ?? ''),
  { immediate: true },
)
const submitSearch = () => setFilters({ ...filters.value, q: search.value })
const sheetOpen = ref(false)

const chat = useChatStore()
const openChat = () => chat.open()
</script>

<template>
  <div class="mx-auto flex max-w-7xl flex-col gap-5 px-4 pt-4 pb-14 sm:px-6 lg:pt-8 lg:pb-20">
    <!-- Ponsel: cari + tombol filter + urutkan (M-Katalog) -->
    <div class="flex flex-col gap-3 lg:hidden">
      <form role="search" @submit.prevent="submitSearch">
        <label
          class="focus-within:outline-3 focus-within:outline-offset-2 focus-within:outline-brand-600/45 flex h-12 items-center gap-2.5 rounded-control border border-gray-200 bg-white px-3.5 text-gray-600"
        >
          <MagnifyingGlassIcon class="size-5" aria-hidden="true" />
          <span class="sr-only">Cari</span>
          <input
            v-model="search"
            type="search"
            placeholder="Cari merek, model, ukuran"
            class="min-w-0 flex-1 bg-transparent text-[15px] text-gray-900 outline-none"
          />
        </label>
      </form>
      <div class="flex gap-2.5">
        <button
          type="button"
          class="flex h-11 flex-1 items-center justify-center gap-2 rounded-control border border-gray-300 bg-white text-sm font-bold"
          @click="sheetOpen = true"
        >
          <AdjustmentsHorizontalIcon class="size-5" aria-hidden="true" />Filter
          <span
            v-if="activeFilterCount(filters)"
            class="flex h-5 min-w-5 items-center justify-center rounded-full bg-brand-600 px-1.5 text-xs text-white"
            :aria-label="`${activeFilterCount(filters)} filter aktif`"
            >{{ activeFilterCount(filters) }}</span
          >
        </button>
        <Select
          :model-value="filters.sort ?? 'newest'"
          :options="SORT_OPTIONS"
          option-label="label"
          option-value="value"
          aria-label="Urutkan"
          class="flex-1"
          @update:model-value="setFilters({ ...filters, sort: $event })"
        />
      </div>
    </div>

    <!-- Desktop: judul + jumlah + urutkan -->
    <div class="hidden flex-wrap items-end justify-between gap-4 lg:flex">
      <div>
        <h1 class="text-4xl font-extrabold tracking-tight">Katalog</h1>
        <p role="status" class="mt-1.5 text-[15px] text-gray-600">
          <template v-if="!loading"
            ><strong class="text-gray-900">{{ total }} sepatu</strong> cocok dengan
            filtermu</template
          >
          <template v-else>Mencari sepatu...</template>
        </p>
      </div>
      <label class="flex items-center gap-2.5 text-sm font-semibold">
        Urutkan
        <Select
          :model-value="filters.sort ?? 'newest'"
          :options="SORT_OPTIONS"
          option-label="label"
          option-value="value"
          class="w-40"
          @update:model-value="setFilters({ ...filters, sort: $event })"
        />
      </label>
    </div>

    <div v-if="chips.length" class="flex flex-wrap items-center gap-2">
      <button
        v-for="c in chips"
        :key="c.label"
        type="button"
        :aria-label="`Hapus filter ${c.label}`"
        class="inline-flex h-9 items-center gap-1.5 rounded-full border border-brand-600 bg-brand-50 pr-2.5 pl-3.5 text-[13px] font-bold text-brand-700"
        @click="c.remove"
      >
        {{ c.label }}<XMarkIcon class="size-4" stroke-width="2" aria-hidden="true" />
      </button>
      <button
        type="button"
        class="h-9 px-2.5 text-[13px] font-bold text-brand-700 underline"
        @click="reset"
      >
        Hapus semua
      </button>
    </div>

    <p role="status" class="text-sm text-gray-600 lg:hidden">
      <template v-if="!loading"
        ><strong class="text-gray-900">{{ total }} sepatu</strong> ditemukan</template
      >
    </p>

    <div class="flex items-start gap-7">
      <aside
        aria-label="Filter"
        class="sticky top-4 hidden w-[260px] shrink-0 flex-col rounded-card border border-gray-200 bg-white lg:flex"
      >
        <p class="flex items-center gap-2.5 border-b border-gray-100 px-5 py-4 font-extrabold">
          <AdjustmentsHorizontalIcon class="size-5" aria-hidden="true" />Filter
        </p>
        <CatalogFilters
          variant="sidebar"
          :filters="filters"
          :categories="categories.data.value ?? []"
          :brands="brands.data.value ?? []"
          @change="setFilters"
        />
      </aside>

      <section aria-label="Hasil" class="flex min-w-0 flex-1 flex-col gap-6">
        <div v-if="loading" class="grid grid-cols-2 gap-3 sm:gap-5 md:grid-cols-3">
          <ProductCardSkeleton v-for="i in 6" :key="i" />
        </div>

        <OfflineState
          v-else-if="networkError"
          title="Katalog belum bisa dimuat"
          description="Cek sinyal atau Wi-Fi kamu. Keranjang dan pesananmu aman tersimpan, tidak ada yang hilang."
          contact
          auto-retry
          @retry="load()"
        />

        <div
          v-else-if="error"
          role="alert"
          class="flex flex-col items-center gap-3 rounded-card border border-gray-200 bg-white px-6 py-14 text-center"
        >
          <p class="text-lg font-extrabold">Katalog belum bisa dimuat</p>
          <p class="text-[15px] text-gray-600">{{ error }}</p>
          <AppButton label="Coba lagi" @click="load()" />
        </div>

        <div
          v-else-if="!items.length"
          class="flex flex-col items-center gap-3 rounded-card border border-gray-200 bg-white px-6 py-14 text-center"
        >
          <span
            class="flex size-16 items-center justify-center rounded-card bg-brand-50 text-brand-600"
          >
            <MagnifyingGlassIcon class="size-8" aria-hidden="true" />
          </span>
          <p class="text-xl font-extrabold">Belum ada yang cocok</p>
          <p class="max-w-[42ch] text-[15px] text-gray-600">
            Coba ukuran atau merek lain, atau tanya Asisten untuk dicarikan alternatif.
          </p>
          <div class="mt-1.5 flex flex-wrap justify-center gap-2.5">
            <AppButton label="Hapus semua filter" @click="reset" />
            <AppButton variant="secondary" label="Tanya Asisten" @click="openChat" />
          </div>
        </div>

        <template v-else>
          <div class="grid grid-cols-2 gap-3 sm:gap-5 md:grid-cols-3">
            <ProductCard v-for="p in items" :key="p.code" :product="p" />
          </div>
          <AppButton
            v-if="hasMore"
            variant="secondary"
            size="lg"
            :label="`Muat lebih banyak (${total - items.length} lagi)`"
            :loading="loadingMore"
            class="self-center"
            @click="load(true)"
          />
        </template>
      </section>
    </div>

    <Drawer
      v-model:visible="sheetOpen"
      position="bottom"
      class="h-[88vh]! rounded-t-card"
      :pt="{
        header: { class: 'hidden' },
        content: { class: 'p-0 flex flex-col' },
        root: { 'aria-labelledby': 'filter-h' },
      }"
    >
      <header class="flex items-center justify-between border-b border-gray-100 px-5 py-3">
        <h2 id="filter-h" class="text-lg font-extrabold">Filter</h2>
        <span class="flex items-center gap-1">
          <button
            type="button"
            class="min-h-11 px-3 text-sm font-bold text-brand-700"
            @click="reset"
          >
            Reset
          </button>
          <button
            type="button"
            aria-label="Tutup filter"
            class="flex size-11 items-center justify-center rounded-control"
            @click="sheetOpen = false"
          >
            <XMarkIcon class="size-6" aria-hidden="true" />
          </button>
        </span>
      </header>
      <div class="flex-1 overflow-y-auto">
        <CatalogFilters
          variant="sheet"
          :filters="filters"
          :categories="categories.data.value ?? []"
          :brands="brands.data.value ?? []"
          @change="setFilters"
        />
      </div>
      <footer class="border-t border-gray-100 p-4">
        <AppButton
          size="lg"
          :label="loading ? 'Mencari...' : `Tampilkan ${total} sepatu`"
          class="w-full"
          @click="sheetOpen = false"
        />
      </footer>
    </Drawer>
  </div>
</template>
