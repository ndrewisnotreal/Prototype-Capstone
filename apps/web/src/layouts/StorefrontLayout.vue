<script setup lang="ts">
import { ChatWidget, useChatStore } from '@/modules/chatbot'
import { computed, watch } from 'vue'
import { useRoute } from 'vue-router'
import { ChatBubbleOvalLeftEllipsisIcon } from '@heroicons/vue/24/outline'
import { useCartStore } from '@/modules/account'
import { homeForRole, useAuthStore } from '@/modules/auth'
import { useStoreInfo } from '@/modules/storefront'
import { OfflineBanner } from '@/shared/ui'
import MobileTabBar from './parts/MobileTabBar.vue'
import MobileTopBar from './parts/MobileTopBar.vue'
import SiteFooter from './parts/SiteFooter.vue'
import SiteHeader from './parts/SiteHeader.vue'

// Desktop (>= lg): SiteHeader + tombol chat melayang. Mobile: MobileTopBar + MobileTabBar.
const route = useRoute()
const auth = useAuthStore()
const { info: storeInfo } = useStoreInfo()
const cart = useCartStore()
// Badge keranjang hanya untuk customer; gagal memuat cukup tanpa badge
watch(
  () => auth.user,
  (user) => (user?.role === 'CUSTOMER' ? void cart.load().catch(() => {}) : cart.reset()),
  { immediate: true },
)
const accountTo = computed(() =>
  !auth.user || auth.user.role === 'CUSTOMER' ? '/pesanan' : homeForRole(auth.user.role),
)
// Ponsel tidak punya AccountNav di samping halaman, jadi customer dibawa ke menu akun (/akun)
const mobileAccountTo = computed(() =>
  !auth.user || auth.user.role === 'CUSTOMER' ? '/akun' : homeForRole(auth.user.role),
)
// Keranjang hanya untuk customer; pegawai/owner yang melihat toko tidak diberi tombol yang berujung 403
const showCart = computed(() => !auth.user || auth.user.role === 'CUSTOMER')
const chat = useChatStore()
const openChat = () => chat.open()
</script>

<template>
  <div class="flex min-h-screen flex-col bg-gray-100">
    <SiteHeader
      class="hidden lg:block"
      :user="auth.user"
      :account-to="accountTo"
      :cart-count="cart.count"
      :show-cart="showCart"
    />
    <MobileTopBar
      class="lg:hidden"
      :title="route.meta.title"
      :back-to="route.meta.backTo"
      :show-cart="showCart"
    />
    <OfflineBanner />

    <main class="flex-1 pb-24 lg:pb-0">
      <slot />
    </main>

    <!-- ruang untuk bar bawah ponsel: tab bar (96px) atau bar aksi halaman detail (lebih tinggi) -->
    <SiteFooter
      :store="storeInfo"
      class="lg:pb-0"
      :class="route.meta.hideTabBar ? 'pb-40' : 'pb-24'"
    />

    <MobileTabBar
      v-if="!route.meta.hideTabBar"
      class="fixed inset-x-0 bottom-0 z-30 lg:hidden"
      :logged-in="!!auth.user"
      :cart-count="cart.count"
      :show-cart="showCart"
      :account-to="mobileAccountTo"
      @chat="openChat"
    />
    <button
      type="button"
      aria-label="Buka Asisten AI"
      v-show="!chat.isOpen"
      class="fixed right-6 bottom-6 z-30 hidden h-14 items-center gap-2.5 rounded-full bg-brand-600 pr-5 pl-4 text-[15px] font-bold text-white shadow-[0_12px_32px_rgb(47_75_65/0.30)] hover:bg-brand-700 lg:flex"
      @click="openChat"
    >
      <ChatBubbleOvalLeftEllipsisIcon class="size-6" aria-hidden="true" />Tanya Asisten
    </button>
    <ChatWidget />
  </div>
</template>
