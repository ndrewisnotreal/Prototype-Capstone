<script setup lang="ts">
import { computed, onBeforeUnmount, ref, type Component } from 'vue'
import { useRouter } from 'vue-router'
import {
  BanknotesIcon,
  ClipboardDocumentListIcon,
  ClockIcon,
  PlusIcon,
  TruckIcon,
} from '@heroicons/vue/24/outline'
import { useAuthStore } from '@/modules/auth'
import { useRequest } from '@/shared/composables'
import { formatLongDate } from '@/shared/lib'
import { AppButton, CountdownTimer, SearchBar, StatusBadge } from '@/shared/ui'
import { dashboardApi } from '../api/dashboard.api'
import { greeting, nextAction } from '../dashboard'

// Layar P-Dashboard: jumlah tugas, tabel "Perlu tindakan", reservasi hampir habis. Tanpa angka Rp ([KONFIRMASI] no. 6).
const auth = useAuthStore()
const router = useRouter()
const dashboard = useRequest(() => dashboardApi.get())
const data = computed(() => dashboard.data.value)

// Muat ulang tiap menit supaya angka tugas dan antrean ikut berubah tanpa refresh
const timer = setInterval(() => void dashboard.run(), 60_000)
onBeforeUnmount(() => clearInterval(timer))

const firstName = computed(() => auth.user?.name.split(/\s+/)[0] ?? '')
const search = ref('')
const goSearch = () =>
  search.value.trim() && router.push({ path: '/panel/pesanan', query: { q: search.value.trim() } })

const cards = computed<
  { label: string; value: number; to: string; icon: Component; urgent?: boolean }[]
>(() => {
  const c = data.value?.counts
  if (!c) return []
  return [
    {
      label: 'Pembayaran menunggu verifikasi',
      value: c.awaitingVerification,
      to: '/panel/verifikasi',
      icon: BanknotesIcon,
    },
    {
      label: 'Pesanan perlu diproses',
      value: c.toProcess,
      to: '/panel/pesanan?tab=processing',
      icon: ClipboardDocumentListIcon,
    },
    {
      label: 'Siap diambil atau dikirim',
      value: c.readyOrShipped,
      to: '/panel/pesanan?tab=delivering',
      icon: TruckIcon,
    },
    {
      label: 'Reservasi habis dalam 2 jam',
      value: c.expiringSoon,
      to: '/panel/pesanan?tab=unpaid',
      icon: ClockIcon,
      urgent: true,
    },
  ]
})
const itemsLabel = (names: string[]) =>
  names.length > 1 ? `${names.length} sepatu` : (names[0] ?? '')
</script>

