<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import {
  ArrowTopRightOnSquareIcon,
  DocumentTextIcon,
  MagnifyingGlassMinusIcon,
  MagnifyingGlassPlusIcon,
  XCircleIcon,
} from '@heroicons/vue/24/outline'
import type { PendingProofDto } from '@ssb/shared'
import { useNotify, useRequest } from '@/shared/composables'
import { ApiRequestError, formatDateTime, formatRupiah, formatTimeAgo } from '@/shared/lib'
import { AppButton } from '@/shared/ui'
import { paymentsApi } from '../api/payments.api'

// Layar P-Verifikasi: antrean bukti (terlama dulu) + detail, terima / tolak dengan alasan wajib.
const REASON_MIN = 10 // sama dengan StaffReasonDto di api
const QUICK_REASONS = [
  'Nominal kurang dari total pesanan.',
  'Bukti buram atau terpotong.',
  'Dana belum masuk ke rekening toko.',
]

const route = useRoute()
const notify = useNotify()
const queue = useRequest(() => paymentsApi.pending())
const items = computed(() => queue.data.value ?? [])

const selectedId = ref<number | null>(null)
const current = computed(
  () => items.value.find((p) => p.id === selectedId.value) ?? items.value[0] ?? null,
)
// ?kode= dari dashboard: pilih bukti pesanan itu saat antrean pertama kali termuat
watch(
  items,
  (list) => {
    const code = String(route.query.kode ?? '')
    if (selectedId.value === null && code)
      selectedId.value = list.find((p) => p.order.code === code)?.id ?? null
  },
  { once: true },
)

const zoom = ref(false)
const isPdf = ref(false) // <img> gagal dimuat = PDF (atau file hilang)
const fundsChecked = ref(false)
const rejecting = ref(false)
const reason = ref('')
watch(current, () => {
  zoom.value = false
  isPdf.value = false
  fundsChecked.value = false
  rejecting.value = false
  reason.value = ''
})

const mismatch = computed(() => current.value && current.value.amount !== current.value.order.total)
const reasonTooShort = computed(() => reason.value.trim().length < REASON_MIN)
const fileUrl = (p: PendingProofDto) => `/api/files/payment-proofs/${p.id}`
const itemsText = (p: PendingProofDto) => p.order.itemNames.join(', ')

function startReject() {
  rejecting.value = true
  reason.value = mismatch.value ? QUICK_REASONS[0]! : ''
}

const busy = ref(false)
async function decide(action: 'accept' | 'reject') {
  const proof = current.value
  if (!proof) return
  busy.value = true
  try {
    if (action === 'accept') await paymentsApi.accept(proof.id)
    else await paymentsApi.reject(proof.id, reason.value.trim())
    notify.success(
      action === 'accept'
        ? `Pembayaran ${proof.order.code} diterima.`
        : `Bukti ${proof.order.code} ditolak. Customer bisa unggah ulang.`,
    )
    // keluarkan dari antrean, lanjut ke bukti berikutnya
    const index = items.value.findIndex((p) => p.id === proof.id)
    queue.data.value = items.value.filter((p) => p.id !== proof.id)
    selectedId.value = items.value[Math.min(index, items.value.length - 1)]?.id ?? null
  } catch (e) {
    notify.error(e instanceof ApiRequestError ? e.message : 'Gagal menyimpan. Coba lagi.')
    // sudah diputuskan pegawai lain / pesanan berubah: segarkan antrean
    if (e instanceof ApiRequestError && e.status === 409) void queue.run()
  } finally {
    busy.value = false
  }
}
</script>

