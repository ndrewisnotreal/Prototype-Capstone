<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import {
  ArrowUpTrayIcon,
  BuildingLibraryIcon,
  CheckCircleIcon,
  CheckIcon,
  ClockIcon,
  DocumentDuplicateIcon,
  ExclamationTriangleIcon,
  NoSymbolIcon,
  XCircleIcon,
} from '@heroicons/vue/24/outline'
import { ORDER_STATUS_LABELS } from '@ssb/shared'
import { useStoreInfo } from '@/modules/storefront'
import { NotFoundPage } from '@/modules/system'
import { useNotify, useRequest } from '@/shared/composables'
import { formatDateTime, formatNumber, formatRupiah } from '@/shared/lib'
import { AppButton, CountdownTimer, StatusBadge } from '@/shared/ui'
import { ordersApi } from '../api/orders.api'

// Layar Bayar: instruksi transfer + hitung mundur ke batas unggah bukti (expiresAt dari server).
const route = useRoute()
const notify = useNotify()
const { info: store } = useStoreInfo()

const code = computed(() => String(route.params.code))
const request = useRequest(
  async () => {
    const [order, pay] = await Promise.all([
      ordersApi.detail(code.value),
      ordersApi.paymentInstructions(code.value),
    ])
    return { order, pay }
  },
  { immediate: false },
)
watch(code, () => void request.run(), { immediate: true })
const order = computed(() => request.data.value?.order)
const pay = computed(() => request.data.value?.pay)

const expired = ref(false)
watch(pay, () => (expired.value = false))
/** masih boleh transfer + unggah bukti */
const payable = computed(() => pay.value?.status === 'AWAITING_PAYMENT' && !expired.value)
const rejected = computed(() => pay.value?.paymentStatus === 'REJECTED')

const fulfillmentText = computed(() =>
  order.value?.fulfillment === 'SHIPPING'
    ? `Dikirim ke ${order.value.shippingAddress ?? '-'}`
    : `Ambil di toko${store.value?.address ? `, ${store.value.address}` : ''}`,
)

// Tombol salin: label berubah jadi "Tersalin" sebentar
const copied = ref('')
let resetTimer: ReturnType<typeof setTimeout> | undefined
async function copy(key: string, text: string) {
  try {
    await navigator.clipboard.writeText(text)
    copied.value = key
    clearTimeout(resetTimer)
    resetTimer = setTimeout(() => (copied.value = ''), 2000)
  } catch {
    notify.error('Gagal menyalin. Salin manual, ya.')
  }
}
</script>