<template>
  <header class="flex flex-wrap items-center justify-between gap-4">
    <div>
      <h1 class="text-[28px] font-extrabold tracking-tight">{{ greeting() }}, {{ firstName }}</h1>
      <p class="mt-1 text-sm text-gray-600">
        {{ formatLongDate(new Date()) }}. Ini yang perlu dikerjakan hari ini.
      </p>
    </div>
    <div class="flex w-full flex-wrap items-center gap-2.5 sm:w-auto">
      <form
        class="min-w-0 flex-1 sm:w-[320px] sm:flex-none"
        role="search"
        @submit.prevent="goSearch"
      >
        <SearchBar
          v-model="search"
          label="Cari pesanan"
          placeholder="Kode pesanan atau nama customer"
          class="[&_input]:h-11! [&_input]:bg-white! [&_input]:text-sm!"
        />
      </form>
      <RouterLink
        to="/panel/produk/baru"
        class="inline-flex h-11 items-center gap-2 rounded-control bg-brand-600 px-4 text-sm font-bold whitespace-nowrap text-white hover:bg-brand-700"
      >
        <PlusIcon class="size-5" aria-hidden="true" />Tambah sepatu
      </RouterLink>
    </div>
  </header>

  <!-- Gagal -->
  <div
    v-if="dashboard.error.value && !data"
    role="alert"
    class="flex flex-col items-center gap-3 rounded-card border border-gray-200 bg-white px-6 py-14 text-center"
  >
    <p class="text-lg font-extrabold">Dashboard gagal dimuat</p>
    <p class="text-sm text-gray-600">{{ dashboard.error.value }}</p>
    <AppButton variant="secondary" label="Coba lagi" @click="dashboard.run()" />
  </div>

  <template v-else>
    <section aria-label="Tugas hari ini" class="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">
      <template v-if="!data">
        <Skeleton v-for="n in 4" :key="n" height="134px" border-radius="16px" />
      </template>
      <RouterLink
        v-for="c in cards"
        v-else
        :key="c.label"
        :to="c.to"
        class="flex flex-col gap-2.5 rounded-card border p-4.5 transition-shadow hover:shadow-card"
        :class="
          c.urgent && c.value > 0
            ? 'border-danger-line bg-danger-bg text-[#7F1D1D]'
            : 'border-gray-200 bg-white text-gray-900'
        "
      >
        <span
          class="flex size-10 items-center justify-center rounded-control"
          :class="
            c.urgent && c.value > 0
              ? 'bg-white text-danger-fg'
              : c.icon === BanknotesIcon
                ? 'bg-warning-bg text-warning-fg'
                : 'bg-brand-50 text-brand-700'
          "
        >
          <component :is="c.icon" class="size-5.5" aria-hidden="true" />
        </span>
        <span class="text-[34px] font-extrabold tabular-nums">{{ c.value }}</span>
        <span class="text-sm" :class="c.urgent ? 'font-bold' : 'font-semibold text-gray-700'">{{
          c.label
        }}</span>
      </RouterLink>
    </section>

    <div class="flex flex-wrap items-start gap-5">
      <section
        aria-labelledby="act-h"
        class="min-w-0 flex-[999_1_560px] overflow-hidden rounded-card border border-gray-200 bg-white"
      >
        <div class="flex items-center justify-between border-b border-gray-100 px-5 py-4">
          <h2 id="act-h" class="text-[17px] font-extrabold">Perlu tindakan</h2>
          <RouterLink to="/panel/pesanan" class="text-[13px] font-bold text-brand-700"
            >Semua pesanan</RouterLink
          >
        </div>
        <div v-if="!data" class="flex flex-col gap-2 p-5">
          <Skeleton v-for="n in 4" :key="n" height="44px" />
        </div>
        <p
          v-else-if="data.actions.length === 0"
          class="px-5 py-10 text-center text-sm text-gray-600"
        >
          Tidak ada pesanan yang menunggu. Semua beres.
        </p>
        <div v-else class="overflow-x-auto">
          <table class="w-full min-w-[620px] border-collapse text-sm">
            <thead>
              <tr class="bg-gray-50 text-left text-xs text-gray-600">
                <th class="px-5 py-2.5 font-bold">Pesanan</th>
                <th class="px-3 py-2.5 font-bold">Customer</th>
                <th class="px-3 py-2.5 font-bold">Status</th>
                <th class="px-5 py-2.5 text-right font-bold">Aksi</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="r in data.actions" :key="r.code" class="border-t border-gray-100">
                <td class="px-5 py-3">
                  <div class="font-bold tabular-nums">{{ r.code }}</div>
                  <div class="text-xs text-gray-600">{{ itemsLabel(r.itemNames) }}</div>
                </td>
                <td class="px-3 py-3">{{ r.customerName }}</td>
                <td class="px-3 py-3"><StatusBadge type="order" :status="r.status" /></td>
                <td class="px-5 py-2 text-right">
                  <RouterLink
                    :to="nextAction(r).to"
                    class="inline-flex h-9 items-center rounded-control border border-gray-300 px-3 text-[13px] font-bold whitespace-nowrap text-gray-900 hover:bg-gray-50"
                    >{{ nextAction(r).label }}</RouterLink
                  >
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>

      <section
        aria-labelledby="res-h"
        class="flex min-w-0 flex-[1_1_300px] flex-col gap-3 rounded-card border border-gray-200 bg-white px-5 py-4.5"
      >
        <h2 id="res-h" class="text-[17px] font-extrabold">Reservasi hampir habis</h2>
        <p class="text-[13px]/normal text-gray-600">
          Kalau waktu habis, pesanan batal otomatis dan sepatu kembali Tersedia.
        </p>
        <div v-if="!data" class="flex flex-col gap-2.5">
          <Skeleton v-for="n in 2" :key="n" height="58px" border-radius="12px" />
        </div>
        <p v-else-if="data.expiring.length === 0" class="text-sm text-gray-600">
          Tidak ada reservasi yang hampir habis.
        </p>
        <ul v-else class="flex flex-col gap-2.5">
          <li
            v-for="r in data.expiring"
            :key="r.code"
            class="flex items-center gap-3 rounded-control border border-[#FED7AA] bg-[#FFF7ED] p-3"
          >
            <span class="flex flex-1 flex-col gap-0.5">
              <span class="text-sm font-bold tabular-nums">{{ r.code }}</span>
              <span class="text-xs text-gray-600"
                >{{ r.customerName }},
                {{ r.paymentStatus === 'REJECTED' ? 'Bukti ditolak' : 'Belum dibayar' }}</span
              >
            </span>
            <CountdownTimer
              :expires-at="r.expiresAt"
              class="text-[15px] font-extrabold text-[#9A3412]"
            />
          </li>
        </ul>
        <span class="text-xs text-gray-600"
          >Hubungi customer lewat WhatsApp resmi toko bila perlu.</span
        >
      </section>
    </div>
  </template>
</template>