<template>
  <header>
    <h1 class="text-[28px] font-extrabold tracking-tight">Verifikasi pembayaran</h1>
    <p class="mt-1 text-sm text-gray-600">
      {{
        queue.data.value ? `${items.length} bukti menunggu, terlama di atas` : 'Memuat antrean...'
      }}
    </p>
  </header>

  <!-- Gagal -->
  <div
    v-if="queue.error.value && !queue.data.value"
    role="alert"
    class="flex flex-col items-center gap-3 rounded-card border border-gray-200 bg-white px-6 py-14 text-center"
  >
    <p class="text-lg font-extrabold">Antrean gagal dimuat</p>
    <p class="text-sm text-gray-600">{{ queue.error.value }}</p>
    <AppButton variant="secondary" label="Coba lagi" @click="queue.run()" />
  </div>

  <!-- Memuat -->
  <div v-else-if="!queue.data.value" class="flex flex-wrap items-start gap-5" aria-busy="true">
    <Skeleton class="min-w-0 flex-[1_1_300px]" height="320px" border-radius="16px" />
    <Skeleton class="min-w-0 flex-[999_1_520px]" height="520px" border-radius="16px" />
  </div>

  <!-- Kosong -->
  <div
    v-else-if="items.length === 0"
    class="flex flex-col items-center gap-2 rounded-card border border-gray-200 bg-white px-6 py-14 text-center"
  >
    <p class="text-lg font-extrabold">Tidak ada bukti yang menunggu</p>
    <p class="text-sm text-gray-600">Bukti transfer baru dari customer akan muncul di sini.</p>
    <AppButton variant="secondary" label="Muat ulang" class="mt-1" @click="queue.run()" />
  </div>

  <div v-else-if="current" class="flex flex-wrap items-start gap-5">
    <section
      aria-label="Antrean"
      class="min-w-0 flex-[1_1_300px] overflow-hidden rounded-card border border-gray-200 bg-white"
    >
      <button
        v-for="p in items"
        :key="p.id"
        type="button"
        :aria-pressed="p.id === current.id"
        class="flex w-full flex-col gap-1 border-b border-l-4 border-b-gray-100 px-4 py-3.5 text-left"
        :class="
          p.id === current.id
            ? 'border-l-brand-600 bg-brand-50/50'
            : 'border-l-transparent bg-white hover:bg-gray-50'
        "
        @click="selectedId = p.id"
      >
        <span class="flex items-center justify-between gap-2">
          <span class="text-sm font-extrabold tabular-nums">{{ p.order.code }}</span>
          <span class="rounded-full bg-warning-bg px-2 py-0.5 text-[11px] font-bold text-warning-fg"
            >Menunggu</span
          >
        </span>
        <span class="text-sm font-semibold">{{ p.order.customerName }}</span>
        <span class="text-xs text-gray-600"
          >{{ formatRupiah(p.order.total) }}, diunggah {{ formatTimeAgo(p.createdAt) }}</span
        >
      </button>
    </section>

    <section
      aria-labelledby="det-h"
      class="flex min-w-0 flex-[999_1_520px] flex-col rounded-card border border-gray-200 bg-white"
    >
      <div
        class="flex flex-wrap items-center justify-between gap-2 border-b border-gray-100 px-5 py-4"
      >
        <h2 id="det-h" class="text-lg font-extrabold tabular-nums">{{ current.order.code }}</h2>
        <span class="text-[13px] text-gray-600"
          >{{ current.order.customerName }}, {{ current.order.recipientPhone }}</span
        >
      </div>

      <div class="flex flex-wrap gap-5 p-5">
        <div class="flex min-w-0 flex-[1_1_240px] flex-col gap-2.5">
          <div
            class="flex aspect-[3/4] items-center justify-center overflow-hidden rounded-control bg-photo"
          >
            <div v-if="isPdf" class="flex flex-col items-center gap-2 text-brand-700">
              <DocumentTextIcon class="size-12" aria-hidden="true" />
              <span class="text-[13px] font-semibold">Bukti berupa PDF, buka aslinya</span>
            </div>
            <img
              v-else
              :src="fileUrl(current)"
              :alt="`Bukti transfer ${current.order.code}`"
              class="size-full object-contain transition-transform duration-200"
              :class="zoom && 'scale-[1.6]'"
              @error="isPdf = true"
            />
          </div>
          <div class="flex gap-2">
            <AppButton
              variant="secondary"
              size="sm"
              class="flex-1"
              :icon="zoom ? MagnifyingGlassMinusIcon : MagnifyingGlassPlusIcon"
              :label="zoom ? 'Perkecil' : 'Perbesar'"
              :disabled="isPdf"
              @click="zoom = !zoom"
            />
            <a
              :href="fileUrl(current)"
              target="_blank"
              rel="noopener"
              class="inline-flex h-9 flex-1 items-center justify-center gap-1.5 rounded-control border border-gray-300 text-[13px] font-bold text-gray-900 hover:bg-gray-50"
              ><ArrowTopRightOnSquareIcon class="size-4" aria-hidden="true" />Buka asli</a
            >
          </div>
        </div>

        <div class="flex min-w-0 flex-[1_1_280px] flex-col gap-3.5">
          <table class="w-full border-collapse text-sm">
            <thead>
              <tr class="text-left text-xs text-gray-600">
                <th class="pb-2 font-bold"><span class="sr-only">Data</span></th>
                <th class="px-2 pb-2 font-bold">Seharusnya</th>
                <th class="pb-2 font-bold">Dari bukti</th>
              </tr>
            </thead>
            <tbody>
              <tr class="border-t border-gray-100">
                <th scope="row" class="py-2.5 text-left font-semibold text-gray-600">Nominal</th>
                <td class="px-2 py-2.5 font-extrabold tabular-nums">
                  {{ formatRupiah(current.order.total) }}
                </td>
                <td
                  class="py-2.5 font-extrabold tabular-nums"
                  :class="mismatch ? 'text-danger-fg' : 'text-success-fg'"
                >
                  {{ formatRupiah(current.amount) }} {{ mismatch ? '✗' : '✓' }}
                  <span class="sr-only">{{ mismatch ? 'tidak sama' : 'sama' }}</span>
                </td>
              </tr>
              <tr class="border-t border-gray-100">
                <th scope="row" class="py-2.5 text-left font-semibold text-gray-600">Pengirim</th>
                <td class="px-2 py-2.5">{{ current.order.customerName }}</td>
                <td class="py-2.5">{{ current.senderName }}, {{ current.senderBank }}</td>
              </tr>
            </tbody>
          </table>

          <div
            v-if="mismatch"
            role="alert"
            class="flex gap-2 rounded-control bg-danger-bg px-3 py-2.5 text-[13px] font-semibold text-danger-fg"
          >
            <XCircleIcon class="size-5 flex-none" aria-hidden="true" />Nominal tidak sama dengan
            total pesanan.
          </div>

          <div class="rounded-control bg-gray-50 p-3 text-[13px]/normal text-gray-700">
            <strong>Isi pesanan:</strong> {{ itemsText(current) }}<br />
            <strong>Reservasi berakhir:</strong> {{ formatDateTime(current.order.expiresAt) }}
          </div>

          <label class="flex min-h-11 cursor-pointer items-center gap-2.5 text-sm">
            <Checkbox v-model="fundsChecked" binary input-id="funds" />
            Dana sudah masuk di mutasi rekening
          </label>
        </div>
      </div>

      <div
        v-if="rejecting"
        class="mx-5 mb-4 flex flex-col gap-2.5 rounded-control border border-danger-line bg-[#FFFBFB] p-4"
      >
        <label for="reject-reason" class="text-sm font-extrabold"
          >Alasan penolakan <span class="text-danger-fg">(wajib, dilihat customer)</span></label
        >
        <div class="flex flex-wrap gap-1.5">
          <button
            v-for="r in QUICK_REASONS"
            :key="r"
            type="button"
            class="h-9 rounded-full border border-gray-300 bg-white px-3 text-xs font-bold hover:border-gray-400"
            @click="reason = r"
          >
            {{ r }}
          </button>
        </div>
        <Textarea
          id="reject-reason"
          v-model="reason"
          rows="2"
          auto-resize
          :invalid="reasonTooShort"
          aria-describedby="reject-hint"
          fluid
        />
        <span v-if="reasonTooShort" id="reject-hint" class="text-xs font-semibold text-danger-fg"
          >Tulis alasan minimal {{ REASON_MIN }} karakter supaya customer tahu apa yang harus
          diperbaiki.</span
        >
      </div>

      <div class="flex flex-wrap justify-end gap-2.5 border-t border-gray-100 px-5 py-3.5">
        <template v-if="!rejecting">
          <AppButton
            variant="secondary"
            size="lg"
            class="border-danger-600! text-danger-600!"
            label="Tolak"
            :disabled="busy"
            @click="startReject"
          />
          <AppButton
            size="lg"
            label="Terima pembayaran"
            :disabled="!fundsChecked"
            :loading="busy"
            @click="decide('accept')"
          />
        </template>
        <template v-else>
          <AppButton
            variant="secondary"
            size="lg"
            label="Batal"
            :disabled="busy"
            @click="rejecting = false"
          />
          <AppButton
            variant="danger"
            size="lg"
            label="Tolak dengan alasan"
            :disabled="reasonTooShort"
            :loading="busy"
            @click="decide('reject')"
          />
        </template>
      </div>
      <p
        v-if="!rejecting && !fundsChecked"
        class="-mt-1 px-5 pb-3.5 text-right text-xs text-gray-600"
      >
        Centang "Dana sudah masuk" setelah mengecek mutasi rekening toko.
      </p>
    </section>
  </div>
</template>
