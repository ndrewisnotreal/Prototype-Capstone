<script setup lang="ts">
import { ref, shallowRef, watch } from 'vue'
import { useRoute } from 'vue-router'
import { MagnifyingGlassIcon } from '@heroicons/vue/24/outline'
import type { PanelOrderDetailDto, PanelOrderDto, PanelOrderTab } from '@ssb/shared'
import { useRequest } from '@/shared/composables'
import { ApiRequestError, formatRupiah } from '@/shared/lib'
import { AppDataTable, StatusBadge } from '@/shared/ui'
import { panelOrdersApi } from '../api/orders.api'
import OrderDrawer from '../components/OrderDrawer.vue'

// Layar P-Pesanan: tab status + cari + tabel; klik baris membuka Drawer detail dengan aksi sesuai status.
const LIMIT = 20
const TABS: { value: PanelOrderTab; label: string }[] = [
  { value: 'all', label: 'Semua' },
  { value: 'unpaid', label: 'Belum lunas' },
  { value: 'processing', label: 'Diproses' },
  { value: 'delivering', label: 'Siap diambil atau dikirim' },
  { value: 'completed', label: 'Selesai' },
  { value: 'cancelled', label: 'Dibatalkan' },
]

const route = useRoute()
const counts = useRequest(() => panelOrdersApi.counts())
const tab = ref<PanelOrderTab>(
  TABS.some((t) => t.value === route.query.tab) ? (route.query.tab as PanelOrderTab) : 'all',
)
// ?q= dari dashboard / pencarian dashboard
const search = ref(String(route.query.q ?? ''))
const query = ref(search.value.trim())
const page = ref(1)
const rows = shallowRef<PanelOrderDto[]>([])
const total = ref(0)
const loading = ref(true)
const error = ref('')

const drawerOpen = ref(false)
const selected = shallowRef<PanelOrderDetailDto | null>(null)
const selectedCode = ref('')
const detailError = ref('')

let requestId = 0
async function load() {
  const id = ++requestId
  loading.value = true
  error.value = ''
  try {
    const res = await panelOrdersApi.list({
      tab: tab.value,
      q: query.value,
      page: page.value,
      limit: LIMIT,
    })
    if (id !== requestId) return
    rows.value = res.data
    total.value = res.meta.total
    // dari dashboard (?q=<kode>): langsung buka pesanan itu
    const exact = res.data.find((r) => r.code.toLowerCase() === query.value.toLowerCase())
    if (exact && !selectedCode.value) void open(exact.code)
  } catch (e) {
    if (id === requestId)
      error.value = e instanceof ApiRequestError ? e.message : 'Gagal memuat pesanan.'
  } finally {
    if (id === requestId) loading.value = false
  }
}
watch([tab, query], () => {
  page.value = 1
  void load()
})
watch(page, () => void load(), { immediate: true })

let timer: ReturnType<typeof setTimeout> | undefined
watch(search, (v) => {
  clearTimeout(timer)
  timer = setTimeout(() => (query.value = v.trim()), 300)
})

async function open(code: string) {
  selectedCode.value = code
  selected.value = null
  detailError.value = ''
  drawerOpen.value = true
  try {
    selected.value = await panelOrdersApi.detail(code)
  } catch (e) {
    detailError.value = e instanceof ApiRequestError ? e.message : 'Gagal memuat detail.'
  }
}
function onChanged(order: PanelOrderDetailDto) {
  selected.value = order
  void load()
  void counts.run()
}
function onStale() {
  void open(selectedCode.value)
  void load()
  void counts.run()
}
const method = (o: PanelOrderDto) =>
  o.fulfillment === 'SHIPPING' ? `Dikirim${o.courier ? `, ${o.courier}` : ''}` : 'Ambil di toko'
</script>

