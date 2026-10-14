<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { ArrowDownTrayIcon, DocumentTextIcon } from '@heroicons/vue/24/outline'
import {
  FULFILLMENT_LABELS,
  type Fulfillment,
  type SalesReportDto,
  type SalesReportRowDto,
} from '@ssb/shared'
import { ApiRequestError, formatDate, formatNumber, formatRupiah } from '@/shared/lib'
import { AppDataTable, FormField } from '@/shared/ui'
import { reportsApi } from '../api/reports.api'
import { exportUrl, quickRange, toDateParam, type QuickRange } from '../reports'

// Layar O-Laporan: filter tanggal + metode, ringkasan, transaksi (paginasi di browser), ekspor PDF/Excel.
const LIMIT = 10
const QUICK: { value: QuickRange; label: string }[] = [
  { value: '7d', label: '7 hari' },
  { value: 'thisMonth', label: 'Bulan ini' },
  { value: 'lastMonth', label: 'Bulan lalu' },
  { value: 'thisYear', label: 'Tahun ini' },
]
// 'ALL', bukan null: Select PrimeVue menganggap null sebagai belum memilih (label kosong)
const METHODS: { value: Fulfillment | 'ALL'; label: string }[] = [
  { value: 'ALL', label: 'Semua' },
  { value: 'PICKUP', label: FULFILLMENT_LABELS.PICKUP },
  { value: 'SHIPPING', label: FULFILLMENT_LABELS.SHIPPING },
]

const initial = quickRange('thisMonth')
const from = ref<Date>(initial.from)
const to = ref<Date>(initial.to)
const quick = ref<QuickRange | null>('thisMonth')
const fulfillment = ref<Fulfillment | 'ALL'>('ALL')
function pickQuick(value: QuickRange) {
  const r = quickRange(value)
  from.value = r.from
  to.value = r.to
  quick.value = value
}

const query = computed(() => ({
  from: toDateParam(from.value),
  to: toDateParam(to.value),
  fulfillment: fulfillment.value === 'ALL' ? undefined : fulfillment.value,
}))
const rangeError = computed(() =>
  from.value > to.value ? 'Tanggal "sampai" tidak boleh sebelum tanggal "dari".' : '',
)

const report = ref<SalesReportDto | null>(null)
const loading = ref(false)
const error = ref('')
const page = ref(1)
let requestId = 0
async function load() {
  if (rangeError.value) return
  const id = ++requestId
  loading.value = true
  error.value = ''
  try {
    const res = await reportsApi.sales(query.value)
    if (id !== requestId) return
    report.value = res
    page.value = 1
  } catch (e) {
    if (id === requestId)
      error.value = e instanceof ApiRequestError ? e.message : 'Gagal memuat laporan.'
  } finally {
    if (id === requestId) loading.value = false
  }
}
watch(query, load, { immediate: true })

const rows = computed(
  () => report.value?.rows.slice((page.value - 1) * LIMIT, page.value * LIMIT) ?? [],
)
const summary = computed(() => report.value?.summary)
const itemsLabel = (r: SalesReportRowDto) =>
  r.itemNames.length > 1 ? `${r.itemNames.length} sepatu` : (r.itemNames[0] ?? '')
const exportDisabled = computed(() => !!rangeError.value || !report.value?.rows.length)
</script>

