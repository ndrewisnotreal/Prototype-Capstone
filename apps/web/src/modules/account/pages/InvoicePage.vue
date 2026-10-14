<script setup lang="ts">
import { computed, onBeforeUnmount, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ArrowDownTrayIcon, ArrowLeftIcon, PrinterIcon } from '@heroicons/vue/24/outline'
import { CONDITION_LABELS, FULFILLMENT_LABELS } from '@ssb/shared'
import { useAuthStore } from '@/modules/auth'
import { NotFoundPage } from '@/modules/system'
import BrandLogo from '@/layouts/parts/BrandLogo.vue'
import { useRequest } from '@/shared/composables'
import { formatDate, formatNumber, formatRupiah } from '@/shared/lib'
import { AppButton } from '@/shared/ui'
import { ordersApi } from '../api/orders.api'
import { formatShortTime } from '../order-timeline'

// Layar Invoice (layout blank): kertas A4 siap cetak. "Unduh PDF" = dialog cetak browser → Simpan sebagai PDF.
const route = useRoute()
const router = useRouter()
const auth = useAuthStore()

const code = computed(() => String(route.params.code))
const request = useRequest(() => ordersApi.invoice(code.value), { immediate: false })
watch(code, () => void request.run(), { immediate: true })
const inv = computed(() => request.data.value)

// Judul dokumen jadi nama file PDF bawaan browser
watch(inv, (i) => i && (document.title = `Invoice ${i.code}`))
onBeforeUnmount(() => (document.title = 'Suwandi SecondBranded'))

const isCustomer = computed(() => auth.user?.role === 'CUSTOMER')
const goBack = () => (isCustomer.value ? router.push(`/pesanan/${code.value}`) : router.back())
const print = () => window.print()
</script>

