<script setup lang="ts">
import { computed, onBeforeUnmount, reactive, ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import {
  ArrowLeftIcon,
  CameraIcon,
  CheckIcon,
  DocumentTextIcon,
  PhotoIcon,
  XCircleIcon,
} from '@heroicons/vue/24/outline'
import { NotFoundPage } from '@/modules/system'
import { useRequest } from '@/shared/composables'
import { ApiRequestError, formatRupiah } from '@/shared/lib'
import { AppButton, CountdownTimer, FormField, UploadDropzone } from '@/shared/ui'
import { ordersApi } from '../api/orders.api'

// Layar UploadBukti: kosong → pratinjau → mengunggah → terkirim. Aturan file sama dengan backend (StorageService).
const MAX_BYTES = 5 * 1024 * 1024
const TYPES = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf']
const BANKS = ['BCA', 'Mandiri', 'BNI', 'BRI', 'BSI', 'DANA', 'OVO', 'GoPay', 'ShopeePay']

const route = useRoute()
const code = computed(() => String(route.params.code))
const request = useRequest(() => ordersApi.paymentInstructions(code.value), { immediate: false })
watch(code, () => void request.run(), { immediate: true })
const pay = computed(() => request.data.value)

const expired = ref(false)
const uploadable = computed(() => pay.value?.status === 'AWAITING_PAYMENT' && !expired.value)

// ---------- file ----------
const file = ref<File | null>(null)
const previewUrl = ref('')
const fileError = ref('')
const isPdf = computed(() => file.value?.type === 'application/pdf')
const fileSize = computed(() => {
  const kb = (file.value?.size ?? 0) / 1024
  return kb < 1024
    ? `${Math.max(1, Math.round(kb))} KB`
    : `${(kb / 1024).toLocaleString('id-ID', { maximumFractionDigits: 1 })} MB`
})
function pick(f: File) {
  fileError.value = ''
  if (!TYPES.includes(f.type)) {
    fileError.value = 'File harus foto (JPG, PNG, WEBP) atau PDF.'
    return
  }
  if (f.size > MAX_BYTES) {
    fileError.value = 'Ukuran file maksimal 5 MB.'
    return
  }
  clearFile()
  file.value = f
  previewUrl.value = isPdf.value ? '' : URL.createObjectURL(f)
}
function clearFile() {
  if (previewUrl.value) URL.revokeObjectURL(previewUrl.value)
  previewUrl.value = ''
  file.value = null
}
onBeforeUnmount(clearFile)

const galleryInput = ref<HTMLInputElement>()
const cameraInput = ref<HTMLInputElement>()
function onInput(e: Event) {
  const input = e.target as HTMLInputElement
  const f = input.files?.[0]
  input.value = ''
  if (f) pick(f)
}

// ---------- form ----------
const form = reactive({ senderName: '', senderBank: '', amount: null as number | null })
const errors = reactive({ senderName: '', senderBank: '', amount: '' })
watch(pay, (p) => p && form.amount === null && (form.amount = p.total), { immediate: true })

const alert = ref('')
const sending = ref(false)
const sent = ref(false)
async function submit() {
  alert.value = ''
  const name = form.senderName.trim()
  const bank = form.senderBank.trim()
  errors.senderName =
    name.length < 2 || name.length > 100 ? 'Nama pengirim 2 sampai 100 karakter' : ''
  errors.senderBank = bank.length < 2 || bank.length > 50 ? 'Pilih atau tulis bank asal' : ''
  errors.amount = !form.amount || form.amount < 1 ? 'Nominal wajib diisi' : ''
  if (!file.value || errors.senderName || errors.senderBank || errors.amount) return

  const data = new FormData()
  data.append('file', file.value)
  data.append('senderName', name)
  data.append('senderBank', bank)
  data.append('amount', String(form.amount))
  sending.value = true
  try {
    await ordersApi.submitProof(code.value, data)
    sent.value = true
    clearFile()
  } catch (e) {
    alert.value = e instanceof ApiRequestError ? e.message : 'Gagal mengunggah. Coba lagi.'
    // pesanan berubah di server (lewat batas / sudah diunggah): muat ulang supaya layar ikut berubah
    if (e instanceof ApiRequestError && e.status === 409) void request.run()
  } finally {
    sending.value = false
  }
}
</script>

<template>
  <NotFoundPage v-if="request.errorCode.value === 'ORDER_NOT_FOUND'" />

  <div
    v-else
    class="mx-auto flex max-w-[760px] flex-col gap-5 px-4 pt-4 pb-10 sm:px-6 lg:pt-9 lg:pb-20"
  >
    <RouterLink
      :to="`/pesanan/${code}/bayar`"
      class="inline-flex min-h-11 items-center gap-2 self-start text-sm font-bold text-brand-700"
    >
      <ArrowLeftIcon class="size-4.5" aria-hidden="true" />Instruksi pembayaran
    </RouterLink>

    <!-- Memuat -->
    <div v-if="request.loading.value && !pay" class="flex flex-col gap-4" aria-busy="true">
      <Skeleton width="60%" height="36px" />
      <Skeleton height="260px" border-radius="16px" />
    </div>

    <!-- Gagal -->
    <div
      v-else-if="request.error.value && !pay"
      role="alert"
      class="flex flex-col items-center gap-3 rounded-card border border-gray-200 bg-white px-6 py-14 text-center"
    >
      <p class="text-lg font-extrabold">Data pesanan gagal dimuat</p>
      <p class="text-sm text-gray-600">{{ request.error.value }}</p>
      <AppButton variant="secondary" label="Coba lagi" @click="request.run()" />
    </div>

    <!-- Terkirim -->
    <div
      v-else-if="sent"
      class="flex flex-col items-center gap-3.5 rounded-card border border-gray-200 bg-white px-7 py-10 text-center"
    >
      <span
        class="flex size-18 items-center justify-center rounded-full bg-success-bg text-success-fg"
      >
        <CheckIcon class="size-9 stroke-2" aria-hidden="true" />
      </span>
      <h1 class="text-[28px] font-extrabold">Bukti terkirim</h1>
      <p class="max-w-[44ch] text-[15px]/relaxed text-gray-600">
        Pegawai akan memeriksa pembayaranmu. Status pesanan sekarang
        <strong class="text-warning-fg">Menunggu Verifikasi</strong>. Kami kabari lewat halaman
        pesanan.
      </p>
      <div class="mt-1.5 flex flex-wrap justify-center gap-2.5">
        <RouterLink
          :to="`/pesanan/${code}`"
          class="inline-flex h-12 items-center rounded-control bg-brand-600 px-5 text-[15px] font-extrabold text-white hover:bg-brand-700"
          >Lihat status pesanan</RouterLink
        >
        <RouterLink
          to="/katalog"
          class="inline-flex h-12 items-center rounded-control border border-gray-300 bg-white px-5 text-[15px] font-bold text-gray-900 hover:bg-gray-50"
          >Lanjut belanja</RouterLink
        >
      </div>
    </div>

    <!-- Tidak bisa unggah: sudah diunggah, lewat batas, atau dibatalkan -->
    <div
      v-else-if="pay && !uploadable"
      class="flex flex-col items-center gap-3 rounded-card border border-gray-200 bg-white px-6 py-12 text-center"
    >
      <h1 class="text-2xl font-extrabold">
        {{
          pay.status === 'AWAITING_PAYMENT'
            ? 'Waktu unggah bukti sudah habis'
            : pay.status === 'CANCELLED'
              ? 'Pesanan dibatalkan'
              : 'Bukti transfer sudah kami terima'
        }}
      </h1>
      <p class="max-w-[46ch] text-[15px] text-gray-600">
        Pesanan ini tidak sedang menunggu bukti transfer. Cek statusnya di halaman pesanan.
      </p>
      <RouterLink
        :to="`/pesanan/${code}`"
        class="mt-1 inline-flex h-11 items-center rounded-control bg-brand-600 px-4.5 text-sm font-bold text-white hover:bg-brand-700"
        >Lihat detail pesanan</RouterLink
      >
    </div>

    <template v-else-if="pay">
      <div class="flex flex-col gap-1.5">
        <h1 class="text-2xl font-extrabold tracking-tight lg:text-[30px]">Upload bukti transfer</h1>
        <p class="text-[15px] text-gray-600">
          Pesanan <strong class="text-gray-900">{{ pay.code }}</strong
          >, total <strong class="text-gray-900">{{ formatRupiah(pay.total) }}</strong
          >. Sisa waktu
          <CountdownTimer
            :expires-at="pay.expiresAt"
            class="font-bold text-warning-fg"
            @expired="expired = true"
          />.
        </p>
      </div>

      <div
        v-if="pay.paymentStatus === 'REJECTED' && pay.lastRejectReason"
        class="flex gap-3 rounded-control bg-danger-bg px-4 py-3.5 text-sm/normal text-danger-fg"
      >
        <XCircleIcon class="size-5 flex-none" aria-hidden="true" />
        <span><strong>Bukti sebelumnya ditolak:</strong> {{ pay.lastRejectReason }}</span>
      </div>
      <div
        v-if="alert"
        role="alert"
        class="flex gap-3 rounded-control bg-danger-bg px-4 py-3.5 text-sm font-semibold text-danger-fg"
      >
        <XCircleIcon class="size-5 flex-none" aria-hidden="true" />{{ alert }}
      </div>

      <!-- Kosong -->
      <div
        v-if="!file"
        class="flex flex-col gap-3.5 rounded-card border border-gray-200 bg-white p-4 sm:p-5.5"
      >
        <UploadDropzone
          title="Tarik foto bukti ke sini"
          hint="Screenshot m-banking atau foto struk ATM. JPG, PNG, atau PDF, maksimal 5 MB."
          :accept="TYPES.join(',')"
          @select="pick"
        />
        <p v-if="fileError" role="alert" class="text-sm font-semibold text-danger-fg">
          {{ fileError }}
        </p>
        <div class="grid grid-cols-2 gap-3">
          <AppButton
            variant="secondary"
            size="lg"
            :icon="PhotoIcon"
            label="Pilih dari galeri"
            @click="galleryInput?.click()"
          />
          <AppButton
            variant="secondary"
            size="lg"
            :icon="CameraIcon"
            label="Buka kamera"
            @click="cameraInput?.click()"
          />
        </div>
        <input
          ref="galleryInput"
          type="file"
          class="sr-only"
          tabindex="-1"
          aria-hidden="true"
          :accept="TYPES.join(',')"
          @change="onInput"
        />
        <input
          ref="cameraInput"
          type="file"
          class="sr-only"
          tabindex="-1"
          aria-hidden="true"
          accept="image/*"
          capture="environment"
          @change="onInput"
        />
      </div>

      <!-- Pratinjau + data transfer -->
      <form
        v-else
        class="flex flex-wrap gap-5.5 rounded-card border border-gray-200 bg-white p-4 sm:p-5.5"
        novalidate
        @submit.prevent="submit"
      >
        <div class="flex flex-[1_1_220px] flex-col gap-2.5">
          <img
            v-if="previewUrl"
            :src="previewUrl"
            alt="Pratinjau bukti transfer"
            class="aspect-[3/4] w-full rounded-control bg-photo object-contain"
          />
          <div
            v-else
            role="img"
            :aria-label="`Bukti transfer PDF ${file.name}`"
            class="flex aspect-[3/4] flex-col items-center justify-center gap-2 rounded-control bg-photo p-3 text-center text-[13px] font-semibold break-all text-brand-700"
          >
            <DocumentTextIcon class="size-10" aria-hidden="true" />{{ file.name }}
          </div>
          <div class="flex items-center justify-between text-[13px]">
            <span class="text-gray-600">{{ fileSize }}</span>
            <AppButton
              variant="ghost"
              size="sm"
              class="underline"
              :label="isPdf ? 'Ganti file' : 'Ganti foto'"
              :disabled="sending"
              @click="clearFile"
            />
          </div>
        </div>

        <div class="flex flex-[1_1_280px] flex-col gap-4">
          <FormField
            v-slot="f"
            label="Nama pengirim di rekening"
            :error="errors.senderName"
            hint="Tulis persis seperti di bukti, supaya pegawai cepat mencocokkan."
          >
            <InputText v-model="form.senderName" v-bind="f.input" autocomplete="name" fluid />
          </FormField>
          <FormField
            v-slot="f"
            label="Bank atau e-wallet asal"
            :error="errors.senderBank"
            hint="Tidak ada di daftar? Ketik namanya."
          >
            <Select
              v-model="form.senderBank"
              :label-id="f.id"
              :invalid="f.invalid"
              :options="BANKS"
              editable
              placeholder="Pilih bank"
              fluid
            />
          </FormField>
          <FormField v-slot="f" label="Nominal yang ditransfer" :error="errors.amount">
            <InputNumber
              v-model="form.amount"
              :input-id="f.id"
              :invalid="f.invalid"
              mode="currency"
              currency="IDR"
              locale="id-ID"
              :min-fraction-digits="0"
              :max-fraction-digits="0"
              :min="0"
              fluid
            />
          </FormField>
          <AppButton
            type="submit"
            size="lg"
            class="font-extrabold"
            :label="sending ? 'Mengunggah' : 'Kirim bukti'"
            :loading="sending"
          />
        </div>
      </form>
    </template>
  </div>
</template>