<template>
  <header class="flex flex-wrap items-center justify-between gap-3">
    <h1 class="text-[28px] font-extrabold tracking-tight">Laporan penjualan</h1>
    <div class="flex gap-2">
      <a
        :href="exportDisabled ? undefined : exportUrl('pdf', query)"
        :aria-disabled="exportDisabled"
        class="inline-flex h-11 items-center gap-2 rounded-control border border-gray-300 bg-white px-4 text-sm font-bold text-gray-900 hover:bg-gray-50 aria-disabled:pointer-events-none aria-disabled:opacity-50"
        ><DocumentTextIcon class="size-5" aria-hidden="true" />Ekspor PDF</a
      >
      <a
        :href="exportDisabled ? undefined : exportUrl('xlsx', query)"
        :aria-disabled="exportDisabled"
        class="inline-flex h-11 items-center gap-2 rounded-control bg-brand-600 px-4 text-sm font-bold text-white hover:bg-brand-700 aria-disabled:pointer-events-none aria-disabled:opacity-50"
        ><ArrowDownTrayIcon class="size-5" aria-hidden="true" />Ekspor Excel</a
      >
    </div>
  </header>

  <form
    class="flex flex-wrap items-end gap-3.5 rounded-card border border-gray-200 bg-white px-5 py-4"
    @submit.prevent
  >
    <FormField v-slot="f" label="Dari tanggal" :error="rangeError">
      <DatePicker
        v-model="from"
        :input-id="f.id"
        :invalid="f.invalid"
        date-format="dd/mm/yy"
        :max-date="new Date()"
        show-icon
        icon-display="input"
        @update:model-value="quick = null"
      />
    </FormField>
    <FormField v-slot="f" label="Sampai tanggal">
      <DatePicker
        v-model="to"
        :input-id="f.id"
        date-format="dd/mm/yy"
        :max-date="new Date()"
        show-icon
        icon-display="input"
        @update:model-value="quick = null"
      />
    </FormField>
    <div class="flex flex-wrap gap-1.5 pb-0.5">
      <button
        v-for="q in QUICK"
        :key="q.value"
        type="button"
        :aria-pressed="quick === q.value"
        class="h-10 rounded-full border px-3 text-[13px]"
        :class="
          quick === q.value
            ? 'border-brand-600 bg-brand-50 font-extrabold text-brand-700'
            : 'border-gray-200 bg-white font-bold text-gray-900 hover:border-gray-300'
        "
        @click="pickQuick(q.value)"
      >
        {{ q.label }}
      </button>
    </div>
    <FormField v-slot="f" label="Metode" class="sm:ml-auto">
      <Select
        v-model="fulfillment"
        :label-id="f.id"
        :options="METHODS"
        option-label="label"
        option-value="value"
        class="w-48"
      />
    </FormField>
  </form>

  <!-- gagal sebelum ada data: pesan error cukup di tabel, ringkasan tidak dibiarkan skeleton -->
  <section
    v-if="summary || !error"
    aria-label="Ringkasan periode"
    class="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4"
  >
    <template v-if="!summary">
      <Skeleton v-for="n in 4" :key="n" height="96px" border-radius="16px" />
    </template>
    <template v-else>
      <div class="flex flex-col gap-1.5 rounded-card bg-brand-700 p-4.5 text-white">
        <span class="text-[13px] font-semibold text-brand-100">Total pendapatan</span>
        <span class="text-[28px] font-extrabold tabular-nums">{{
          formatRupiah(summary.revenue)
        }}</span>
      </div>
      <div
        v-for="s in [
          { label: 'Transaksi selesai', value: formatNumber(summary.transactions) },
          { label: 'Sepatu terjual', value: formatNumber(summary.itemsSold) },
          { label: 'Rata-rata per sepatu', value: formatRupiah(summary.averagePerItem) },
        ]"
        :key="s.label"
        class="flex flex-col gap-1.5 rounded-card border border-gray-200 bg-white p-4.5"
      >
        <span class="text-[13px] font-semibold text-gray-600">{{ s.label }}</span>
        <span class="text-[28px] font-extrabold tabular-nums">{{ s.value }}</span>
      </div>
    </template>
  </section>

  <div class="flex flex-col gap-0">
    <div
      class="flex flex-wrap items-center justify-between gap-2 rounded-t-card border border-b-0 border-gray-200 bg-white px-5 py-3.5"
    >
      <span class="font-extrabold">Transaksi selesai</span>
      <span v-if="summary" class="text-sm text-gray-600"
        >Total {{ summary.transactions }} transaksi,
        <strong class="text-gray-900 tabular-nums">{{
          formatRupiah(summary.revenue)
        }}</strong></span
      >
    </div>
    <AppDataTable
      v-model:page="page"
      class="rounded-t-none!"
      :rows="rows"
      :total="report?.rows.length ?? 0"
      :limit="LIMIT"
      :loading="loading"
      :error="error"
      data-key="code"
      noun="transaksi"
      empty-title="Belum ada transaksi di periode ini"
      empty-text="Coba rentang tanggal atau metode lain."
      @retry="load"
    >
      <Column header="Tanggal" :pt="{ headerCell: { class: 'pl-5' }, bodyCell: { class: 'pl-5' } }">
        <template #body="{ data }: { data: SalesReportRowDto }"
          ><span class="whitespace-nowrap text-gray-700">{{
            formatDate(data.verifiedAt)
          }}</span></template
        >
      </Column>
      <Column header="Kode pesanan">
        <template #body="{ data }: { data: SalesReportRowDto }"
          ><span class="font-bold tabular-nums">{{ data.code }}</span></template
        >
      </Column>
      <Column field="customerName" header="Customer" />
      <Column header="Sepatu">
        <template #body="{ data }: { data: SalesReportRowDto }">{{ itemsLabel(data) }}</template>
      </Column>
      <Column header="Metode">
        <template #body="{ data }: { data: SalesReportRowDto }"
          ><span class="text-gray-700">{{ FULFILLMENT_LABELS[data.fulfillment] }}</span></template
        >
      </Column>
      <Column header="Diverifikasi oleh">
        <template #body="{ data }: { data: SalesReportRowDto }"
          ><span class="text-gray-700">{{ data.verifiedBy ?? '-' }}</span></template
        >
      </Column>
      <Column
        header="Total"
        :pt="{ headerCell: { class: 'pr-5 text-right' }, bodyCell: { class: 'pr-5 text-right' } }"
      >
        <template #body="{ data }: { data: SalesReportRowDto }"
          ><span class="font-bold tabular-nums">{{ formatRupiah(data.total) }}</span></template
        >
      </Column>
    </AppDataTable>
  </div>
</template>
