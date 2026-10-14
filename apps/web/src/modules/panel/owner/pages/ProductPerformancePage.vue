<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { PhotoIcon } from '@heroicons/vue/24/outline'
import type { PerformancePeriod } from '@ssb/shared'
import { useRequest } from '@/shared/composables'
import { formatDate, formatNumber, formatRupiah } from '@/shared/lib'
import { AppButton, ChartCard } from '@/shared/ui'
import { reportsApi } from '../api/reports.api'

// Layar O-Performa: lama terjual, per merek/kategori/ukuran, sepatu belum laku > 30 hari.
const BRAND = '#3B5D50'
const BRAND_LIGHT = '#B0CBBE'
const CATEGORY_COLORS = ['#2F4B41', '#4F7A69', '#B0CBBE', '#F9BF29', '#D7E5DE', '#92400E']
const PERIODS: { value: PerformancePeriod; label: string }[] = [
  { value: '3m', label: '3 bulan terakhir' },
  { value: '6m', label: '6 bulan' },
  { value: 'ytd', label: 'Tahun ini' },
]

const period = ref<PerformancePeriod>('3m')
const perf = useRequest(() => reportsApi.performance(period.value))
watch(period, () => void perf.run())
const p = computed(() => perf.data.value)

const days = (n: number) => `${formatNumber(n)} hari`
const maxBrand = computed(() => Math.max(1, ...(p.value?.byBrand.map((b) => b.sold) ?? [])))
const categoryTotal = computed(() => p.value?.byCategory.reduce((s, c) => s + c.sold, 0) ?? 0)
const topSize = computed(() => Math.max(0, ...(p.value?.bySize.map((s) => s.sold) ?? [])))
const sizeData = computed(() => ({
  labels: p.value?.bySize.map((s) => formatNumber(s.sizeEu)) ?? [],
  datasets: [
    {
      data: p.value?.bySize.map((s) => s.sold) ?? [],
      backgroundColor: p.value?.bySize.map((s) => (s.sold === topSize.value ? BRAND : BRAND_LIGHT)),
      borderRadius: 4,
    },
  ],
}))
const sizeOptions = {
  responsive: true,
  maintainAspectRatio: false,
  plugins: { legend: { display: false } },
  scales: {
    x: { grid: { display: false }, ticks: { color: '#4B5563' } },
    y: { display: false, beginAtZero: true },
  },
}
</script>

