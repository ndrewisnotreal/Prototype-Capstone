<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { DocumentChartBarIcon } from '@heroicons/vue/24/outline'
import type { OwnerDashboardDto, ReportGranularity } from '@ssb/shared'
import { useRequest } from '@/shared/composables'
import { formatDate, formatNumber, formatRupiah, formatTimeAgo } from '@/shared/lib'
import { AppButton, ChartCard, KpiCard } from '@/shared/ui'
import { describeActivity } from '../activity'
import { ownerDashboardApi } from '../api/dashboard.api'
import { buildKpis } from '../dashboard'

// Layar O-Dashboard: KPI bulan berjalan vs bulan lalu, grafik penjualan, status, merek, ukuran, aktivitas.
const BRAND = '#3B5D50'
const BRAND_LIGHT = '#B0CBBE'
const PERIODS: { value: ReportGranularity; label: string }[] = [
  { value: 'day', label: 'Harian' },
  { value: 'week', label: 'Mingguan' },
  { value: 'month', label: 'Bulanan' },
]
const STATUS_GROUPS: {
  key: keyof OwnerDashboardDto['statusCounts']
  label: string
  color: string
}[] = [
  { key: 'unpaid', label: 'Belum lunas', color: '#F9BF29' },
  { key: 'processing', label: 'Diproses', color: '#4F7A69' },
  { key: 'delivering', label: 'Siap atau dikirim', color: BRAND_LIGHT },
  { key: 'completed', label: 'Selesai', color: '#2F4B41' },
  { key: 'cancelled', label: 'Dibatalkan', color: '#DC2626' },
]

const granularity = ref<ReportGranularity>('month')
const dashboard = useRequest(() => ownerDashboardApi.get(granularity.value))
watch(granularity, () => void dashboard.run())
const d = computed(() => dashboard.data.value)

const kpis = computed(() => (d.value ? buildKpis(d.value.kpis) : []))
const periodText = computed(() =>
  d.value
    ? `${formatDate(d.value.period.from)} sampai ${formatDate(d.value.period.to)}, dibanding periode yang sama bulan lalu`
    : '',
)
const chartNote = computed(() => {
  const points = d.value?.chart.points ?? []
  if (d.value?.chart.granularity === 'day') return '14 hari terakhir, juta rupiah'
  if (d.value?.chart.granularity === 'week') return '8 minggu terakhir, juta rupiah'
  return points.length ? `${points[0]!.label} sampai ${points.at(-1)!.label}, juta rupiah` : ''
})

/** batang terakhir (periode berjalan) lebih gelap, seperti desain */
const highlightLast = (n: number) =>
  Array.from({ length: n }, (_, i) => (i === n - 1 ? BRAND : BRAND_LIGHT))
const axis = { grid: { display: false }, ticks: { color: '#4B5563', font: { size: 11 } } }

const salesData = computed(() => {
  const points = d.value?.chart.points ?? []
  return {
    labels: points.map((p) => p.label),
    datasets: [
      {
        data: points.map((p) => p.revenue),
        backgroundColor: highlightLast(points.length),
        borderRadius: 6,
        maxBarThickness: 44,
      },
    ],
  }
})
const salesOptions = {
  responsive: true,
  maintainAspectRatio: false,
  plugins: {
    legend: { display: false },
    tooltip: { callbacks: { label: (c: { parsed: { y: number } }) => formatRupiah(c.parsed.y) } },
  },
  scales: {
    x: axis,
    y: {
      ...axis,
      grid: { color: '#F3F4F6' },
      ticks: {
        ...axis.ticks,
        callback: (v: number | string) => formatNumber(Number(v) / 1_000_000),
      },
    },
  },
}

const statusTotal = computed(() =>
  d.value ? STATUS_GROUPS.reduce((sum, g) => sum + d.value!.statusCounts[g.key], 0) : 0,
)
const statusData = computed(() => ({
  labels: STATUS_GROUPS.map((g) => g.label),
  datasets: [
    {
      data: STATUS_GROUPS.map((g) => d.value?.statusCounts[g.key] ?? 0),
      backgroundColor: STATUS_GROUPS.map((g) => g.color),
      borderWidth: 2,
    },
  ],
}))
const statusOptions = { cutout: '68%', plugins: { legend: { display: false } } }

