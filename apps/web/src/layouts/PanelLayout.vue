<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { Bars3Icon } from '@heroicons/vue/24/outline'
import { useAuthStore } from '@/modules/auth'
import { OfflineBanner } from '@/shared/ui'
import AppSidebar from './parts/AppSidebar.vue'
import BrandLogo from './parts/BrandLogo.vue'

// Panel pegawai/owner. >= lg: sidebar tetap 248px. Tablet/ponsel: topbar + sidebar di Drawer.
const auth = useAuthStore()
const route = useRoute()
const router = useRouter()
// Route panel selalu ber-meta roles, jadi user pasti ada di sini; fallback hanya untuk /dev/layout/*
const role = computed(() =>
  auth.user?.role === 'OWNER' || (!auth.user && route.path.includes('owner')) ? 'OWNER' : 'STAFF',
)
const userName = computed(() => auth.user?.name ?? 'Pratinjau')

async function logout() {
  await auth.logout()
  await router.push('/masuk')
}

const menuOpen = ref(false)
watch(
  () => route.path,
  () => (menuOpen.value = false),
)
</script>

<template>
  <div class="min-h-screen bg-gray-100 lg:grid lg:grid-cols-[248px_minmax(0,1fr)]">
    <aside class="sticky top-0 hidden h-screen lg:block">
      <AppSidebar :role="role" :user-name="userName" @logout="logout" />
    </aside>

    <header class="flex h-16 items-center gap-2 border-b border-gray-200 bg-white px-3 lg:hidden">
      <button
        type="button"
        aria-label="Buka menu"
        class="flex size-11 items-center justify-center rounded-control text-gray-900"
        @click="menuOpen = true"
      >
        <Bars3Icon class="size-6" aria-hidden="true" />
      </button>
      <BrandLogo size="sm" />
      <span class="font-extrabold">Suwandi SB</span>
    </header>
    <Drawer
      v-model:visible="menuOpen"
      :show-close-icon="false"
      class="w-[280px]!"
      :pt="{
        root: { 'aria-label': 'Menu panel' },
        header: { class: 'hidden' },
        content: { class: 'p-0' },
      }"
    >
      <AppSidebar :role="role" :user-name="userName" @logout="logout" />
    </Drawer>

    <div class="min-w-0">
      <OfflineBanner />
      <main class="flex min-w-0 flex-col gap-6 px-4 pt-6 pb-12 md:px-8 md:pt-7">
        <slot />
      </main>
    </div>
  </div>
</template>
