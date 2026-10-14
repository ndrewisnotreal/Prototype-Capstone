<script setup lang="ts">
import { computed, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { PhotoIcon } from '@heroicons/vue/24/outline'
import { FULFILLMENT_LABELS, type OrderSummaryDto, type OrderTab } from '@ssb/shared'
import { useStoreInfo } from '@/modules/storefront'
import { useRequest } from '@/shared/composables'
import { formatDate, formatRupiah } from '@/shared/lib'
import { AppButton, CountdownTimer, OfflineState, StatusBadge } from '@/shared/ui'
import { ordersApi } from '../api/orders.api'
import AccountNav from '../components/AccountNav.vue'
import { formatShortTime } from '../order-timeline'

// Layar Pesanan: tab per status (jumlah dari /orders/counts), kartu pesanan dengan catatan dan aksi utama.
const LIMIT = 10
const TABS: { id: OrderTab; label: string }[] = [
  { id: 'all', label: 'Semua' },
  { id: 'unpaid', label: 'Belum Bayar' },
  { id: 'verifying', label: 'Diverifikasi' },
  { id: 'processing', label: 'Diproses' },
  { id: 'completed', label: 'Selesai' },
  { id: 'cancelled', label: 'Dibatalkan' },
]

const route = useRoute()
const router = useRouter()
const { info: store } = useStoreInfo()

const tab = computed<OrderTab>(() => {
  const q = String(route.query.tab ?? '')
  return TABS.some((t) => t.id === q) ? (q as OrderTab) : 'all'
})
const page = computed(() => Math.max(1, Number(route.query.page) || 1))
const setQuery = (q: { tab?: OrderTab; page?: number }) =>
  router.replace({
    query: {
      tab: (q.tab ?? tab.value) === 'all' ? undefined : (q.tab ?? tab.value),
      page: q.page && q.page > 1 ? q.page : undefined,
    },
  })

const list = useRequest(() => ordersApi.list(tab.value, page.value), { immediate: false })
const counts = useRequest(() => ordersApi.counts())
watch([tab, page], () => void list.run(), { immediate: true })

type Note = { tone: 'warning' | 'danger' | 'brand' | 'neutral'; text: string; countdown?: boolean }
function note(o: OrderSummaryDto): Note | null {
  if (o.status === 'AWAITING_PAYMENT' && o.paymentStatus === 'REJECTED')
    return {
      tone: 'danger',
      text: `Bukti ditolak${o.rejectReason ? `: ${o.rejectReason}` : ''}. Unggah ulang sebelum ${formatShortTime(o.expiresAt)}.`,
    }
  if (o.status === 'AWAITING_PAYMENT') return { tone: 'warning', text: '', countdown: true }
  if (o.status === 'READY_FOR_PICKUP')
    return {
      tone: 'brand',
      text: `Siap diambil${store.value?.address ? ` di ${store.value.address}` : ''}. Tunjukkan kode pesanan.`,
    }
  if (o.status === 'CANCELLED' && o.cancelReason)
    return { tone: 'neutral', text: `Dibatalkan: ${o.cancelReason}.` }
  return null
}
const NOTE_CLASS = {
  warning: 'bg-warning-bg text-warning-fg',
  danger: 'bg-danger-bg text-danger-fg',
  brand: 'bg-brand-50 text-brand-900',
  neutral: 'bg-gray-100 text-gray-700',
}
function cta(o: OrderSummaryDto) {
  if (o.status === 'AWAITING_PAYMENT')
    return {
      label: o.paymentStatus === 'REJECTED' ? 'Unggah Ulang' : 'Upload Bukti',
      to: `/pesanan/${o.code}/upload-bukti`,
    }
  if (o.paymentStatus === 'VERIFIED')
    return { label: 'Unduh Invoice', to: `/pesanan/${o.code}/invoice` }
  return null
}
const method = (o: OrderSummaryDto) =>
  o.trackingNumber
    ? `${o.courier ?? 'Ekspedisi'}, resi ${o.trackingNumber}`
    : FULFILLMENT_LABELS[o.fulfillment]
</script>

<template>
  <div
    class="mx-auto flex max-w-[1180px] flex-wrap items-start gap-7 px-4 pt-5 pb-10 sm:px-6 lg:pt-8 lg:pb-20"
  >
    <AccountNav class="hidden flex-[1_1_220px] lg:flex" />

    <div class="flex min-w-0 flex-[999_1_640px] flex-col gap-4.5">
      <h1 class="hidden text-[34px] font-extrabold tracking-tight lg:block">Pesanan saya</h1>

      <Tabs :value="tab" scrollable @update:value="(v) => setQuery({ tab: v as OrderTab })">
        <TabList
          :pt="{
            root: 'bg-transparent!',
            content: 'bg-transparent! border-0!',
            tabList: 'gap-1.5 border-0! bg-transparent! pb-1',
            activeBar: 'hidden!',
          }"
        >
          <Tab
            v-for="t in TABS"
            :key="t.id"
            :value="t.id"
            class="flex h-11 flex-none items-center gap-2 rounded-full! border! border-gray-200! bg-white! px-4! text-sm font-bold text-gray-900! data-[p-active=true]:border-brand-600! data-[p-active=true]:bg-brand-600! data-[p-active=true]:text-white!"
          >
            {{ t.label }}
            <span
              v-if="counts.data.value"
              class="inline-flex h-5.5 min-w-5.5 items-center justify-center rounded-full px-1.5 text-xs"
              :class="tab === t.id ? 'bg-white/20' : 'bg-gray-100'"
              >{{ counts.data.value[t.id] }}</span
            >
          </Tab>
        </TabList>
      </Tabs>

      <!-- Memuat -->
      <template v-if="list.loading.value && !list.data.value">
        <Skeleton v-for="n in 3" :key="n" height="190px" border-radius="16px" />
      </template>

      <!-- Gagal -->
      <OfflineState
        v-else-if="list.errorCode.value === 'NETWORK_ERROR'"
        title="Pesanan belum bisa dimuat"
        description="Cek sinyal atau Wi-Fi kamu. Pesananmu aman tersimpan, tidak ada yang hilang."
        contact
        @retry="list.run()"
      />
      <div
        v-else-if="list.error.value"
        role="alert"
        class="flex flex-col items-center gap-3 rounded-card border border-gray-200 bg-white px-6 py-14 text-center"
      >
        <p class="text-lg font-extrabold">Pesanan gagal dimuat</p>
        <p class="text-sm text-gray-600">{{ list.error.value }}</p>
        <AppButton variant="secondary" label="Coba lagi" @click="list.run()" />
      </div>

      <!-- Kosong -->
      <div
        v-else-if="list.data.value?.data.length === 0"
        class="flex flex-col items-center gap-2.5 rounded-card border border-gray-200 bg-white px-6 py-12 text-center"
      >
        <p class="text-lg font-extrabold">Belum ada pesanan di sini</p>
        <RouterLink
          to="/katalog"
          class="inline-flex h-11 items-center rounded-control bg-brand-600 px-4.5 text-sm font-bold text-white hover:bg-brand-700"
          >Lihat Katalog</RouterLink
        >
      </div>

      <template v-else-if="list.data.value">
        <article
          v-for="o in list.data.value.data"
          :key="o.code"
          class="flex flex-col gap-3.5 rounded-card border border-gray-200 bg-white px-4 py-4 sm:px-5 sm:py-4.5"
          :class="list.loading.value && 'opacity-60'"
        >
          <header class="flex flex-wrap items-center justify-between gap-2.5">
            <span class="flex flex-col gap-0.5">
              <span class="text-[15px] font-extrabold tabular-nums">{{ o.code }}</span>
              <span class="text-[13px] text-gray-600">{{ formatDate(o.createdAt) }}</span>
            </span>
            <span class="flex flex-wrap gap-1.5">
              <StatusBadge type="order" :status="o.status" />
              <StatusBadge type="payment" :status="o.paymentStatus" />
            </span>
          </header>

          <div class="flex flex-wrap items-center gap-3.5">
            <span class="flex gap-2">
              <template v-for="(url, i) in o.thumbnails.slice(0, 3)" :key="i">
                <img
                  :src="url"
                  :alt="o.itemNames[i] ?? 'Foto sepatu'"
                  class="size-16 rounded-control bg-photo object-cover"
                />
              </template>
              <span
                v-if="o.thumbnails.length === 0"
                class="flex size-16 items-center justify-center rounded-control bg-photo text-gray-600"
                ><PhotoIcon class="size-6" aria-hidden="true"
              /></span>
            </span>
            <span class="flex min-w-0 flex-[1_1_200px] flex-col gap-1">
              <span class="text-sm font-bold">{{ o.itemNames.join(', ') }}</span>
              <span class="text-[13px] text-gray-600">{{ method(o) }}</span>
            </span>
            <span class="ml-auto flex flex-col items-end gap-0.5">
              <span class="text-xs text-gray-600">Total</span>
              <span class="text-lg font-extrabold tabular-nums">{{ formatRupiah(o.total) }}</span>
            </span>
          </div>

          <div
            v-if="note(o)"
            class="rounded-control px-3.5 py-3 text-[13px]/normal font-semibold"
            :class="NOTE_CLASS[note(o)!.tone]"
          >
            <template v-if="note(o)!.countdown"
              >Unggah bukti dalam <CountdownTimer :expires-at="o.expiresAt" /> atau pesanan batal
              otomatis.</template
            >
            <template v-else>{{ note(o)!.text }}</template>
          </div>

          <footer class="flex flex-wrap justify-end gap-2.5 border-t border-gray-100 pt-3">
            <RouterLink
              :to="`/pesanan/${o.code}`"
              class="inline-flex h-11 items-center rounded-control border border-gray-300 px-3.5 text-[13px] font-bold text-gray-900 hover:bg-gray-50"
              >Lihat detail</RouterLink
            >
            <RouterLink
              v-if="cta(o)"
              :to="cta(o)!.to"
              class="inline-flex h-11 items-center rounded-control bg-brand-600 px-3.5 text-[13px] font-bold text-white hover:bg-brand-700"
              >{{ cta(o)!.label }}</RouterLink
            >
          </footer>
        </article>

        <Paginator
          v-if="list.data.value.meta.total > LIMIT"
          :first="(page - 1) * LIMIT"
          :rows="LIMIT"
          :total-records="list.data.value.meta.total"
          template="PrevPageLink PageLinks NextPageLink"
          @page="(e) => setQuery({ page: e.page + 1 })"
        />
      </template>
    </div>
  </div>
</template>
