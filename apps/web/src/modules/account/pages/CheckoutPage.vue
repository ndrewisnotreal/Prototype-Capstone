<script setup lang="ts">
import { computed, reactive, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import {
  CheckIcon,
  ChevronDownIcon,
  MapPinIcon,
  PhotoIcon,
  ShieldCheckIcon,
  XCircleIcon,
} from '@heroicons/vue/24/outline'
import {
  CONDITION_LABELS,
  FULFILLMENT_LABELS,
  type CartItemDto,
  type Fulfillment,
} from '@ssb/shared'
import { rules, useAuthStore, validate } from '@/modules/auth'
import { paymentDeadlineHours, useStoreInfo } from '@/modules/storefront'
import { useRequest } from '@/shared/composables'
import { ApiRequestError, formatNumber, formatRupiah } from '@/shared/lib'
import { AppButton, FormField } from '@/shared/ui'
import { ordersApi } from '../api/orders.api'
import { useCartStore } from '../stores/cart.store'

// Layar Checkout (desktop) + M-Checkout (ponsel). Bentrok 409: sepatu yang baru dipesan orang lain dicoret dan
// keluar dari total; customer mengecek lagi lalu menekan Buat Pesanan sekali lagi.
const route = useRoute()
const router = useRouter()
const auth = useAuthStore()
const cartStore = useCartStore()
const { info: store } = useStoreInfo()
const request = useRequest(() => cartStore.load())

// ?id=12 dari "Beli Sekarang": hanya sepatu itu. Tanpa query: semua sepatu keranjang yang masih tersedia.
const onlyId = computed(() => (route.query.id ? Number(route.query.id) : null))
const conflictIds = ref<number[]>([])
const items = computed(() =>
  (cartStore.cart?.items ?? []).filter(
    (i) =>
      (onlyId.value === null || i.productId === onlyId.value) &&
      (i.available || conflictIds.value.includes(i.productId)),
  ),
)
const buyable = computed(() => items.value.filter((i) => i.available))
const total = computed(() => buyable.value.reduce((sum, i) => sum + i.price, 0))
const conflictNames = computed(() =>
  items.value
    .filter((i) => conflictIds.value.includes(i.productId))
    .map((i) => `${i.brand} ${i.model}`)
    .join(', '),
)
const name = (i: CartItemDto) => `${i.brand} ${i.model}`

const METHOD_HINT: Record<Fulfillment, string> = {
  PICKUP: 'Gratis. Ambil di Medan setelah pesanan siap.',
  SHIPPING: 'Ongkir sesuai kebijakan toko. Nomor resi muncul di pesananmu.',
}
const methods = computed<Fulfillment[]>(() => store.value?.fulfillmentMethods ?? ['PICKUP'])

const form = reactive({
  recipientName: auth.user?.name ?? '',
  recipientPhone: auth.user?.phone ?? '',
  fulfillment: 'PICKUP' as Fulfillment,
  address: '',
  city: '',
  postalCode: '',
  agree: false,
})
const errors = reactive({
  recipientName: '',
  recipientPhone: '',
  address: '',
  city: '',
  postalCode: '',
})
// Metode yang dimatikan owner tidak bisa dipilih
watch(methods, (m) => !m.includes(form.fulfillment) && (form.fulfillment = m[0]), {
  immediate: true,
})
const shipping = computed(() => form.fulfillment === 'SHIPPING')

const alert = ref('')
const submitting = ref(false)
async function submit() {
  alert.value = ''
  const shipRules = shipping.value
    ? {
        address: (v: string) =>
          v.trim().length < 10 ? 'Tulis alamat lengkap (jalan, nomor, kelurahan)' : '',
        city: (v: string) => (v.trim().length < 2 ? 'Kota wajib diisi' : ''),
        postalCode: (v: string) => (/^\d{5}$/.test(v.trim()) ? '' : 'Kode pos harus 5 angka.'),
      }
    : { address: () => '', city: () => '', postalCode: () => '' }
  const ok = validate<keyof typeof errors>(
    form,
    { recipientName: rules.name, recipientPhone: rules.phone, ...shipRules },
    errors,
  )
  if (!ok || !form.agree || buyable.value.length === 0) return

  submitting.value = true
  try {
    const { order } = await ordersApi.checkout({
      productIds: buyable.value.map((i) => i.productId),
      fulfillment: form.fulfillment,
      recipientName: form.recipientName.trim(),
      recipientPhone: form.recipientPhone.replace(/[\s-]/g, ''),
      shippingAddress: shipping.value
        ? `${form.address.trim()}, ${form.city.trim()} ${form.postalCode.trim()}`
        : undefined,
      agree: true,
    })
    void cartStore.load().catch(() => {}) // sepatu yang dibeli sudah keluar dari keranjang di server
    // shortcut: halaman bayar dibuat di T-3.7
    await router.replace(`/pesanan/${order.code}/bayar`)
  } catch (e) {
    if (e instanceof ApiRequestError && e.code === 'PRODUCT_NOT_AVAILABLE') {
      const ids = (e.details?.unavailableProductIds as number[] | undefined) ?? []
      conflictIds.value = [...new Set([...conflictIds.value, ...ids])]
      await cartStore.load().catch(() => {})
      window.scrollTo({ top: 0, behavior: 'smooth' })
    } else {
      alert.value = e instanceof ApiRequestError ? e.message : 'Gagal membuat pesanan. Coba lagi.'
    }
  } finally {
    submitting.value = false
  }
}
</script>

<template>
  <div
    class="mx-auto flex max-w-[1180px] flex-col gap-3.5 px-4 pt-4 pb-10 sm:px-6 lg:gap-6 lg:pt-8 lg:pb-20"
  >
    <div class="hidden flex-wrap items-center justify-between gap-4 lg:flex">
      <h1 class="text-4xl font-extrabold tracking-tight">Checkout</h1>
      <ol aria-label="Tahap belanja" class="flex items-center gap-2.5 text-sm">
        <li class="flex items-center gap-2 font-bold text-success-fg">
          <span class="flex size-6.5 items-center justify-center rounded-full bg-success-bg">
            <CheckIcon class="size-3.5 stroke-[2.5]" aria-hidden="true" /> </span
          >Keranjang
        </li>
        <li aria-hidden="true" class="h-0.5 w-7 bg-brand-200"></li>
        <li aria-current="step" class="flex items-center gap-2 font-extrabold">
          <span
            class="flex size-6.5 items-center justify-center rounded-full bg-brand-600 text-xs text-white"
            >2</span
          >Checkout
        </li>
        <li aria-hidden="true" class="h-0.5 w-7 bg-gray-200"></li>
        <li class="flex items-center gap-2 font-semibold text-gray-600">
          <span
            class="flex size-6.5 items-center justify-center rounded-full border-2 border-gray-300 text-xs"
            >3</span
          >Bayar
        </li>
      </ol>
    </div>

    <!-- Memuat -->
    <div
      v-if="request.loading.value && !cartStore.cart"
      class="flex flex-col gap-4"
      aria-busy="true"
    >
      <Skeleton v-for="n in 3" :key="n" height="160px" border-radius="16px" />
    </div>

    <!-- Gagal -->
    <div
      v-else-if="request.error.value && !cartStore.cart"
      role="alert"
      class="flex flex-col items-center gap-3 rounded-card border border-gray-200 bg-white px-6 py-14 text-center"
    >
      <p class="text-lg font-extrabold">Data checkout gagal dimuat</p>
      <p class="text-sm text-gray-600">{{ request.error.value }}</p>
      <AppButton variant="secondary" label="Coba lagi" @click="request.run()" />
    </div>

    <!-- Tidak ada yang bisa dibeli -->
    <div
      v-else-if="items.length === 0"
      class="flex flex-col items-center gap-2.5 rounded-card border border-gray-200 bg-white px-6 py-12 text-center"
    >
      <p class="text-xl font-extrabold">Belum ada sepatu untuk di-checkout</p>
      <p class="text-[15px] text-gray-600">
        Tambahkan sepatu yang masih tersedia ke keranjang dulu.
      </p>
      <RouterLink
        to="/katalog"
        class="mt-1.5 inline-flex h-11 items-center rounded-control bg-brand-600 px-4.5 text-sm font-bold text-white hover:bg-brand-700"
        >Lihat Katalog</RouterLink
      >
    </div>

    <template v-else>
      <div
        v-if="conflictNames"
        role="alert"
        class="flex items-start gap-3 rounded-control bg-danger-bg p-4 text-[15px]/normal text-danger-fg"
      >
        <XCircleIcon class="size-5.5 flex-none" aria-hidden="true" />
        <span
          ><strong>Maaf, {{ conflictNames }} baru saja dipesan orang lain.</strong>
          {{
            buyable.length
              ? 'Sepatu itu kami keluarkan dari pesanan. Total sudah diperbarui, cek lagi sebelum lanjut.'
              : 'Tidak ada sepatu lain yang bisa dipesan. Cari sepatu lain di katalog, yuk.'
          }}</span
        >
      </div>
      <div
        v-if="alert"
        role="alert"
        class="flex items-start gap-3 rounded-control bg-danger-bg p-4 text-sm font-semibold text-danger-fg"
      >
        <XCircleIcon class="size-5 flex-none" aria-hidden="true" />{{ alert }}
      </div>

      <!-- Ringkasan ringkas ponsel (M-Checkout) -->
      <details class="group rounded-card border border-gray-200 bg-white px-4 py-3.5 lg:hidden">
        <summary
          class="flex min-h-8 cursor-pointer list-none items-center justify-between font-extrabold"
        >
          <span>{{ buyable.length }} sepatu</span>
          <span class="inline-flex items-center gap-1.5 tabular-nums"
            >{{ formatRupiah(total) }}
            <ChevronDownIcon
              class="size-4.5 transition-transform group-open:rotate-180"
              aria-hidden="true"
          /></span>
        </summary>
        <ul class="mt-3 flex flex-col gap-2.5">
          <li
            v-for="i in items"
            :key="i.productId"
            class="flex items-center gap-2.5"
            :class="!i.available && 'opacity-50'"
          >
            <img
              v-if="i.primaryPhotoUrl"
              :src="i.primaryPhotoUrl"
              :alt="name(i)"
              class="size-12 flex-none rounded-[10px] bg-photo object-cover"
            />
            <span
              v-else
              role="img"
              :aria-label="`Foto ${name(i)} belum ada`"
              class="size-12 flex-none rounded-[10px] bg-photo"
            ></span>
            <span class="flex-1 text-[13px] font-semibold"
              >{{ i.model }}, EU {{ formatNumber(i.sizeEu) }}</span
            >
            <span class="text-[13px] font-extrabold" :class="!i.available && 'line-through'">{{
              formatRupiah(i.price)
            }}</span>
          </li>
        </ul>
      </details>

      <div class="flex flex-wrap items-start gap-7">
        <form
          id="checkout-form"
          class="flex min-w-0 flex-[999_1_560px] flex-col gap-3.5 lg:gap-5"
          novalidate
          @submit.prevent="submit"
        >
          <fieldset
            class="flex flex-col gap-4 rounded-card border border-gray-200 bg-white p-4 lg:p-5.5"
          >
            <legend class="float-left mb-1 text-base font-extrabold lg:text-lg">
              Data penerima
            </legend>
            <div class="clear-both grid gap-4 sm:grid-cols-2">
              <FormField v-slot="f" label="Nama penerima" :error="errors.recipientName">
                <InputText
                  v-model="form.recipientName"
                  v-bind="f.input"
                  autocomplete="name"
                  class="h-12 lg:h-11"
                  fluid
                />
              </FormField>
              <FormField
                v-slot="f"
                label="No. WhatsApp"
                :error="errors.recipientPhone"
                hint="Pegawai menghubungi nomor ini kalau ada kendala."
              >
                <InputText
                  v-model="form.recipientPhone"
                  v-bind="f.input"
                  type="tel"
                  autocomplete="tel"
                  class="h-12 lg:h-11"
                  fluid
                />
              </FormField>
            </div>
          </fieldset>

          <fieldset
            class="flex flex-col gap-3 rounded-card border border-gray-200 bg-white p-4 lg:gap-4 lg:p-5.5"
          >
            <legend class="float-left mb-1 text-base font-extrabold lg:text-lg">
              Cara ambil sepatu
            </legend>
            <div class="clear-both grid gap-2.5 sm:grid-cols-2 lg:gap-3">
              <label
                v-for="m in methods"
                :key="m"
                class="flex cursor-pointer items-start gap-3 rounded-control border-2 p-3.5 lg:p-4"
                :class="
                  form.fulfillment === m
                    ? 'border-brand-600 bg-brand-50/50'
                    : 'border-gray-200 bg-white'
                "
              >
                <RadioButton
                  v-model="form.fulfillment"
                  :input-id="`m-${m}`"
                  name="fulfillment"
                  :value="m"
                  class="mt-0.5"
                />
                <span class="flex flex-col gap-1">
                  <span class="text-[15px] font-extrabold">{{ FULFILLMENT_LABELS[m] }}</span>
                  <span class="text-[13px]/snug text-gray-600">{{ METHOD_HINT[m] }}</span>
                </span>
              </label>
            </div>

            <div
              v-if="!shipping"
              class="flex gap-3 rounded-control bg-brand-50 px-4 py-3.5 text-sm/relaxed text-brand-900"
            >
              <MapPinIcon class="size-5.5 flex-none" aria-hidden="true" />
              <span
                ><strong>{{ store?.address }}</strong
                ><template v-for="h in store?.openingHours ?? []" :key="h.days"
                  ><br />{{ h.days }} {{ h.hours }}</template
                ><br />Datang setelah status pesanan jadi <strong>Siap Diambil</strong> dan
                tunjukkan kode pesanan.</span
              >
            </div>

            <div v-else class="grid gap-4 sm:grid-cols-2">
              <FormField
                v-slot="f"
                class="sm:col-span-2"
                label="Alamat lengkap"
                :error="errors.address"
              >
                <Textarea
                  v-model="form.address"
                  v-bind="f.input"
                  rows="3"
                  auto-resize
                  autocomplete="street-address"
                  fluid
                />
              </FormField>
              <FormField v-slot="f" label="Kota" :error="errors.city">
                <InputText
                  v-model="form.city"
                  v-bind="f.input"
                  autocomplete="address-level2"
                  class="h-12 lg:h-11"
                  fluid
                />
              </FormField>
              <FormField v-slot="f" label="Kode pos" :error="errors.postalCode">
                <InputText
                  v-model="form.postalCode"
                  v-bind="f.input"
                  inputmode="numeric"
                  autocomplete="postal-code"
                  maxlength="5"
                  class="h-12 lg:h-11"
                  fluid
                />
              </FormField>
              <p class="text-[13px]/normal text-gray-600 sm:col-span-2">
                Ongkir mengikuti kebijakan toko dan dikonfirmasi pegawai lewat WhatsApp sebelum
                dikirim.
              </p>
            </div>
          </fieldset>

          <section
            aria-labelledby="rek-h"
            class="flex flex-col gap-2.5 rounded-card border border-gray-200 bg-white p-4 lg:gap-3.5 lg:p-5.5"
          >
            <div class="flex items-center gap-2.5">
              <ShieldCheckIcon class="size-5.5 text-brand-600" aria-hidden="true" />
              <h2 id="rek-h" class="text-base font-extrabold lg:text-lg">Rekening resmi toko</h2>
            </div>
            <p class="text-[13px]/normal text-gray-600 lg:text-sm">
              Setelah pesanan dibuat, transfer ke salah satu rekening ini. Rekening lain di luar
              daftar ini bukan milik kami.
            </p>
            <ul class="grid gap-2.5 sm:grid-cols-2">
              <li
                v-for="b in store?.bankAccounts ?? []"
                :key="b.id"
                class="flex flex-col gap-0.5 rounded-control border border-gray-200 px-3.5 py-3"
              >
                <span class="font-extrabold">{{ b.bankName }}</span>
                <span class="text-sm tabular-nums">{{ b.accountNumber }}</span>
                <span class="text-xs text-gray-600">a.n. {{ b.accountName }}</span>
              </li>
            </ul>
          </section>

          <label
            class="flex cursor-pointer items-start gap-3 rounded-card border border-gray-200 bg-white p-4 text-[13px]/normal lg:text-sm/normal"
          >
            <Checkbox v-model="form.agree" binary input-id="agree" class="mt-0.5 flex-none" />
            <span
              >Saya paham sepatu bekas dijual apa adanya sesuai foto dan deskripsi, dan pesanan
              <strong>batal otomatis</strong> kalau bukti transfer tidak diunggah dalam
              {{ paymentDeadlineHours() }} jam.</span
            >
          </label>
        </form>

        <aside
          aria-labelledby="sum-h"
          class="hidden min-w-0 flex-[1_1_340px] flex-col gap-4 rounded-card border border-gray-200 bg-white p-5.5 shadow-card lg:flex"
        >
          <h2 id="sum-h" class="text-lg font-extrabold">Pesananmu</h2>
          <ul class="flex flex-col gap-3">
            <li
              v-for="i in items"
              :key="i.productId"
              class="flex items-center gap-3"
              :class="!i.available && 'opacity-50'"
            >
              <img
                v-if="i.primaryPhotoUrl"
                :src="i.primaryPhotoUrl"
                :alt="name(i)"
                class="size-15 flex-none rounded-control bg-photo object-cover"
              />
              <span
                v-else
                role="img"
                :aria-label="`Foto ${name(i)} belum ada`"
                class="flex size-15 flex-none items-center justify-center rounded-control bg-photo text-gray-600"
                ><PhotoIcon class="size-6" aria-hidden="true"
              /></span>
              <span class="flex min-w-0 flex-1 flex-col gap-0.5">
                <span class="text-sm font-bold">{{ i.model }}</span>
                <span class="text-xs text-gray-600">{{
                  i.available
                    ? `EU ${formatNumber(i.sizeEu)} · ${CONDITION_LABELS[i.condition]}`
                    : 'Baru saja dipesan orang lain'
                }}</span>
              </span>
              <span
                class="text-sm font-extrabold tabular-nums"
                :class="!i.available && 'line-through'"
                >{{ formatRupiah(i.price) }}</span
              >
            </li>
          </ul>
          <dl class="grid grid-cols-[1fr_auto] gap-2.5 border-t border-gray-200 pt-3.5 text-sm">
            <dt class="text-gray-600">Subtotal</dt>
            <dd class="tabular-nums">{{ formatRupiah(total) }}</dd>
            <dt class="text-gray-600">Ongkir</dt>
            <dd class="text-gray-600">{{ shipping ? 'Dikonfirmasi pegawai' : 'Gratis' }}</dd>
          </dl>
          <div class="flex items-baseline justify-between border-t border-gray-200 pt-3.5">
            <span class="font-bold">Total transfer</span>
            <span class="text-[26px] font-extrabold tabular-nums">{{ formatRupiah(total) }}</span>
          </div>
          <AppButton
            type="submit"
            form="checkout-form"
            size="lg"
            class="font-extrabold"
            label="Buat Pesanan"
            :disabled="!form.agree || buyable.length === 0"
            :loading="submitting"
          />
          <span v-if="!form.agree" class="text-center text-xs text-gray-600"
            >Centang persetujuan dulu untuk lanjut.</span
          >
        </aside>
      </div>

      <!-- Bar aksi ponsel (M-Checkout), menggantikan tab bar -->
      <div
        class="fixed inset-x-0 bottom-0 z-30 flex flex-col gap-1.5 border-t border-gray-200 bg-white px-4 pt-3 pb-[max(16px,env(safe-area-inset-bottom))] shadow-[0_-8px_24px_rgb(17_24_39/0.06)] lg:hidden"
      >
        <div class="flex items-center gap-3">
          <span class="flex flex-col">
            <span class="text-xs text-gray-600">Total transfer</span>
            <span class="text-xl font-extrabold tabular-nums">{{ formatRupiah(total) }}</span>
          </span>
          <AppButton
            type="submit"
            form="checkout-form"
            size="lg"
            class="flex-1 font-extrabold"
            label="Buat Pesanan"
            :disabled="!form.agree || buyable.length === 0"
            :loading="submitting"
          />
        </div>
        <span v-if="!form.agree" class="text-center text-xs text-gray-600"
          >Centang persetujuan dulu untuk lanjut.</span
        >
      </div>
    </template>
  </div>
</template>
