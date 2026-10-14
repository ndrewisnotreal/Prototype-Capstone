<script setup lang="ts">
import { useChatStore } from '@/modules/chatbot'
import { computed, ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import {
  ArrowLeftIcon,
  ArrowUpTrayIcon,
  ClockIcon,
  DocumentArrowDownIcon,
  DocumentTextIcon,
  MapPinIcon,
  TruckIcon,
  XCircleIcon,
} from '@heroicons/vue/24/outline'
import { CONDITION_LABELS, ORDER_STATUS_LABELS, PAYMENT_STATUS_LABELS } from '@ssb/shared'
import { useStoreInfo } from '@/modules/storefront'
import { NotFoundPage } from '@/modules/system'
import { useConfirmAction, useNotify, useRequest } from '@/shared/composables'
import { ApiRequestError, formatDateTime, formatNumber, formatRupiah } from '@/shared/lib'
import { AppButton, CountdownTimer, StatusBadge } from '@/shared/ui'
import { ordersApi } from '../api/orders.api'
import OrderTimeline from '../components/OrderTimeline.vue'
import { buildTimeline, formatShortTime } from '../order-timeline'

// Layar PesananDetail + M-PesananDetail: varian dikirim, siap diambil, bukti ditolak, dan status lainnya.
const route = useRoute()
const notify = useNotify()
const confirm = useConfirmAction()
const { info: store } = useStoreInfo()

const code = computed(() => String(route.params.code))
const request = useRequest(() => ordersApi.detail(code.value), { immediate: false })
watch(code, () => void request.run(), { immediate: true })
const order = computed(() => request.data.value)

const steps = computed(() => (order.value ? buildTimeline(order.value) : []))
const rejected = computed(
  () => order.value?.status === 'AWAITING_PAYMENT' && order.value.paymentStatus === 'REJECTED',
)
const unpaid = computed(
  () => order.value?.status === 'AWAITING_PAYMENT' && order.value.paymentStatus === 'UNPAID',
)
const proof = computed(() => order.value?.proofs[0] ?? null)
const proofIsPdf = ref(false) // <img> gagal dimuat = PDF (atau file hilang): tampilkan ikon dokumen
watch(proof, () => (proofIsPdf.value = false))

const copied = ref(false)
async function copyResi() {
  try {
    await navigator.clipboard.writeText(order.value?.trackingNumber ?? '')
    copied.value = true
    setTimeout(() => (copied.value = false), 2000)
  } catch {
    notify.error('Gagal menyalin. Salin manual, ya.')
  }
}

const cancelling = ref(false)
async function cancel() {
  const ok = await confirm({
    title: 'Batalkan pesanan?',
    message:
      'Sepatu akan kembali tersedia untuk orang lain. Pesanan yang dibatalkan tidak bisa dipulihkan.',
    acceptLabel: 'Ya, batalkan',
    danger: true,
  })
  if (!ok) return
  cancelling.value = true
  try {
    request.data.value = await ordersApi.cancel(code.value)
    notify.success('Pesanan dibatalkan.')
  } catch (e) {
    notify.error(e instanceof ApiRequestError ? e.message : 'Gagal membatalkan. Coba lagi.')
    void request.run()
  } finally {
    cancelling.value = false
  }
}
const chat = useChatStore()
const openChat = () => chat.open()
</script>

<template>
  <NotFoundPage v-if="request.errorCode.value === 'ORDER_NOT_FOUND'" />

  <div
    v-else
    class="mx-auto flex max-w-[1180px] flex-col gap-4 px-4 pt-4 pb-10 sm:px-6 lg:gap-5 lg:pt-6 lg:pb-20"
  >
    <RouterLink
      to="/pesanan"
      class="hidden min-h-11 items-center gap-2 self-start text-sm font-bold text-brand-700 lg:inline-flex"
    >
      <ArrowLeftIcon class="size-4.5" aria-hidden="true" />Pesanan saya
    </RouterLink>

    <!-- Memuat -->
    <div v-if="request.loading.value && !order" class="flex flex-col gap-4" aria-busy="true">
      <Skeleton width="40%" height="36px" />
      <Skeleton height="320px" border-radius="16px" />
      <Skeleton height="160px" border-radius="16px" />
    </div>

    <!-- Gagal -->
    <div
      v-else-if="request.error.value && !order"
      role="alert"
      class="flex flex-col items-center gap-3 rounded-card border border-gray-200 bg-white px-6 py-14 text-center"
    >
      <p class="text-lg font-extrabold">Detail pesanan gagal dimuat</p>
      <p class="text-sm text-gray-600">{{ request.error.value }}</p>
      <AppButton variant="secondary" label="Coba lagi" @click="request.run()" />
    </div>

    <template v-else-if="order">
      <div class="flex flex-wrap items-end justify-between gap-2 lg:gap-4">
        <div>
          <h1 class="text-lg font-extrabold tracking-tight tabular-nums lg:text-[30px]">
            {{ order.code }}
          </h1>
          <p class="mt-1 text-[13px] text-gray-600 lg:text-sm">
            Dibuat {{ formatDateTime(order.createdAt) }}
          </p>
        </div>
        <div class="flex flex-wrap gap-2">
          <StatusBadge
            type="order"
            :status="order.status"
            :aria-label="`Pesanan: ${ORDER_STATUS_LABELS[order.status].label}`"
          />
          <StatusBadge
            type="payment"
            :status="order.paymentStatus"
            :aria-label="`Pembayaran: ${PAYMENT_STATUS_LABELS[order.paymentStatus].label}`"
          />
        </div>
      </div>

      <div class="flex flex-wrap items-start gap-4 lg:gap-6">
        <div class="flex min-w-0 flex-[999_1_560px] flex-col gap-4 lg:gap-5">
          <!-- Bukti ditolak -->
          <section
            v-if="rejected"
            role="alert"
            class="flex flex-col gap-3 rounded-card border-2 border-danger-line bg-white p-4 lg:p-5"
          >
            <div class="flex items-start gap-3 text-danger-fg">
              <XCircleIcon class="size-6 flex-none" aria-hidden="true" />
              <span class="flex flex-col gap-1">
                <strong class="text-base">Bukti transfer ditolak</strong>
                <span v-if="order.rejectReason" class="text-sm/relaxed text-[#7F1D1D]"
                  >Alasan dari pegawai: {{ order.rejectReason }}</span
                >
              </span>
            </div>
            <div
              class="flex flex-wrap items-center gap-3 rounded-control bg-warning-bg px-3.5 py-3 text-sm text-warning-fg"
            >
              <ClockIcon class="size-5 flex-none" aria-hidden="true" />
              <span class="flex-1"
                >Masih bisa unggah ulang sampai {{ formatShortTime(order.expiresAt) }}</span
              >
              <CountdownTimer
                :expires-at="order.expiresAt"
                class="text-xl font-extrabold text-gray-900"
              />
            </div>
            <RouterLink
              :to="`/pesanan/${order.code}/upload-bukti`"
              class="inline-flex h-12 items-center justify-center gap-2 self-stretch rounded-control bg-brand-600 px-5 text-[15px] font-extrabold text-white hover:bg-brand-700 sm:self-start"
            >
              <ArrowUpTrayIcon class="size-5" aria-hidden="true" />Unggah Ulang Bukti
            </RouterLink>
          </section>

          <!-- Belum bayar -->
          <section
            v-else-if="unpaid"
            class="flex flex-wrap items-center gap-3 rounded-card bg-warning-bg px-4 py-3.5 text-sm text-warning-fg lg:px-5"
          >
            <ClockIcon class="size-5 flex-none" aria-hidden="true" />
            <span class="flex-[1_1_200px]"
              >Unggah bukti transfer dalam
              <CountdownTimer :expires-at="order.expiresAt" class="font-extrabold text-gray-900" />
              atau pesanan batal otomatis.</span
            >
            <RouterLink
              :to="`/pesanan/${order.code}/bayar`"
              class="inline-flex h-11 items-center rounded-control bg-brand-600 px-4 text-sm font-bold text-white hover:bg-brand-700"
              >Lihat instruksi bayar</RouterLink
            >
          </section>

          <section
            aria-labelledby="tl-h"
            class="flex flex-col gap-3 rounded-card border border-gray-200 bg-white p-4 lg:gap-4 lg:p-5.5"
          >
            <h2 id="tl-h" class="text-base font-extrabold lg:text-lg">Status pesanan</h2>
            <OrderTimeline :steps="steps" />
          </section>

          <section
            aria-labelledby="it-h"
            class="flex flex-col gap-3.5 rounded-card border border-gray-200 bg-white p-4 lg:p-5.5"
          >
            <h2 id="it-h" class="text-base font-extrabold lg:text-lg">Sepatu</h2>
            <ul class="flex flex-col gap-3.5">
              <li v-for="i in order.items" :key="i.productCode" class="flex items-center gap-3.5">
                <img
                  v-if="i.photoUrl"
                  :src="i.photoUrl"
                  :alt="`${i.brand} ${i.model}`"
                  class="size-16 flex-none rounded-control bg-photo object-cover lg:size-18"
                />
                <span
                  v-else
                  role="img"
                  :aria-label="`Foto ${i.brand} ${i.model} belum ada`"
                  class="size-16 flex-none rounded-control bg-photo lg:size-18"
                ></span>
                <span class="flex min-w-0 flex-1 flex-col gap-0.5">
                  <RouterLink
                    :to="`/sepatu/${i.productCode}`"
                    class="font-bold text-gray-900 hover:text-brand-700"
                    >{{ i.brand }} {{ i.model }}</RouterLink
                  >
                  <span class="text-[13px] text-gray-600"
                    >EU {{ formatNumber(i.sizeEu) }}, {{ CONDITION_LABELS[i.condition] }},
                    {{ i.productCode }}</span
                  >
                </span>
                <span class="font-extrabold tabular-nums">{{ formatRupiah(i.price) }}</span>
              </li>
            </ul>
            <div class="flex items-baseline justify-between border-t border-gray-200 pt-3.5">
              <span class="font-bold">Total</span>
              <span class="text-[22px] font-extrabold tabular-nums">{{
                formatRupiah(order.total)
              }}</span>
            </div>
            <span class="text-xs text-gray-600"
              >Harga tercatat saat checkout dan tidak berubah.</span
            >
          </section>
        </div>

        <aside class="flex min-w-0 flex-[1_1_340px] flex-col gap-4 lg:gap-5">
          <section
            v-if="order.fulfillment === 'SHIPPING'"
            aria-labelledby="ship-h"
            class="flex flex-col gap-3 rounded-card border border-gray-200 bg-white p-4 lg:p-5"
          >
            <div class="flex items-center gap-2.5">
              <TruckIcon class="size-5.5 text-brand-600" aria-hidden="true" />
              <h2 id="ship-h" class="text-base font-extrabold">Pengiriman</h2>
            </div>
            <dl class="grid grid-cols-[auto_1fr] gap-x-3.5 gap-y-2 text-sm">
              <dt class="text-gray-600">Ekspedisi</dt>
              <dd class="font-bold">{{ order.courier ?? 'Dikonfirmasi pegawai' }}</dd>
              <dt class="text-gray-600">Penerima</dt>
              <dd>{{ order.recipient.name }}, {{ order.recipient.phone }}</dd>
              <dt class="text-gray-600">Alamat</dt>
              <dd class="leading-normal">{{ order.shippingAddress }}</dd>
            </dl>
            <div
              v-if="order.trackingNumber"
              class="flex items-center gap-2.5 rounded-control border border-brand-100 bg-brand-50/50 py-2.5 pr-2.5 pl-3.5"
            >
              <span class="flex flex-1 flex-col">
                <span class="text-xs text-gray-600">Nomor resi</span>
                <span class="text-base font-extrabold tracking-wide tabular-nums">{{
                  order.trackingNumber
                }}</span>
              </span>
              <AppButton
                variant="secondary"
                size="sm"
                :label="copied ? 'Tersalin' : 'Salin'"
                aria-label="Salin nomor resi"
                @click="copyResi"
              />
            </div>
          </section>

          <section
            v-else
            aria-labelledby="pick-h"
            class="flex flex-col gap-2.5 rounded-card border border-brand-100 bg-brand-50 p-4 text-brand-900 lg:p-5"
          >
            <div class="flex items-center gap-2.5">
              <MapPinIcon class="size-5.5" aria-hidden="true" />
              <h2 id="pick-h" class="text-base font-extrabold">Ambil di toko</h2>
            </div>
            <p class="text-sm/relaxed">
              {{ store?.address
              }}<template v-for="h in store?.openingHours ?? []" :key="h.days"
                ><br />{{ h.days }} {{ h.hours }}</template
              ><br />{{
                order.status === 'READY_FOR_PICKUP'
                  ? 'Sepatu sudah siap. '
                  : 'Datang setelah status Siap Diambil. '
              }}Tunjukkan kode <strong>{{ order.code }}</strong> ke pegawai.
            </p>
          </section>

          <section
            aria-labelledby="pay-h"
            class="flex flex-col gap-3 rounded-card border border-gray-200 bg-white p-4 lg:p-5"
          >
            <h2 id="pay-h" class="text-base font-extrabold">Pembayaran</h2>
            <div v-if="proof" class="flex items-center gap-3">
              <a
                :href="`/api/files/payment-proofs/${proof.id}`"
                target="_blank"
                rel="noopener"
                aria-label="Buka bukti transfer"
                class="flex h-18 w-14 flex-none items-center justify-center overflow-hidden rounded-[10px] bg-photo text-brand-700"
              >
                <DocumentTextIcon v-if="proofIsPdf" class="size-7" aria-hidden="true" />
                <img
                  v-else
                  :src="`/api/files/payment-proofs/${proof.id}`"
                  alt="Bukti transfer yang diunggah"
                  class="size-full object-cover"
                  @error="proofIsPdf = true"
                />
              </a>
              <span class="flex flex-col gap-1 text-[13px]">
                <span class="font-bold"
                  >Transfer {{ proof.senderBank }}, a.n. {{ proof.senderName }}</span
                >
                <span class="text-gray-600"
                  >{{ formatRupiah(proof.amount) }}, diunggah
                  {{ formatShortTime(proof.createdAt) }}</span
                >
                <StatusBadge type="proof" :status="proof.status" class="self-start" />
              </span>
            </div>
            <p v-else class="text-sm text-gray-600">
              Belum ada bukti transfer.
              <RouterLink
                v-if="order.status === 'AWAITING_PAYMENT'"
                :to="`/pesanan/${order.code}/bayar`"
                class="font-bold text-brand-700 underline"
                >Lihat instruksi bayar</RouterLink
              >
            </p>
          </section>

          <div class="flex flex-col gap-2.5">
            <RouterLink
              v-if="order.paymentStatus === 'VERIFIED'"
              :to="`/pesanan/${order.code}/invoice`"
              class="flex h-12 items-center justify-center gap-2 rounded-control border border-gray-300 bg-white text-[15px] font-bold text-gray-900 hover:bg-gray-50"
            >
              <DocumentArrowDownIcon class="size-5" aria-hidden="true" />Unduh Invoice
            </RouterLink>
            <AppButton
              variant="ghost"
              class="h-12!"
              label="Ada kendala? Tanya Asisten"
              @click="openChat"
            />
            <AppButton
              v-if="order.status === 'AWAITING_PAYMENT'"
              variant="ghost"
              class="text-danger-fg!"
              label="Batalkan pesanan"
              :loading="cancelling"
              @click="cancel"
            />
          </div>
        </aside>
      </div>
    </template>
  </div>
</template>
