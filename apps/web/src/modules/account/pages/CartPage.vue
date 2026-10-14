<script setup lang="ts">
import { computed, ref } from 'vue'
import { useRouter } from 'vue-router'
import { ExclamationTriangleIcon, PhotoIcon, TrashIcon } from '@heroicons/vue/24/outline'
import { CONDITION_LABELS, PRODUCT_STATUS_CUSTOMER_LABELS, type CartItemDto } from '@ssb/shared'
import { paymentDeadlineHours } from '@/modules/storefront'
import { useNotify, useRequest } from '@/shared/composables'
import { ApiRequestError, formatNumber, formatRupiah } from '@/shared/lib'
import { AppButton, EmptyState, OfflineState } from '@/shared/ui'
import { useCartStore } from '../stores/cart.store'

// Layar Keranjang. Keranjang tidak mereservasi: sepatu yang sudah dipesan orang lain ditandai dan tidak ikut total.
const cartStore = useCartStore()
const notify = useNotify()
const router = useRouter()
const request = useRequest(() => cartStore.load())

const cart = computed(() => cartStore.cart)
const goneCount = computed(() => cart.value?.items.filter((i) => !i.available).length ?? 0)
const name = (i: CartItemDto) => `${i.brand} ${i.model}`
const goneLabel = (i: CartItemDto) =>
  i.status === 'RESERVED' ? 'Sedang dipesan orang lain' : PRODUCT_STATUS_CUSTOMER_LABELS[i.status]

const removing = ref<number | null>(null)
async function remove(item: CartItemDto) {
  removing.value = item.productId
  try {
    await cartStore.remove(item.productId)
  } catch (e) {
    notify.error(e instanceof ApiRequestError ? e.message : 'Gagal menghapus. Coba lagi.')
  } finally {
    removing.value = null
  }
}
</script>

