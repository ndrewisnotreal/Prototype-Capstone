<script setup lang="ts">
import { computed, reactive, ref, watch } from 'vue'
import type { PanelOrderDetailDto } from '@ssb/shared'
import { useConfirmAction, useNotify } from '@/shared/composables'
import { ApiRequestError, formatNumber, formatRupiah } from '@/shared/lib'
import { AppButton, FormField, StatusBadge } from '@/shared/ui'
import { panelOrdersApi } from '../api/orders.api'

// Detail pesanan di drawer (layar P-Pesanan): data customer + aksi sesuai status. Aksi memancarkan `changed` dengan detail terbaru.
const props = defineProps<{ order: PanelOrderDetailDto }>()
const emit = defineEmits<{ changed: [order: PanelOrderDetailDto]; stale: [] }>()

const COURIERS = ['JNE REG', 'J&T Express', 'SiCepat', 'POS Indonesia']
const REASON_MIN = 10 // sama dengan StaffReasonDto di api

const notify = useNotify()
const confirm = useConfirmAction()
const o = computed(() => props.order)
const shipping = computed(() => o.value.fulfillment === 'SHIPPING')
const can = computed(() => ({
  verify: o.value.status === 'AWAITING_VERIFICATION',
  ready: o.value.status === 'PROCESSING' && !shipping.value,
  ship: o.value.status === 'PROCESSING' && shipping.value,
  finish: ['READY_FOR_PICKUP', 'SHIPPED'].includes(o.value.status),
  cancel: ['AWAITING_PAYMENT', 'AWAITING_VERIFICATION', 'PROCESSING'].includes(o.value.status),
}))
const method = computed(() =>
  shipping.value
    ? `Dikirim${o.value.courier ? `, ${o.value.courier}` : ''}${o.value.trackingNumber ? `, resi ${o.value.trackingNumber}` : ''}`
    : 'Ambil di toko',
)

const ship = reactive({ courier: COURIERS[0]!, trackingNumber: '' })
const shipErrors = reactive({ courier: '', trackingNumber: '' })
const cancelReason = ref('')
const cancelError = ref('')
watch(
  () => o.value.code,
  () => {
    Object.assign(ship, { courier: COURIERS[0]!, trackingNumber: '' })
    Object.assign(shipErrors, { courier: '', trackingNumber: '' })
    cancelReason.value = ''
    cancelError.value = ''
  },
)

const busy = ref(false)
async function run(action: () => Promise<PanelOrderDetailDto>, success: string) {
  busy.value = true
  try {
    emit('changed', await action())
    notify.success(success)
  } catch (e) {
    notify.error(e instanceof ApiRequestError ? e.message : 'Gagal menyimpan. Coba lagi.')
    if (e instanceof ApiRequestError && e.status === 409) emit('stale')
  } finally {
    busy.value = false
  }
}

const markReady = () =>
  run(() => panelOrdersApi.ready(o.value.code), 'Pesanan ditandai siap diambil.')
const markDone = () => run(() => panelOrdersApi.complete(o.value.code), 'Pesanan selesai.')
function markShipped() {
  shipErrors.courier = ship.courier.trim().length < 2 ? 'Pilih atau tulis ekspedisi' : ''
  shipErrors.trackingNumber = /^[A-Za-z0-9-]{6,40}$/.test(ship.trackingNumber.trim())
    ? ''
    : 'Nomor resi 6 sampai 40 huruf/angka'
  if (shipErrors.courier || shipErrors.trackingNumber) return
  void run(
    () => panelOrdersApi.ship(o.value.code, ship.courier.trim(), ship.trackingNumber.trim()),
    'Resi disimpan, pesanan dikirim.',
  )
}
async function cancel() {
  cancelError.value =
    cancelReason.value.trim().length < REASON_MIN
      ? `Tulis alasan minimal ${REASON_MIN} karakter, customer akan membacanya.`
      : ''
  if (cancelError.value) return
  const ok = await confirm({
    title: `Batalkan ${o.value.code}?`,
    message:
      'Sepatu otomatis kembali Tersedia. Bila sudah dibayar, refund dilakukan manual di luar sistem.',
    acceptLabel: 'Ya, batalkan',
    danger: true,
  })
  if (ok)
    void run(
      () => panelOrdersApi.cancel(o.value.code, cancelReason.value.trim()),
      'Pesanan dibatalkan.',
    )
}
</script>