<template>
  <header class="flex flex-wrap items-center justify-between gap-3">
    <div>
      <h1 class="text-[28px] font-extrabold tracking-tight">Performa produk</h1>
      <p class="mt-1 text-sm text-gray-600">
        {{
          p
            ? `${formatDate(p.period.from)} sampai ${formatDate(p.period.to)}, ${formatNumber(p.sold)} sepatu terjual`
            : 'Memuat...'
        }}
      </p>
    </div>
    <label class="flex items-center gap-2 text-[13px] font-semibold"
      >Periode
      <Select
        v-model="period"
        :options="PERIODS"
        option-label="label"
        option-value="value"
        class="w-48"
        aria-label="Periode"
    /></label>
  </header>

  <div
    v-if="perf.error.value && !p"
    role="alert"
    class="flex flex-col items-center gap-3 rounded-card border border-gray-200 bg-white px-6 py-14 text-center"
  >
    <p class="text-lg font-extrabold">Data performa gagal dimuat</p>
    <p class="text-sm text-gray-600">{{ perf.error.value }}</p>
    <AppButton variant="secondary" label="Coba lagi" @click="perf.run()" />
  </div>

  <template v-else-if="!p">
    <div class="grid gap-4 md:grid-cols-3" aria-busy="true">
      <Skeleton v-for="n in 3" :key="n" height="112px" border-radius="16px" />
    </div>
    <Skeleton height="280px" border-radius="16px" />
  </template>

  <template v-else>
    <section
      aria-label="Ringkasan"
      class="grid gap-4 md:grid-cols-3"
      :class="perf.loading.value && 'opacity-60'"
    >
      <div class="flex flex-col gap-1.5 rounded-card border border-gray-200 bg-white p-4.5">
        <span class="text-[13px] font-semibold text-gray-600">Rata-rata lama terjual</span>
        <span class="text-[28px] font-extrabold">{{
          p.averageDaysToSell === null ? '-' : days(p.averageDaysToSell)
        }}</span>
        <span class="text-xs text-gray-600">dari masuk katalog sampai terjual</span>
      </div>
      <div class="flex flex-col gap-1.5 rounded-card border border-gray-200 bg-white p-4.5">
        <span class="text-[13px] font-semibold text-gray-600">Paling cepat laku</span>
        <span class="text-[28px] font-extrabold">{{ p.fastestCategory?.name ?? '-' }}</span>
        <span v-if="p.fastestCategory" class="text-xs text-gray-600"
          >rata-rata {{ days(p.fastestCategory.averageDays) }}</span
        >
      </div>
      <div
        class="flex flex-col gap-1.5 rounded-card border border-warning-line bg-warning-bg p-4.5 text-[#78350F]"
      >
        <span class="text-[13px] font-bold">Belum laku lebih dari 30 hari</span>
        <span class="text-[28px] font-extrabold">{{ p.slowMoving.total }} sepatu</span>
        <a v-if="p.slowMoving.total" href="#lambat" class="text-xs font-extrabold underline"
          >Lihat daftarnya</a
        >
      </div>
    </section>

    <section
      aria-labelledby="mk-h"
      class="overflow-hidden rounded-card border border-gray-200 bg-white"
    >
      <div class="border-b border-gray-100 px-5 py-3.5">
        <h2 id="mk-h" class="text-[17px] font-extrabold">Per merek</h2>
      </div>
      <p v-if="!p.byBrand.length" class="px-5 py-8 text-center text-sm text-gray-600">
        Belum ada sepatu terjual di periode ini.
      </p>
      <div
        v-else
        tabindex="0"
        role="region"
        aria-label="Tabel performa per merek"
        class="overflow-x-auto"
      >
        <table class="w-full min-w-[720px] border-collapse text-sm">
          <thead>
            <tr class="bg-gray-50 text-left text-xs text-gray-600">
              <th class="px-5 py-3 font-bold">Merek</th>
              <th class="w-2/5 px-3 py-3 font-bold">Terjual</th>
              <th class="px-3 py-3 font-bold">Harga rata-rata</th>
              <th class="px-5 py-3 font-bold">Lama terjual</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="(b, i) in p.byBrand" :key="b.name" class="border-t border-gray-100">
              <td class="px-5 py-3 font-bold">{{ b.name }}</td>
              <td class="px-3 py-3">
                <span class="flex items-center gap-2.5">
                  <span
                    class="h-3 rounded"
                    :class="i === 0 ? 'bg-brand-600' : 'bg-brand-200'"
                    :style="{ width: `${(b.sold / maxBrand) * 85}%` }"
                  ></span>
                  <strong class="tabular-nums">{{ b.sold }}</strong>
                </span>
              </td>
              <td class="px-3 py-3 tabular-nums">{{ formatRupiah(b.averagePrice) }}</td>
              <td class="px-5 py-3 tabular-nums">{{ days(b.averageDays) }}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </section>

    <div class="grid gap-5 lg:grid-cols-2">
      <ChartCard title="Per kategori" heading-id="kt-h">
        <p v-if="!categoryTotal" class="text-sm text-gray-600">Belum ada data.</p>
        <template v-else>
          <div
            role="img"
            :aria-label="`Porsi penjualan per kategori: ${p.byCategory.map((c) => `${c.name} ${c.sold}`).join(', ')}`"
            class="flex h-7 gap-0.5 overflow-hidden rounded-lg"
          >
            <span
              v-for="(c, i) in p.byCategory"
              :key="c.name"
              :style="{
                width: `${(c.sold / categoryTotal) * 100}%`,
                background: CATEGORY_COLORS[i % CATEGORY_COLORS.length],
              }"
            ></span>
          </div>
          <ul class="grid grid-cols-2 gap-2.5 text-[13px]">
            <li v-for="(c, i) in p.byCategory" :key="c.name" class="flex items-center gap-2">
              <span
                class="size-3 flex-none rounded-[3px]"
                :style="{ background: CATEGORY_COLORS[i % CATEGORY_COLORS.length] }"
              ></span
              >{{ c.name }} <strong class="ml-auto tabular-nums">{{ c.sold }}</strong>
            </li>
          </ul>
        </template>
      </ChartCard>

      <ChartCard title="Per ukuran" heading-id="uk-h">
        <p v-if="!p.bySize.length" class="text-sm text-gray-600">Belum ada data.</p>
        <Chart
          v-else
          type="bar"
          :data="sizeData"
          :options="sizeOptions"
          class="h-[140px]"
          :pt="{ canvas: { role: 'img', 'aria-label': 'Penjualan per ukuran EU' } }"
        />
      </ChartCard>
    </div>

    <section
      id="lambat"
      aria-labelledby="sl-h"
      class="flex flex-col gap-3 rounded-card border border-gray-200 bg-white p-5"
    >
      <h2 id="sl-h" class="text-[17px] font-extrabold">Belum laku lebih dari 30 hari</h2>
      <p v-if="!p.slowMoving.items.length" class="text-sm text-gray-600">
        Tidak ada. Semua sepatu tersedia masuk kurang dari 30 hari lalu.
      </p>
      <div v-else class="grid gap-2.5 sm:grid-cols-[repeat(auto-fit,minmax(260px,1fr))]">
        <div
          v-for="s in p.slowMoving.items"
          :key="s.id"
          class="flex items-center gap-3 rounded-control border border-gray-200 p-3"
        >
          <img
            v-if="s.photoUrl"
            :src="s.photoUrl"
            :alt="s.name"
            class="size-13 flex-none rounded-[10px] object-cover"
          />
          <span
            v-else
            role="img"
            :aria-label="`Foto ${s.name} belum ada`"
            class="flex size-13 flex-none items-center justify-center rounded-[10px] bg-photo text-gray-500"
            ><PhotoIcon class="size-5" aria-hidden="true"
          /></span>
          <span class="flex min-w-0 flex-1 flex-col gap-0.5">
            <strong class="truncate text-sm">{{ s.name }}</strong>
            <span class="text-xs text-gray-600"
              >EU {{ formatNumber(s.sizeEu) }}, {{ s.days }} hari, {{ formatRupiah(s.price) }}</span
            >
          </span>
          <RouterLink
            :to="`/panel/produk/${s.id}/edit`"
            class="inline-flex h-9 items-center rounded-control border border-gray-300 px-3 text-xs font-bold whitespace-nowrap text-gray-900 hover:bg-gray-50"
            >Ubah harga</RouterLink
          >
        </div>
      </div>
      <p v-if="p.slowMoving.total > p.slowMoving.items.length" class="text-xs text-gray-600">
        Menampilkan {{ p.slowMoving.items.length }} terlama dari {{ p.slowMoving.total }} sepatu.
      </p>
    </section>
  </template>
</template>