<template>
  <div class="mx-auto flex max-w-[1180px] flex-col gap-6 px-4 pt-5 pb-10 sm:px-6 lg:pt-9 lg:pb-20">
    <h1 class="hidden text-4xl font-extrabold tracking-tight lg:block">Keranjang</h1>

    <!-- Memuat -->
    <div
      v-if="request.loading.value && !cart"
      class="flex flex-wrap items-start gap-7"
      aria-busy="true"
    >
      <div class="flex min-w-0 flex-[999_1_560px] flex-col gap-3.5">
        <Skeleton v-for="n in 3" :key="n" height="138px" border-radius="16px" />
      </div>
      <Skeleton class="min-w-0 flex-[1_1_340px]" height="280px" border-radius="16px" />
    </div>

    <!-- Gagal -->
    <OfflineState
      v-else-if="request.errorCode.value === 'NETWORK_ERROR' && !cart"
      title="Keranjang belum bisa dimuat"
      description="Cek sinyal atau Wi-Fi kamu. Keranjangmu aman tersimpan, tidak ada yang hilang."
      contact
      @retry="request.run()"
    />
    <div
      v-else-if="request.error.value && !cart"
      role="alert"
      class="flex flex-col items-center gap-3 rounded-card border border-gray-200 bg-white px-6 py-14 text-center"
    >
      <p class="text-lg font-extrabold">Keranjang gagal dimuat</p>
      <p class="text-sm text-gray-600">{{ request.error.value }}</p>
      <AppButton variant="secondary" label="Coba lagi" @click="request.run()" />
    </div>

    <!-- Kosong -->
    <EmptyState
      v-else-if="cart && cart.items.length === 0"
      class="border border-gray-200 bg-white py-12"
      title="Keranjang masih kosong"
      description="Sepatu cepat laku. Simpan yang kamu suka sebelum diambil orang."
    >
      <RouterLink
        to="/katalog"
        class="inline-flex h-11 items-center rounded-control bg-brand-600 px-4.5 text-sm font-bold text-white hover:bg-brand-700"
        >Lihat Katalog</RouterLink
      >
    </EmptyState>

    <div v-else-if="cart" class="flex flex-wrap items-start gap-7">
      <section aria-label="Daftar sepatu" class="flex min-w-0 flex-[999_1_560px] flex-col gap-3.5">
        <div
          v-if="goneCount"
          role="alert"
          class="flex items-start gap-3 rounded-control bg-warning-bg px-4 py-3.5 text-sm/normal text-warning-fg"
        >
          <ExclamationTriangleIcon class="size-5 flex-none" aria-hidden="true" />
          <span
            ><strong>{{ goneCount }} sepatu sudah tidak bisa dibeli.</strong> Kami keluarkan dari
            total. Hapus dari keranjang atau tunggu sampai tersedia lagi.</span
          >
        </div>

        <article
          v-for="item in cart.items"
          :key="item.productId"
          class="flex flex-wrap items-center gap-4 rounded-card border bg-white p-4"
          :class="item.available ? 'border-gray-200' : 'border-warning-line'"
        >
          <RouterLink
            :to="`/sepatu/${item.code}`"
            :aria-label="`Lihat ${name(item)}`"
            class="size-20 flex-none sm:size-[104px] overflow-hidden rounded-control bg-photo"
            :class="!item.available && 'opacity-55'"
          >
            <img
              v-if="item.primaryPhotoUrl"
              :src="item.primaryPhotoUrl"
              :alt="name(item)"
              class="size-full object-cover"
            />
            <span v-else class="flex size-full items-center justify-center text-gray-600">
              <PhotoIcon class="size-8" aria-hidden="true" />
            </span>
          </RouterLink>
          <div class="flex min-w-0 flex-[1_1_160px] flex-col gap-1.5 sm:flex-[1_1_240px]">
            <span class="text-xs font-bold text-gray-600">{{ item.brand }}</span>
            <RouterLink
              :to="`/sepatu/${item.code}`"
              class="text-base font-bold text-gray-900 hover:text-brand-700"
              >{{ item.model }}</RouterLink
            >
            <span class="text-[13px] text-gray-600"
              >EU {{ formatNumber(item.sizeEu) }} · {{ CONDITION_LABELS[item.condition] }}</span
            >
            <span
              v-if="!item.available"
              class="self-start rounded-full bg-warning-bg px-2.5 py-1 text-xs font-bold text-warning-fg"
              >{{ goneLabel(item) }}</span
            >
          </div>
          <div class="ml-auto flex flex-col items-end gap-2">
            <span
              class="text-lg font-extrabold tabular-nums"
              :class="item.available ? 'text-gray-900' : 'text-gray-600 line-through'"
              >{{ formatRupiah(item.price) }}</span
            >
            <AppButton
              variant="ghost"
              class="text-danger-fg!"
              label="Hapus"
              :aria-label="`Hapus ${name(item)} dari keranjang`"
              :icon="TrashIcon"
              :loading="removing === item.productId"
              @click="remove(item)"
            />
          </div>
        </article>
      </section>

      <aside
        aria-labelledby="sum-h"
        class="flex min-w-0 flex-[1_1_340px] flex-col gap-3.5 rounded-card border border-gray-200 bg-white p-5.5 shadow-card"
      >
        <h2 id="sum-h" class="text-lg font-extrabold">Ringkasan</h2>
        <dl class="grid grid-cols-[1fr_auto] gap-2.5 text-sm">
          <dt class="text-gray-600">Sepatu bisa dibeli</dt>
          <dd class="font-bold">{{ cart.availableCount }}</dd>
          <dt class="text-gray-600">Subtotal</dt>
          <dd class="tabular-nums">{{ formatRupiah(cart.total) }}</dd>
          <dt class="text-gray-600">Ongkir</dt>
          <dd class="text-gray-600">Dihitung di checkout</dd>
        </dl>
        <div class="flex items-baseline justify-between border-t border-gray-200 pt-3.5">
          <span class="font-bold">Total</span>
          <span class="text-[26px] font-extrabold tabular-nums">{{
            formatRupiah(cart.total)
          }}</span>
        </div>
        <AppButton
          size="lg"
          class="font-extrabold"
          :label="`Checkout ${cart.availableCount} sepatu`"
          :disabled="cart.availableCount === 0"
          @click="router.push('/checkout')"
        />
        <p class="text-[13px]/normal text-gray-600">
          Sepatu direservasi untukmu selama {{ paymentDeadlineHours() }} jam setelah pesanan dibuat.
        </p>
      </aside>
    </div>
  </div>
</template>