const topSize = computed(() => Math.max(0, ...(d.value?.sizes.map((s) => s.sold) ?? [])))
const sizeData = computed(() => ({
  labels: d.value?.sizes.map((s) => formatNumber(s.sizeEu)) ?? [],
  datasets: [
    {
      data: d.value?.sizes.map((s) => s.sold) ?? [],
      backgroundColor: d.value?.sizes.map((s) => (s.sold === topSize.value ? BRAND : BRAND_LIGHT)),
      borderRadius: 4,
    },
  ],
}))
const sizeOptions = {
  responsive: true,
  maintainAspectRatio: false,
  plugins: { legend: { display: false } },
  scales: { x: axis, y: { display: false, beginAtZero: true } },
}
const topSizeLabel = computed(() => d.value?.sizes.find((s) => s.sold === topSize.value)?.sizeEu)
const maxBrand = computed(() => Math.max(1, ...(d.value?.topBrands.map((b) => b.sold) ?? [])))

const initials = (name: string | null) =>
  (name ?? 'Sistem')
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase())
    .join('')
</script>

<template>
  <header class="flex flex-wrap items-center justify-between gap-3">
    <div>
      <h1 class="text-[28px] font-extrabold tracking-tight">Dashboard bisnis</h1>
      <p class="mt-1 text-sm text-gray-600">{{ periodText || 'Memuat...' }}</p>
    </div>
    <RouterLink
      to="/panel/owner/laporan"
      class="inline-flex h-11 items-center gap-2 rounded-control border border-gray-300 bg-white px-4 text-sm font-bold text-gray-900 hover:bg-gray-50"
    >
      <DocumentChartBarIcon class="size-5" aria-hidden="true" />Laporan lengkap
    </RouterLink>
  </header>

  <!-- Gagal -->
  <div
    v-if="dashboard.error.value && !d"
    role="alert"
    class="flex flex-col items-center gap-3 rounded-card border border-gray-200 bg-white px-6 py-14 text-center"
  >
    <p class="text-lg font-extrabold">Dashboard gagal dimuat</p>
    <p class="text-sm text-gray-600">{{ dashboard.error.value }}</p>
    <AppButton variant="secondary" label="Coba lagi" @click="dashboard.run()" />
  </div>

  <!-- Memuat -->
  <template v-else-if="!d">
    <div class="grid grid-cols-2 gap-4 xl:grid-cols-4" aria-busy="true">
      <Skeleton v-for="n in 4" :key="n" height="116px" border-radius="16px" />
    </div>
    <Skeleton height="320px" border-radius="16px" />
  </template>

  <template v-else>
    <section aria-label="Ringkasan" class="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">
      <KpiCard v-for="k in kpis" :key="k.label" v-bind="k" />
    </section>

    <ChartCard title="Penjualan" :subtitle="chartNote" heading-id="sales-h">
      <template #actions>
        <div
          role="tablist"
          aria-label="Periode grafik"
          class="flex rounded-control bg-gray-100 p-1"
        >
          <button
            v-for="p in PERIODS"
            :key="p.value"
            type="button"
            role="tab"
            :aria-selected="granularity === p.value"
            class="h-9 rounded-[10px] px-3.5 text-[13px] text-gray-900"
            :class="
              granularity === p.value
                ? 'bg-white font-extrabold shadow-[0_1px_3px_rgb(17_24_39/0.12)]'
                : 'font-semibold'
            "
            @click="granularity = p.value"
          >
            {{ p.label }}
          </button>
        </div>
      </template>
      <Chart
        type="bar"
        :data="salesData"
        :options="salesOptions"
        class="h-60"
        :class="dashboard.loading.value && 'opacity-60'"
        :pt="{ canvas: { role: 'img', 'aria-label': `Grafik batang penjualan, ${chartNote}` } }"
      />
    </ChartCard>

    <div class="grid gap-5 lg:grid-cols-3">
      <ChartCard title="Pesanan per status" heading-id="st-h">
        <div class="flex flex-wrap items-center gap-4.5">
          <div class="relative size-[150px]">
            <Chart
              type="doughnut"
              :data="statusData"
              :options="statusOptions"
              class="size-full"
              :pt="{
                canvas: {
                  role: 'img',
                  'aria-label': `Donut pesanan per status, total ${statusTotal}`,
                },
              }"
            />
            <span
              class="pointer-events-none absolute inset-0 flex flex-col items-center justify-center"
              aria-hidden="true"
            >
              <span class="text-[26px] font-extrabold tabular-nums">{{ statusTotal }}</span>
              <span class="text-[11px] text-gray-600">pesanan</span>
            </span>
          </div>
          <ul class="flex min-w-[120px] flex-1 flex-col gap-2 text-[13px]">
            <li v-for="g in STATUS_GROUPS" :key="g.key" class="flex items-center gap-2">
              <span class="size-3 flex-none rounded-[3px]" :style="{ background: g.color }"></span>
              <span class="flex-1">{{ g.label }}</span>
              <strong class="tabular-nums">{{ d.statusCounts[g.key] }}</strong>
            </li>
          </ul>
        </div>
      </ChartCard>

      <ChartCard title="Top 5 merek terjual" heading-id="br-h">
        <p v-if="!d.topBrands.length" class="text-sm text-gray-600">
          Belum ada penjualan bulan ini.
        </p>
        <ul v-else class="flex flex-col gap-3">
          <li
            v-for="(b, i) in d.topBrands"
            :key="b.name"
            class="grid grid-cols-[96px_1fr_32px] items-center gap-2.5 text-[13px]"
          >
            <span class="truncate font-bold">{{ b.name }}</span>
            <span
              class="h-3.5 rounded"
              :class="i === 0 ? 'bg-brand-600' : 'bg-brand-200'"
              :style="{ width: `${(b.sold / maxBrand) * 100}%` }"
            ></span>
            <strong class="text-right tabular-nums">{{ b.sold }}</strong>
          </li>
        </ul>
      </ChartCard>

      <ChartCard title="Ukuran terlaris" heading-id="sz-h">
        <p v-if="!d.sizes.length" class="text-sm text-gray-600">Belum ada penjualan bulan ini.</p>
        <Chart
          v-else
          type="bar"
          :data="sizeData"
          :options="sizeOptions"
          class="h-[150px]"
          :pt="{
            canvas: {
              role: 'img',
              'aria-label': `Distribusi ukuran terjual, terbanyak EU ${topSizeLabel}`,
            },
          }"
        />
      </ChartCard>
    </div>

    <section
      aria-labelledby="ac-h"
      class="flex flex-col gap-3 rounded-card border border-gray-200 bg-white p-5"
    >
      <div class="flex items-center justify-between">
        <h2 id="ac-h" class="text-[17px] font-extrabold">Aktivitas terbaru</h2>
        <RouterLink to="/panel/owner/log" class="text-[13px] font-bold text-brand-700"
          >Log lengkap</RouterLink
        >
      </div>
      <p v-if="!d.recentActivity.length" class="text-sm text-gray-600">Belum ada aktivitas.</p>
      <ul v-else class="grid gap-2.5 md:grid-cols-[repeat(auto-fit,minmax(300px,1fr))]">
        <li
          v-for="a in d.recentActivity"
          :key="a.id"
          class="flex gap-2.5 rounded-control bg-gray-50 p-3 text-[13px]/normal"
        >
          <span
            aria-hidden="true"
            class="flex size-8 flex-none items-center justify-center rounded-full bg-brand-100 text-[11px] font-extrabold text-brand-700"
            >{{ initials(a.actorName) }}</span
          >
          <span
            ><strong>{{ a.actorName ?? 'Sistem' }}</strong> {{ describeActivity(a) }}<br /><span
              class="text-gray-600"
              >{{ formatTimeAgo(a.createdAt) }}</span
            ></span
          >
        </li>
      </ul>
    </section>
  </template>
</template>
