<script setup lang="ts">
import { ref, shallowRef, watch } from 'vue'
import {
  MagnifyingGlassIcon,
  PencilSquareIcon,
  PhotoIcon,
  PlusIcon,
} from '@heroicons/vue/24/outline'
import {
  CONDITION_LABELS,
  PRODUCT_STATUS_LABELS,
  type PanelProductDto,
  type ProductSort,
  type ProductStatus,
} from '@ssb/shared'
import { useNotify, useRequest } from '@/shared/composables'
import { ApiRequestError, formatRupiah } from '@/shared/lib'
import { AppButton, AppDataTable, StatusBadge } from '@/shared/ui'
import { panelProductsApi } from '../api/products.api'

// Layar P-Produk: tab status + cari + tabel produk semua status.
const LIMIT = 12
const TABS: { value: ProductStatus | undefined; label: string }[] = [
  { value: undefined, label: 'Semua' },
  ...(['AVAILABLE', 'RESERVED', 'SOLD', 'INACTIVE'] as const).map((s) => ({
    value: s,
    label: PRODUCT_STATUS_LABELS[s].label,
  })),
]

const notify = useNotify()
const counts = useRequest(() => panelProductsApi.statusCounts())

const status = ref<ProductStatus>()
const search = ref('')
const query = ref('')
const sort = ref<ProductSort>('newest')
const page = ref(1)

const rows = shallowRef<PanelProductDto[]>([])
const total = ref(0)
const loading = ref(true)
const error = ref('')
let requestId = 0

async function load() {
  const id = ++requestId
  loading.value = true
  error.value = ''
  try {
    const res = await panelProductsApi.list({
      status: status.value,
      q: query.value,
      sort: sort.value,
      page: page.value,
      limit: LIMIT,
    })
    if (id !== requestId) return
    rows.value = res.data
    total.value = res.meta.total
  } catch (e) {
    if (id === requestId)
      error.value = e instanceof ApiRequestError ? e.message : 'Gagal memuat produk.'
  } finally {
    if (id === requestId) loading.value = false
  }
}
watch([status, query, sort], () => {
  page.value = 1
  void load()
})
watch(page, () => void load(), { immediate: true })

// Cari setelah berhenti mengetik sebentar, supaya tidak memanggil API tiap huruf
let timer: ReturnType<typeof setTimeout> | undefined
watch(search, (v) => {
  clearTimeout(timer)
  timer = setTimeout(() => (query.value = v.trim()), 300)
})

function onSort(field: string | undefined, order: 1 | -1 | 0) {
  sort.value = field === 'price' && order ? (order === 1 ? 'price_asc' : 'price_desc') : 'newest'
}

const toggling = ref<number>()
async function toggle(p: PanelProductDto) {
  const next = p.status === 'INACTIVE' ? 'AVAILABLE' : 'INACTIVE'
  toggling.value = p.id
  try {
    await panelProductsApi.setStatus(p.id, next)
    notify.success(
      next === 'INACTIVE' ? `${p.code} dinonaktifkan.` : `${p.code} tampil lagi di katalog.`,
    )
    await Promise.all([load(), counts.run()])
  } catch (e) {
    notify.error(e instanceof ApiRequestError ? e.message : 'Gagal mengubah status.')
  } finally {
    toggling.value = undefined
  }
}
</script>

