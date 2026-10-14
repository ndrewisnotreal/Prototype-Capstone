<script setup lang="ts">
import { useChatStore } from '@/modules/chatbot'
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import {
  ChatBubbleOvalLeftEllipsisIcon,
  CheckIcon,
  ChevronRightIcon,
  ClockIcon,
  ExclamationTriangleIcon,
  InformationCircleIcon,
  XMarkIcon,
} from '@heroicons/vue/24/outline'
import { PRODUCT_STATUS_LABELS } from '@ssb/shared'
import { useCartStore } from '@/modules/account'
import { useAuthStore } from '@/modules/auth'
import { NotFoundPage } from '@/modules/system'
import { useNotify, useRequest } from '@/shared/composables'
import { ApiRequestError, formatDate, formatNumber, formatRupiah } from '@/shared/lib'
import { AppButton, ConditionBadge, ProductCard, ProductCardSkeleton } from '@/shared/ui'
import { productsApi } from '../api/products.api'
import { paymentDeadlineHours } from '../store-info'
import ProductGallery from '../components/ProductGallery.vue'

// Layar Produk (desktop) + M-Produk (ponsel). Status: tersedia, direservasi, terjual.
const route = useRoute()
const router = useRouter()
const auth = useAuthStore()
const notify = useNotify()

const code = computed(() => String(route.params.code))
const product = useRequest(() => productsApi.detail(code.value), { immediate: false })
const similar = useRequest(() => productsApi.similar(code.value), { immediate: false })
watch(
  code,
  () => {
    void product.run()
    void similar.run()
  },
  { immediate: true },
)

const p = computed(() => product.data.value)
const name = computed(() => (p.value ? `${p.value.brand} ${p.value.model}` : ''))
watch(name, (n) => n && (document.title = `${n} | Suwandi SecondBranded`))
onBeforeUnmount(() => (document.title = 'Suwandi SecondBranded'))

const sizes = computed(() =>
  p.value
    ? [
        { label: 'EU', value: formatNumber(p.value.sizeEu) },
        { label: 'UK', value: p.value.sizeUk === null ? '-' : formatNumber(p.value.sizeUk) },
        { label: 'US', value: p.value.sizeUs === null ? '-' : formatNumber(p.value.sizeUs) },
        {
          label: 'Insole',
          value: p.value.insoleCm === null ? '-' : formatNumber(p.value.insoleCm),
          unit: p.value.insoleCm === null ? '' : 'cm',
          accent: true,
        },
      ]
    : [],
)
const extras = computed(() =>
  p.value
    ? [
        {
          on: p.value.hasOriginalInsole,
          label: p.value.hasOriginalInsole ? 'Insole asli' : 'Insole bukan asli',
        },
        {
          on: p.value.hasOriginalLaces,
          label: p.value.hasOriginalLaces ? 'Tali asli' : 'Tali bukan asli',
        },
        { on: p.value.hasBox, label: p.value.hasBox ? 'Dengan box' : 'Tanpa box' },
      ]
    : [],
)
const STATUS_BADGE = {
  AVAILABLE: { icon: CheckIcon, class: 'bg-success-bg text-success-fg' },
  RESERVED: { icon: ClockIcon, class: 'bg-warning-bg text-warning-fg' },
  SOLD: { icon: null, class: 'bg-neutral-bg text-neutral-fg' },
  INACTIVE: { icon: null, class: 'bg-neutral-bg text-neutral-fg' },
}