<template>
  <NotFoundPage v-if="request.errorCode.value === 'ORDER_NOT_FOUND'" />

  <div v-else class="min-h-screen bg-gray-200 pb-16 print:bg-white print:pb-0">
    <div class="border-b border-gray-300 bg-white print:hidden">
      <div class="mx-auto flex max-w-[900px] flex-wrap items-center gap-2.5 px-4 py-3.5 sm:px-6">
        <button
          type="button"
          class="mr-auto inline-flex min-h-11 items-center gap-2 text-sm font-bold text-brand-700"
          @click="goBack"
        >
          <ArrowLeftIcon class="size-4.5" aria-hidden="true" />Detail pesanan
        </button>
        <template v-if="inv">
          <AppButton variant="secondary" :icon="PrinterIcon" label="Cetak" @click="print" />
          <AppButton :icon="ArrowDownTrayIcon" label="Unduh PDF" @click="print" />
        </template>
      </div>
    </div>

    <!-- Memuat -->
    <div
      v-if="request.loading.value && !inv"
      class="mx-auto mt-8 max-w-[794px] px-4"
      aria-busy="true"
    >
      <Skeleton height="900px" />
    </div>

    <!-- Belum tersedia / gagal -->
    <div
      v-else-if="request.error.value"
      role="alert"
      class="mx-auto mt-8 flex max-w-[600px] flex-col items-center gap-3 rounded-card bg-white px-6 py-14 text-center"
    >
      <p class="text-lg font-extrabold">
        {{
          request.errorCode.value === 'INVOICE_NOT_AVAILABLE'
            ? 'Invoice belum tersedia'
            : 'Invoice gagal dimuat'
        }}
      </p>
      <p class="text-sm text-gray-600">{{ request.error.value }}</p>
      <AppButton
        v-if="request.errorCode.value !== 'INVOICE_NOT_AVAILABLE'"
        variant="secondary"
        label="Coba lagi"
        @click="request.run()"
      />
    </div>

    <article
      v-else-if="inv"
      class="mx-auto mt-8 flex min-h-[1060px] max-w-[794px] flex-col gap-8 bg-white px-6 py-10 shadow-[0_12px_32px_rgb(17_24_39/0.12)] [print-color-adjust:exact] sm:px-14 sm:pt-14 sm:pb-12 print:m-0 print:min-h-0 print:max-w-none print:p-0 print:shadow-none"
    >
      <header class="flex flex-wrap items-start justify-between gap-6">
        <div class="flex items-center gap-3">
          <BrandLogo />
          <div class="flex flex-col gap-0.5 text-xs/normal text-gray-700">
            <strong class="text-base text-gray-900">Suwandi SecondBranded</strong>
            <span>{{ inv.store.address }}</span>
            <span>WA {{ inv.store.whatsapp }}</span>
          </div>
        </div>
        <div class="text-right">
          <div class="text-[30px] font-extrabold tracking-[0.04em] text-brand-700">INVOICE</div>
          <div class="text-[13px] font-bold tabular-nums">{{ inv.code }}</div>
        </div>
      </header>

      <div class="grid gap-5 border-y border-gray-200 py-4.5 text-[13px]/relaxed sm:grid-cols-3">
        <div>
          <div class="text-xs font-bold text-gray-600">Ditagihkan ke</div>
          <div class="font-bold">{{ inv.recipient.name }}</div>
          <div>{{ inv.recipient.phone }}</div>
          <div>{{ inv.customer.email }}</div>
        </div>
        <div>
          <div class="text-xs font-bold text-gray-600">Tanggal</div>
          <div>Pesanan {{ formatDate(inv.createdAt) }}</div>
          <div v-if="inv.verifiedAt">Lunas {{ formatDate(inv.verifiedAt) }}</div>
        </div>
        <div>
          <div class="text-xs font-bold text-gray-600">Status</div>
          <span
            class="mt-1 inline-block rounded-full border-[1.5px] border-success-fg px-2.5 py-0.5 text-xs font-extrabold text-success-fg"
            >LUNAS</span
          >
          <div class="mt-1">{{ FULFILLMENT_LABELS[inv.fulfillment] }}</div>
          <div v-if="inv.shippingAddress" class="text-gray-600">{{ inv.shippingAddress }}</div>
        </div>
      </div>

      <!-- kertas A4 lebih lebar dari ponsel: area geser bisa difokus dan digulir dengan keyboard -->
      <div tabindex="0" role="region" aria-label="Invoice" class="overflow-x-auto">
        <table class="w-full min-w-[520px] border-collapse text-[13px]">
          <thead>
            <tr class="border-b-2 border-gray-900 text-left text-xs text-gray-600">
              <th class="pb-2.5 font-bold">Sepatu</th>
              <th class="pb-2.5 font-bold">Kode</th>
              <th class="pb-2.5 font-bold">Ukuran</th>
              <th class="pb-2.5 font-bold">Kondisi</th>
              <th class="pb-2.5 text-right font-bold">Harga</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="i in inv.items" :key="i.productCode" class="border-b border-gray-200">
              <td class="py-3.5 font-bold">{{ i.brand }} {{ i.model }}</td>
              <td class="py-3.5">{{ i.productCode }}</td>
              <td class="py-3.5">EU {{ formatNumber(i.sizeEu) }}</td>
              <td class="py-3.5">{{ CONDITION_LABELS[i.condition] }}</td>
              <td class="py-3.5 text-right tabular-nums">{{ formatRupiah(i.price) }}</td>
            </tr>
          </tbody>
        </table>
      </div>

      <div class="grid w-[300px] max-w-full grid-cols-[1fr_auto] gap-y-2 self-end text-[13px]">
        <span class="text-gray-600">Subtotal</span>
        <span class="text-right tabular-nums">{{ formatRupiah(inv.total) }}</span>
        <span class="text-gray-600">Ongkir</span>
        <span class="text-right">{{
          inv.fulfillment === 'PICKUP' ? formatRupiah(0) : 'Dikonfirmasi terpisah'
        }}</span>
        <span class="border-t-2 border-gray-900 pt-2.5 text-base font-extrabold">Total</span>
        <span
          class="border-t-2 border-gray-900 pt-2.5 text-right text-base font-extrabold tabular-nums"
          >{{ formatRupiah(inv.total) }}</span
        >
      </div>

      <div
        v-if="inv.payment"
        class="rounded-control bg-brand-50/50 px-4 py-3.5 text-xs/relaxed text-gray-700"
      >
        Dibayar via transfer {{ inv.payment.senderBank }} a.n. {{ inv.payment.senderName }}.
        <template v-if="inv.verifiedAt"
          >Diverifikasi{{
            inv.payment.verifiedBy ? ` oleh pegawai ${inv.payment.verifiedBy}` : ''
          }}
          pada {{ formatShortTime(inv.verifiedAt) }} WIB.</template
        >
        Sepatu bekas dijual sesuai kondisi di foto dan deskripsi produk.
      </div>

      <footer
        class="mt-auto flex flex-wrap justify-between gap-3 border-t border-gray-200 pt-4 text-[11px] text-gray-600"
      >
        <span>Dokumen ini dibuat otomatis oleh sistem Suwandi SecondBranded.</span>
        <span>Cek keaslian di halaman Kanal Resmi</span>
      </footer>
    </article>
  </div>
</template>
