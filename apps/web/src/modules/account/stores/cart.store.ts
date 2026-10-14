import { defineStore } from 'pinia'
import { computed, shallowRef } from 'vue'
import type { CartDto } from '@ssb/shared'
import { cartApi } from '../api/cart.api'

// Keranjang customer yang sedang login. Dipakai halaman Keranjang, tombol di detail sepatu, dan badge di header.
export const useCartStore = defineStore('cart', () => {
  const cart = shallowRef<CartDto | null>(null)
  /** semua item, termasuk yang sudah tidak tersedia (tetap tampil di keranjang) */
  const count = computed(() => cart.value?.items.length ?? 0)

  async function load() {
    cart.value = await cartApi.get()
  }
  async function add(productId: number) {
    cart.value = await cartApi.add(productId)
  }
  async function remove(productId: number) {
    cart.value = await cartApi.remove(productId)
  }
  /** saat logout / ganti akun */
  function reset() {
    cart.value = null
  }

  return { cart, count, load, add, remove, reset }
})