<template>
  <div class="flex flex-col">
    <div class="flex flex-wrap gap-1.5 border-b border-gray-100 pb-4">
      <StatusBadge type="order" :status="o.status" />
      <StatusBadge type="payment" :status="o.paymentStatus" />
    </div>

    <dl class="grid grid-cols-[auto_1fr] gap-x-3.5 gap-y-2 border-b border-gray-100 py-4 text-sm">
      <dt class="text-gray-600">Customer</dt>
      <dd class="font-semibold">{{ o.recipient.name }}</dd>
      <dt class="text-gray-600">WhatsApp</dt>
      <dd>{{ o.recipient.phone }}</dd>
      <template v-if="o.customer.name !== o.recipient.name">
        <dt class="text-gray-600">Akun</dt>
        <dd>{{ o.customer.name }}, {{ o.customer.email }}</dd>
      </template>
      <dt class="text-gray-600">Sepatu</dt>
      <dd class="leading-normal">
        <span v-for="i in o.items" :key="i.productCode" class="block"
          >{{ i.brand }} {{ i.model }}, EU {{ formatNumber(i.sizeEu) }}
          <span class="text-gray-600">({{ i.productCode }})</span></span
        >
      </dd>
      <dt class="text-gray-600">Metode</dt>
      <dd>{{ method }}</dd>
      <template v-if="o.shippingAddress">
        <dt class="text-gray-600">Alamat</dt>
        <dd class="leading-normal">{{ o.shippingAddress }}</dd>
      </template>
      <dt class="text-gray-600">Total</dt>
      <dd class="font-extrabold tabular-nums">{{ formatRupiah(o.total) }}</dd>
      <template v-if="o.cancelReason">
        <dt class="text-gray-600">Alasan batal</dt>
        <dd>{{ o.cancelReason }}</dd>
      </template>
    </dl>

    <div class="flex flex-col gap-3 pt-4">
      <RouterLink
        v-if="can.verify"
        :to="`/panel/verifikasi?kode=${o.code}`"
        class="flex h-12 items-center justify-center rounded-control bg-brand-600 font-extrabold text-white hover:bg-brand-700"
        >Periksa bukti transfer</RouterLink
      >
      <AppButton
        v-if="can.ready"
        size="lg"
        class="font-extrabold"
        label="Tandai Siap Diambil"
        :loading="busy"
        @click="markReady"
      />
      <form v-if="can.ship" class="flex flex-col gap-2.5" novalidate @submit.prevent="markShipped">
        <FormField v-slot="f" label="Ekspedisi" :error="shipErrors.courier">
          <Select
            v-model="ship.courier"
            :label-id="f.id"
            :invalid="f.invalid"
            :options="COURIERS"
            editable
            fluid
          />
        </FormField>
        <FormField v-slot="f" label="Nomor resi" :error="shipErrors.trackingNumber">
          <InputText
            v-model="ship.trackingNumber"
            v-bind="f.input"
            placeholder="Contoh: JX1234567890"
            fluid
          />
        </FormField>
        <AppButton
          type="submit"
          size="lg"
          class="font-extrabold"
          label="Simpan resi, tandai Dikirim"
          :loading="busy"
        />
      </form>
      <AppButton
        v-if="can.finish"
        size="lg"
        class="font-extrabold"
        label="Tandai Selesai"
        :loading="busy"
        @click="markDone"
      />
      <p
        v-if="!can.verify && !can.ready && !can.ship && !can.finish"
        class="text-[13px] text-gray-600"
      >
        {{
          o.status === 'AWAITING_PAYMENT'
            ? 'Menunggu customer membayar.'
            : 'Tidak ada aksi untuk status ini.'
        }}
      </p>
      <RouterLink
        v-if="o.paymentStatus === 'VERIFIED'"
        :to="`/pesanan/${o.code}/invoice`"
        class="text-center text-[13px] font-bold text-brand-700"
        >Lihat invoice</RouterLink
      >

      <details v-if="can.cancel" class="border-t border-gray-100 pt-2.5">
        <summary class="min-h-8 cursor-pointer text-[13px] font-bold text-danger-fg">
          Batalkan pesanan
        </summary>
        <div class="flex flex-col gap-2 pt-2">
          <FormField v-slot="f" label="Alasan pembatalan" :error="cancelError">
            <Textarea
              v-model="cancelReason"
              v-bind="f.input"
              rows="2"
              placeholder="Alasan pembatalan, wajib diisi"
              fluid
            />
          </FormField>
          <span class="text-xs text-gray-600">Sepatu otomatis kembali Tersedia.</span>
          <AppButton variant="danger" label="Batalkan pesanan" :loading="busy" @click="cancel" />
        </div>
      </details>
    </div>
  </div>
</template>