<template>
  <header class="flex flex-wrap items-center justify-between gap-3">
    <h1 class="text-[28px] font-extrabold tracking-tight">Kelola pesanan</h1>
    <label
      class="focus-within:outline-3 focus-within:outline-offset-2 focus-within:outline-brand-600/45 flex h-11 w-[320px] max-w-full items-center gap-2 rounded-control border border-gray-200 bg-white px-3 text-gray-600 focus-within:border-brand-600"
    >
      <MagnifyingGlassIcon class="size-5" aria-hidden="true" />
      <span class="sr-only">Cari pesanan</span>
      <input
        v-model="search"
        type="search"
        placeholder="Kode pesanan atau nama customer"
        class="min-w-0 flex-1 bg-transparent text-sm text-gray-900 outline-none"
      />
    </label>
  </header>

  <div role="tablist" aria-label="Filter status" class="flex flex-wrap gap-1.5">
    <button
      v-for="t in TABS"
      :key="t.value"
      type="button"
      role="tab"
      :aria-selected="tab === t.value"
      class="h-[38px] rounded-full border px-3.5 text-[13px] font-bold"
      :class="
        tab === t.value
          ? 'border-brand-600 bg-brand-600 text-white'
          : 'border-gray-200 bg-white text-gray-900 hover:border-gray-300'
      "
      @click="tab = t.value"
    >
      {{ t.label }} {{ counts.data.value?.[t.value] ?? '' }}
    </button>
  </div>

  <AppDataTable
    v-model:page="page"
    :rows="rows"
    :total="total"
    :limit="LIMIT"
    :loading="loading"
    :error="error"
    data-key="code"
    noun="pesanan"
    empty-title="Belum ada pesanan di sini"
    :empty-text="query ? 'Coba kata kunci lain.' : undefined"
    @retry="load"
  >
    <Column header="Pesanan" :pt="{ headerCell: { class: 'pl-5' }, bodyCell: { class: 'pl-5' } }">
      <template #body="{ data }: { data: PanelOrderDto }">
        <button
          type="button"
          class="flex flex-col gap-0.5 text-left"
          :aria-label="`Buka pesanan ${data.code}`"
          @click="open(data.code)"
        >
          <span class="font-extrabold text-gray-900 tabular-nums hover:text-brand-700">{{
            data.code
          }}</span>
          <span class="text-xs text-gray-600">{{ data.recipient.name }}</span>
        </button>
      </template>
    </Column>
    <Column header="Sepatu">
      <template #body="{ data }: { data: PanelOrderDto }"
        ><span class="line-clamp-2 text-[13px]">{{ data.itemNames.join(', ') }}</span></template
      >
    </Column>
    <Column header="Metode">
      <template #body="{ data }: { data: PanelOrderDto }"
        ><span class="text-[13px]">{{ method(data) }}</span></template
      >
    </Column>
    <Column header="Total">
      <template #body="{ data }: { data: PanelOrderDto }"
        ><span class="font-bold tabular-nums">{{ formatRupiah(data.total) }}</span></template
      >
    </Column>
    <Column header="Status" :pt="{ headerCell: { class: 'pr-5' }, bodyCell: { class: 'pr-5' } }">
      <template #body="{ data }: { data: PanelOrderDto }"
        ><StatusBadge type="order" :status="data.status"
      /></template>
    </Column>
  </AppDataTable>

  <Drawer
    v-model:visible="drawerOpen"
    position="right"
    :header="selectedCode"
    class="w-full! sm:w-[420px]!"
    @hide="selectedCode = ''"
  >
    <div v-if="detailError" role="alert" class="flex flex-col items-start gap-2 text-sm">
      <p class="text-danger-fg">{{ detailError }}</p>
      <button type="button" class="font-bold text-brand-700 underline" @click="open(selectedCode)">
        Coba lagi
      </button>
    </div>
    <div v-else-if="!selected" class="flex flex-col gap-3" aria-busy="true">
      <Skeleton height="28px" width="60%" />
      <Skeleton height="160px" />
      <Skeleton height="48px" />
    </div>
    <OrderDrawer v-else :order="selected" @changed="onChanged" @stale="onStale" />
  </Drawer>
</template>