<template>
  <header class="flex flex-wrap items-center justify-between gap-3">
    <div>
      <h1 class="text-[28px] font-extrabold tracking-tight">Daftar produk</h1>
      <p class="mt-1 text-sm text-gray-600">
        {{ counts.data.value?.all ?? '...' }} sepatu di sistem
      </p>
    </div>
    <RouterLink
      to="/panel/produk/baru"
      class="inline-flex h-11 items-center gap-2 rounded-control bg-brand-600 px-4 text-sm font-bold text-white hover:bg-brand-700"
    >
      <PlusIcon class="size-5" aria-hidden="true" />Tambah sepatu
    </RouterLink>
  </header>

  <div class="flex flex-wrap items-center justify-between gap-3">
    <div
      role="tablist"
      aria-label="Filter status"
      class="flex flex-wrap gap-1 rounded-control bg-gray-200 p-1"
    >
      <button
        v-for="t in TABS"
        :key="t.label"
        type="button"
        role="tab"
        :aria-selected="status === t.value"
        class="h-9 rounded-[10px] px-3 text-[13px] text-gray-900"
        :class="
          status === t.value
            ? 'bg-white font-extrabold shadow-[0_1px_3px_rgb(17_24_39/0.12)]'
            : 'font-semibold'
        "
        @click="status = t.value"
      >
        {{ t.label }}
        <span class="font-semibold text-gray-600">{{
          counts.data.value?.[t.value ?? 'all'] ?? ''
        }}</span>
      </button>
    </div>
    <label
      class="focus-within:outline-3 focus-within:outline-offset-2 focus-within:outline-brand-600/45 flex h-11 w-[300px] max-w-full items-center gap-2 rounded-control border border-gray-200 bg-white px-3 text-gray-600 focus-within:border-brand-600"
    >
      <MagnifyingGlassIcon class="size-5" aria-hidden="true" />
      <span class="sr-only">Cari produk</span>
      <input
        v-model="search"
        type="search"
        placeholder="Kode, merek, atau model"
        class="min-w-0 flex-1 bg-transparent text-sm text-gray-900 outline-none"
      />
    </label>
  </div>

  <AppDataTable
    v-model:page="page"
    :rows="rows"
    :total="total"
    :limit="LIMIT"
    :loading="loading"
    :error="error"
    noun="sepatu"
    empty-title="Belum ada sepatu di sini"
    :empty-text="query ? 'Coba kata kunci lain.' : 'Tambah sepatu pertama untuk mulai berjualan.'"
    :sort-field="sort === 'newest' ? undefined : 'price'"
    :sort-order="sort === 'price_asc' ? 1 : sort === 'price_desc' ? -1 : 0"
    @sort="onSort"
    @retry="load"
  >
    <Column header="Sepatu" :pt="{ headerCell: { class: 'pl-5' }, bodyCell: { class: 'pl-5' } }">
      <template #body="{ data }: { data: PanelProductDto }">
        <span class="flex items-center gap-3" :class="data.status === 'INACTIVE' && 'opacity-60'">
          <img
            v-if="data.primaryPhotoUrl"
            :src="data.primaryPhotoUrl"
            :alt="`${data.brand} ${data.model}`"
            class="size-12 shrink-0 rounded-[10px] object-cover"
          />
          <span
            v-else
            role="img"
            :aria-label="`Foto ${data.brand} ${data.model} belum ada`"
            class="flex size-12 shrink-0 items-center justify-center rounded-[10px] bg-photo text-gray-500"
          >
            <PhotoIcon class="size-5" aria-hidden="true" />
          </span>
          <span class="flex flex-col">
            <span class="text-xs font-bold text-gray-600">{{ data.brand }}</span>
            <span class="font-bold">{{ data.model }}</span>
          </span>
        </span>
      </template>
    </Column>
    <Column field="code" header="Kode">
      <template #body="{ data }: { data: PanelProductDto }"
        ><span class="text-gray-700 tabular-nums">{{ data.code }}</span></template
      >
    </Column>
    <Column header="Ukuran">
      <template #body="{ data }: { data: PanelProductDto }">EU {{ data.sizeEu }}</template>
    </Column>
    <Column header="Kondisi">
      <template #body="{ data }: { data: PanelProductDto }">{{
        CONDITION_LABELS[data.condition]
      }}</template>
    </Column>
    <Column field="price" header="Harga" sortable>
      <template #body="{ data }: { data: PanelProductDto }"
        ><span class="font-bold tabular-nums">{{ formatRupiah(data.price) }}</span></template
      >
    </Column>
    <Column header="Status">
      <template #body="{ data }: { data: PanelProductDto }"
        ><StatusBadge type="product" :status="data.status"
      /></template>
    </Column>
    <Column
      header="Aksi"
      :pt="{
        headerCell: { class: 'pr-5' },
        columnHeaderContent: { class: 'justify-end' },
        bodyCell: { class: 'pr-5' },
      }"
    >
      <template #body="{ data }: { data: PanelProductDto }">
        <span class="flex items-center justify-end gap-1.5 whitespace-nowrap">
          <RouterLink
            :to="`/panel/produk/${data.id}/edit`"
            :aria-label="`Edit ${data.model}`"
            class="inline-flex size-9 items-center justify-center rounded-[10px] border border-gray-200 text-gray-900 hover:bg-gray-50"
          >
            <PencilSquareIcon class="size-5" aria-hidden="true" />
          </RouterLink>
          <AppButton
            v-if="data.status === 'AVAILABLE' || data.status === 'INACTIVE'"
            variant="secondary"
            size="sm"
            :label="data.status === 'INACTIVE' ? 'Aktifkan' : 'Nonaktifkan'"
            :loading="toggling === data.id"
            class="text-xs!"
            @click="toggle(data)"
          />
        </span>
      </template>
    </Column>
  </AppDataTable>
</template>