const cart = useCartStore()
const adding = ref(false)
// "Beli Sekarang" = masuk keranjang lalu checkout sepatu ini saja
async function addToCart(buyNow: boolean) {
  if (!auth.user) {
    await router.push({ path: '/masuk', query: { redirect: route.fullPath } })
    return
  }
  // Keranjang dan checkout khusus customer (API menolak role lain)
  if (auth.user.role !== 'CUSTOMER') {
    notify.info('Kamu masuk sebagai pegawai/owner. Untuk membeli, pakai akun customer.')
    return
  }
  if (!p.value) return
  adding.value = true
  try {
    await cart.add(p.value.id)
    if (buyNow) await router.push({ path: '/checkout', query: { id: p.value.id } })
    else notify.success('Sepatu masuk keranjang.')
  } catch (e) {
    notify.error(
      e instanceof ApiRequestError ? e.message : 'Gagal menambah ke keranjang. Coba lagi.',
    )
    // 409: sepatu baru saja dipesan orang lain, muat ulang supaya statusnya terlihat
    if (e instanceof ApiRequestError && e.status === 409) void product.run()
  } finally {
    adding.value = false
  }
}
const chat = useChatStore()
const openChat = () => chat.open()
</script>

<template>
  <NotFoundPage v-if="product.errorCode.value === 'PRODUCT_NOT_FOUND'" />

  <div v-else class="mx-auto flex max-w-7xl flex-col gap-6 px-0 pb-44 sm:px-6 lg:pt-5 lg:pb-[72px]">
    <!-- Memuat -->
    <div
      v-if="product.loading.value && !p"
      class="grid gap-10 px-4 sm:px-0 lg:grid-cols-[minmax(0,1fr)_420px]"
      aria-busy="true"
    >
      <Skeleton class="aspect-square h-auto!" border-radius="16px" />
      <div class="flex flex-col gap-4">
        <Skeleton width="30%" height="16px" />
        <Skeleton width="80%" height="36px" />
        <Skeleton width="45%" height="36px" />
        <Skeleton height="80px" border-radius="16px" />
        <Skeleton height="140px" border-radius="16px" />
      </div>
    </div>

    <!-- Gagal (bukan 404) -->
    <div
      v-else-if="product.error.value"
      role="alert"
      class="mx-4 flex flex-col items-center gap-3 rounded-card border border-gray-200 bg-white px-6 py-14 text-center sm:mx-0"
    >
      <p class="text-lg font-extrabold">Detail sepatu belum bisa dimuat</p>
      <p class="text-[15px] text-gray-600">{{ product.error.value }}</p>
      <AppButton label="Coba lagi" @click="product.run" />
    </div>

    <template v-else-if="p">
      <nav
        aria-label="Breadcrumb"
        class="hidden flex-wrap items-center gap-2 text-[13px] text-gray-600 lg:flex"
      >
        <RouterLink to="/katalog" class="hover:text-brand-700">Katalog</RouterLink>
        <ChevronRightIcon class="size-3.5" aria-hidden="true" />
        <RouterLink
          :to="{ path: '/katalog', query: { category: p.category.slug } }"
          class="hover:text-brand-700"
          >{{ p.category.name }}</RouterLink
        >
        <ChevronRightIcon class="size-3.5" aria-hidden="true" />
        <span aria-current="page" class="font-semibold text-gray-900">{{ p.model }}</span>
      </nav>

      <div class="flex flex-col gap-5 lg:flex-row lg:items-start lg:gap-10">
        <ProductGallery
          :photos="p.photos"
          :name="name"
          :dimmed="p.status !== 'AVAILABLE'"
          class="lg:flex-[999_1_560px]"
        />

        <section
          aria-labelledby="p-h"
          class="flex min-w-0 flex-col gap-5 px-4 sm:px-0 lg:flex-[1_1_420px] lg:gap-[22px]"
        >
          <div class="flex flex-col gap-2 lg:gap-2.5">
            <RouterLink
              :to="{ path: '/katalog', query: { brand: p.brand } }"
              class="-my-3 inline-flex min-h-11 items-center self-start text-sm font-bold text-brand-700 hover:text-brand-900"
              >{{ p.brand }}</RouterLink
            >
            <h1
              id="p-h"
              class="text-2xl leading-[1.15] font-extrabold tracking-tight lg:text-[34px]"
            >
              {{ p.model }}
            </h1>
            <span class="hidden text-[13px] text-gray-600 lg:block"
              >Kode {{ p.code }} · masuk {{ formatDate(p.createdAt) }}</span
            >
          </div>

          <div class="flex flex-wrap items-center gap-3">
            <span
              class="text-[28px] font-extrabold tabular-nums lg:text-[34px]"
              :class="p.status === 'AVAILABLE' ? 'text-gray-900' : 'text-gray-600'"
              >{{ formatRupiah(p.price) }}</span
            >
            <span
              class="inline-flex items-center gap-[5px] rounded-full px-3 py-[5px] text-[13px] font-bold"
              :class="STATUS_BADGE[p.status].class"
            >
              <component
                :is="STATUS_BADGE[p.status].icon"
                v-if="STATUS_BADGE[p.status].icon"
                class="size-4"
                stroke-width="2"
                aria-hidden="true"
              />
              {{ PRODUCT_STATUS_LABELS[p.status].label }}
            </span>
            <ConditionBadge :condition="p.condition" />
            <span
              class="rounded-full bg-gray-200 px-2.5 py-1 text-xs font-bold text-gray-700 lg:hidden"
              >{{ p.code }}</span
            >
          </div>

          <dl class="grid grid-cols-4 overflow-hidden rounded-card border border-gray-200 bg-white">
            <div
              v-for="s in sizes"
              :key="s.label"
              class="p-3 lg:p-3.5 [&:not(:last-child)]:border-r [&:not(:last-child)]:border-gray-100"
              :class="s.accent && 'bg-accent-100'"
            >
              <dt
                class="text-xs font-semibold"
                :class="s.accent ? 'font-bold text-accent-700' : 'text-gray-600'"
              >
                {{ s.label }}
              </dt>
              <dd class="text-lg font-extrabold whitespace-nowrap lg:text-[22px]">
                {{ s.value
                }}<span v-if="s.unit" class="ml-0.5 text-sm font-bold">{{ s.unit }}</span>
              </dd>
            </div>
          </dl>

          <div class="flex flex-col gap-3 rounded-card border border-gray-200 bg-white px-5 py-4.5">
            <p class="flex items-center gap-2 font-extrabold">
              <ExclamationTriangleIcon class="size-5 text-warning-fg" aria-hidden="true" />Minus
              yang perlu kamu tahu
            </p>
            <ul
              v-if="p.defects.length"
              class="flex list-disc flex-col gap-1.5 pl-5 text-sm leading-relaxed text-gray-700"
            >
              <li v-for="d in p.defects" :key="d">{{ d }}</li>
            </ul>
            <p v-else class="text-sm text-gray-700">Tidak ada minus yang tercatat.</p>
            <div class="flex flex-wrap gap-2 border-t border-gray-100 pt-2.5">
              <span
                v-for="x in extras"
                :key="x.label"
                class="inline-flex items-center gap-1.5 rounded-full py-1 pr-[11px] pl-2 text-[13px] font-semibold"
                :class="x.on ? 'bg-success-bg text-success-fg' : 'bg-gray-100 text-gray-700'"
              >
                <component
                  :is="x.on ? CheckIcon : XMarkIcon"
                  class="size-4"
                  stroke-width="2"
                  aria-hidden="true"
                />{{ x.label }}
              </span>
            </div>
          </div>

          <!-- Aksi desktop; di ponsel aksi ada di bar bawah -->
          <template v-if="p.status === 'AVAILABLE'">
            <div class="hidden grid-cols-2 gap-3 lg:grid">
              <AppButton
                variant="secondary"
                size="lg"
                label="Tambah ke Keranjang"
                class="border-brand-600! px-3! whitespace-nowrap text-brand-700!"
                :loading="adding"
                @click="addToCart(false)"
              />
              <AppButton
                size="lg"
                label="Beli Sekarang"
                :loading="adding"
                @click="addToCart(true)"
              />
            </div>
            <p class="flex gap-2 text-[13px] leading-normal text-gray-600">
              <InformationCircleIcon class="size-5 shrink-0" aria-hidden="true" />
              Masuk keranjang belum mengunci sepatu. Sepatu baru direservasi untukmu saat checkout.
            </p>
          </template>
          <div
            v-else-if="p.status === 'RESERVED'"
            class="flex flex-col gap-2.5 rounded-card bg-warning-bg p-4 text-warning-fg"
            role="status"
          >
            <p class="font-extrabold">Sedang dipesan orang lain</p>
            <p class="text-sm leading-normal">
              Kalau pembayarannya tidak selesai dalam {{ paymentDeadlineHours() }} jam, sepatu ini
              kembali tersedia.
            </p>
            <AppButton size="lg" label="Sedang dipesan" disabled class="hidden! lg:inline-flex!" />
          </div>
          <div
            v-else
            class="flex flex-col gap-2 rounded-card bg-neutral-bg p-4 text-neutral-fg"
            role="status"
          >
            <p class="font-extrabold">Sepatu ini sudah terjual</p>
            <p class="text-sm leading-normal">
              Tiap pasang cuma ada satu. Lihat yang serupa di bawah, atau cari di katalog.
            </p>
          </div>

          <button
            type="button"
            class="inline-flex min-h-11 items-center gap-2 self-start text-sm font-bold text-brand-700"
            @click="openChat"
          >
            <ChatBubbleOvalLeftEllipsisIcon class="size-5" aria-hidden="true" />Tanya Asisten soal
            sepatu ini
          </button>

          <details v-if="p.description" open class="border-t border-gray-200 pt-4.5">
            <summary class="cursor-pointer text-[17px] font-extrabold">Deskripsi</summary>
            <p
              class="mt-2 max-w-[60ch] text-[15px] leading-[1.7] whitespace-pre-line text-gray-700"
            >
              {{ p.description }}
            </p>
          </details>
        </section>
      </div>

      <section
        v-if="similar.loading.value || similar.data.value?.length"
        aria-labelledby="rel-h"
        class="flex flex-col gap-5 px-4 pt-4 sm:px-0 lg:pt-8"
      >
        <h2 id="rel-h" class="text-xl font-extrabold lg:text-[26px]">
          Serupa<span class="hidden lg:inline"
            >, ukuran {{ formatNumber(p.sizeEu - 1) }} sampai {{ formatNumber(p.sizeEu + 1) }}</span
          >
        </h2>
        <div class="grid grid-cols-2 gap-3 sm:gap-5 lg:grid-cols-4">
          <template v-if="similar.loading.value">
            <ProductCardSkeleton v-for="i in 4" :key="i" />
          </template>
          <ProductCard v-for="s in similar.data.value ?? []" v-else :key="s.code" :product="s" />
        </div>
      </section>

      <!-- Bar aksi ponsel (M-Produk), menggantikan tab bar -->
      <div
        class="fixed inset-x-0 bottom-0 z-30 flex flex-col gap-2.5 border-t border-gray-200 bg-white px-4 pt-3 pb-[max(16px,env(safe-area-inset-bottom))] shadow-[0_-8px_24px_rgb(17_24_39/0.06)] lg:hidden"
      >
        <div class="flex items-baseline justify-between">
          <span class="text-[13px] text-gray-600">Harga</span>
          <span class="text-2xl font-extrabold tabular-nums">{{ formatRupiah(p.price) }}</span>
        </div>
        <div v-if="p.status === 'AVAILABLE'" class="grid grid-cols-2 gap-2.5">
          <AppButton
            variant="secondary"
            size="lg"
            label="+ Keranjang"
            aria-label="Tambah ke Keranjang"
            class="border-brand-600! text-brand-700!"
            :loading="adding"
            @click="addToCart(false)"
          />
          <AppButton size="lg" label="Beli Sekarang" :loading="adding" @click="addToCart(true)" />
        </div>
        <AppButton
          v-else
          size="lg"
          :label="p.status === 'RESERVED' ? 'Sedang dipesan' : 'Sudah terjual'"
          disabled
          class="w-full"
        />
      </div>
    </template>
  </div>
</template>