<template>
  <NotFoundPage v-if="request.errorCode.value === 'ORDER_NOT_FOUND'" />

  <div v-else class="mx-auto max-w-[1080px] px-4 pt-5 pb-10 sm:px-6 lg:pt-10 lg:pb-20">
    <!-- Memuat -->
    <div v-if="request.loading.value && !pay" class="flex flex-wrap gap-7" aria-busy="true">
      <div class="flex min-w-0 flex-[999_1_560px] flex-col gap-5">
        <Skeleton height="56px" border-radius="16px" />
        <Skeleton height="84px" border-radius="16px" />
        <Skeleton height="320px" border-radius="16px" />
      </div>
      <Skeleton class="min-w-0 flex-[1_1_300px]" height="300px" border-radius="16px" />
    </div>

    <!-- Gagal -->
    <div
      v-else-if="request.error.value && !pay"
      role="alert"
      class="flex flex-col items-center gap-3 rounded-card border border-gray-200 bg-white px-6 py-14 text-center"
    >
      <p class="text-lg font-extrabold">Instruksi bayar gagal dimuat</p>
      <p class="text-sm text-gray-600">{{ request.error.value }}</p>
      <AppButton variant="secondary" label="Coba lagi" @click="request.run()" />
    </div>

    <div v-else-if="pay && order" class="flex flex-wrap items-start gap-7">
      <div class="flex min-w-0 flex-[999_1_560px] flex-col gap-5">
        <!-- Masih bisa dibayar -->
        <template v-if="payable">
          <div class="flex items-center gap-4">
            <span
              class="flex size-14 flex-none items-center justify-center rounded-card"
              :class="rejected ? 'bg-danger-bg text-danger-fg' : 'bg-success-bg text-success-fg'"
            >
              <component
                :is="rejected ? XCircleIcon : CheckCircleIcon"
                class="size-7"
                aria-hidden="true"
              />
            </span>
            <div>
              <h1 class="text-xl font-extrabold tracking-tight sm:text-2xl lg:text-[30px]">
                {{
                  rejected
                    ? 'Bukti transfer ditolak, unggah ulang ya'
                    : 'Pesanan dibuat, sepatumu sudah direservasi'
                }}
              </h1>
              <p class="mt-1 text-[15px] text-gray-600">
                Selesaikan transfer dan unggah buktinya sebelum waktu habis.
              </p>
            </div>
          </div>

          <div
            v-if="rejected && pay.lastRejectReason"
            role="alert"
            class="flex gap-3 rounded-control bg-danger-bg px-4 py-3.5 text-sm/normal text-danger-fg"
          >
            <XCircleIcon class="size-5 flex-none" aria-hidden="true" />
            <span><strong>Alasan:</strong> {{ pay.lastRejectReason }}</span>
          </div>

          <div
            class="flex flex-wrap items-center gap-4 rounded-card bg-warning-bg px-5 py-4.5 text-warning-fg"
          >
            <ClockIcon class="size-7 flex-none" aria-hidden="true" />
            <span class="flex-[1_1_220px] text-sm/normal"
              ><strong class="block text-[15px]">Batas unggah bukti</strong
              >{{ formatDateTime(pay.expiresAt) }}</span
            >
            <CountdownTimer
              :expires-at="pay.expiresAt"
              class="text-[34px] font-extrabold text-gray-900"
              @expired="expired = true"
            />
          </div>

          <section
            aria-labelledby="pay-h"
            class="flex flex-col gap-4.5 rounded-card border border-gray-200 bg-white p-4 lg:p-5.5"
          >
            <h2 id="pay-h" class="text-lg font-extrabold">Transfer tepat sejumlah</h2>
            <div
              class="flex flex-wrap items-center justify-between gap-3.5 rounded-control border border-brand-100 bg-brand-50/50 px-4.5 py-4"
            >
              <span class="text-3xl font-extrabold tabular-nums lg:text-4xl">{{
                formatRupiah(pay.total)
              }}</span>
              <AppButton
                variant="secondary"
                :icon="copied === 'amount' ? CheckIcon : DocumentDuplicateIcon"
                :label="copied === 'amount' ? 'Tersalin' : 'Salin jumlah'"
                @click="copy('amount', String(pay.total))"
              />
            </div>
            <span class="text-sm font-bold">Ke salah satu rekening resmi ini</span>
            <ul class="flex flex-col gap-2.5">
              <li
                v-for="b in pay.bankAccounts"
                :key="b.id"
                class="flex flex-wrap items-center gap-3 rounded-control border border-gray-200 px-4 py-3.5"
              >
                <span
                  class="flex size-11 flex-none items-center justify-center rounded-control bg-brand-50 text-brand-700"
                >
                  <BuildingLibraryIcon class="size-5.5" aria-hidden="true" />
                </span>
                <span class="flex flex-[1_1_200px] flex-col gap-0.5">
                  <span class="font-extrabold">{{ b.bankName }}</span>
                  <span class="text-[17px] font-bold tracking-wide tabular-nums">{{
                    b.accountNumber
                  }}</span>
                  <span class="text-xs text-gray-600">a.n. {{ b.accountName }}</span>
                </span>
                <AppButton
                  variant="secondary"
                  :class="copied === `bank-${b.id}` && 'bg-success-bg! text-success-fg!'"
                  :aria-label="`Salin nomor ${b.bankName}`"
                  :label="copied === `bank-${b.id}` ? 'Tersalin' : 'Salin nomor'"
                  @click="copy(`bank-${b.id}`, b.accountNumber.replace(/\D/g, ''))"
                />
              </li>
            </ul>
            <div
              class="flex gap-3 rounded-control bg-danger-bg px-4 py-3.5 text-sm/normal text-danger-fg"
            >
              <ExclamationTriangleIcon class="size-5 flex-none" aria-hidden="true" />
              <span
                >Ada yang chat minta transfer ke rekening lain? Itu penipuan.
                <RouterLink to="/kanal-resmi" class="font-extrabold text-danger-fg underline"
                  >Cek Kanal Resmi</RouterLink
                ></span
              >
            </div>
          </section>

          <div class="flex flex-wrap gap-3">
            <RouterLink
              :to="`/pesanan/${pay.code}/upload-bukti`"
              class="inline-flex h-13 w-full items-center justify-center gap-2.5 rounded-control bg-brand-600 px-6 text-base font-extrabold text-white shadow-[0_6px_16px_rgb(59_93_80/0.25)] hover:bg-brand-700 sm:w-auto"
            >
              <ArrowUpTrayIcon class="size-5.5" aria-hidden="true" />Upload Bukti Transfer
            </RouterLink>
            <RouterLink
              :to="`/pesanan/${pay.code}`"
              class="inline-flex h-13 w-full items-center justify-center rounded-control border border-gray-300 bg-white px-5 text-[15px] font-bold text-gray-900 hover:bg-gray-50 sm:w-auto"
              >Lihat detail pesanan</RouterLink
            >
          </div>
        </template>

        <!-- Tidak bisa dibayar lagi: lewat batas, dibatalkan, atau bukti sudah diunggah -->
        <div
          v-else
          class="flex flex-col items-center gap-3 rounded-card border border-gray-200 bg-white px-6 py-12 text-center"
        >
          <span
            class="flex size-14 items-center justify-center rounded-card"
            :class="
              pay.status === 'CANCELLED' || expired
                ? 'bg-neutral-bg text-neutral-fg'
                : 'bg-success-bg text-success-fg'
            "
          >
            <component
              :is="pay.status === 'CANCELLED' || expired ? NoSymbolIcon : CheckCircleIcon"
              class="size-7"
              aria-hidden="true"
            />
          </span>
          <h1 class="text-2xl font-extrabold">
            {{
              pay.status === 'AWAITING_PAYMENT'
                ? 'Waktu pembayaran habis'
                : pay.status === 'CANCELLED'
                  ? 'Pesanan dibatalkan'
                  : 'Bukti transfer sudah kami terima'
            }}
          </h1>
          <p class="max-w-[46ch] text-[15px] text-gray-600">
            {{
              pay.status === 'AWAITING_PAYMENT'
                ? 'Pesanan ini akan dibatalkan otomatis dan sepatunya kembali dijual.'
                : pay.status === 'CANCELLED'
                  ? (order.cancelReason ?? 'Pesanan ini sudah tidak aktif.')
                  : `Status pesanan: ${ORDER_STATUS_LABELS[pay.status].label}. Tidak perlu transfer lagi.`
            }}
          </p>
          <div class="mt-1 flex flex-wrap justify-center gap-3">
            <RouterLink
              :to="`/pesanan/${pay.code}`"
              class="inline-flex h-11 items-center rounded-control border border-gray-300 bg-white px-4.5 text-sm font-bold text-gray-900 hover:bg-gray-50"
              >Lihat detail pesanan</RouterLink
            >
            <RouterLink
              v-if="pay.status === 'CANCELLED' || expired"
              to="/katalog"
              class="inline-flex h-11 items-center rounded-control bg-brand-600 px-4.5 text-sm font-bold text-white hover:bg-brand-700"
              >Lihat Katalog</RouterLink
            >
          </div>
        </div>
      </div>

      <aside
        aria-labelledby="ord-h"
        class="flex min-w-0 flex-[1_1_300px] flex-col gap-3.5 rounded-card border border-gray-200 bg-white p-5.5"
      >
        <h2 id="ord-h" class="text-base font-extrabold">Kode pesanan</h2>
        <div class="flex items-center justify-between gap-2">
          <span class="text-base font-extrabold tabular-nums">{{ order.code }}</span>
          <AppButton
            variant="secondary"
            class="w-11 px-0!"
            :icon="copied === 'code' ? CheckIcon : DocumentDuplicateIcon"
            :aria-label="copied === 'code' ? 'Kode pesanan tersalin' : 'Salin kode pesanan'"
            @click="copy('code', order.code)"
          />
        </div>
        <div class="flex flex-wrap gap-1.5">
          <StatusBadge type="order" :status="order.status" />
          <StatusBadge type="payment" :status="order.paymentStatus" />
        </div>
        <ul class="flex flex-col gap-3 border-t border-gray-200 pt-3.5">
          <li v-for="i in order.items" :key="i.productCode" class="flex items-center gap-2.5">
            <img
              v-if="i.photoUrl"
              :src="i.photoUrl"
              :alt="`${i.brand} ${i.model}`"
              class="size-12 flex-none rounded-[10px] bg-photo object-cover"
            />
            <span
              v-else
              role="img"
              :aria-label="`Foto ${i.brand} ${i.model} belum ada`"
              class="size-12 flex-none rounded-[10px] bg-photo"
            ></span>
            <span class="flex-1 text-[13px] font-semibold"
              >{{ i.model }}, EU {{ formatNumber(i.sizeEu) }}</span
            >
            <span class="text-[13px] font-extrabold tabular-nums">{{ formatRupiah(i.price) }}</span>
          </li>
        </ul>
        <div class="border-t border-gray-200 pt-3 text-[13px]/normal text-gray-600">
          {{ fulfillmentText }}
        </div>
      </aside>
    </div>
  </div>
</template>
