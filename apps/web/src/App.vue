<script setup lang="ts">
import { computed } from 'vue'
import { useRoute } from 'vue-router'
import AuthLayout from '@/layouts/AuthLayout.vue'
import BlankLayout from '@/layouts/BlankLayout.vue'
import PanelLayout from '@/layouts/PanelLayout.vue'
import StorefrontLayout from '@/layouts/StorefrontLayout.vue'

const LAYOUTS = {
  storefront: StorefrontLayout,
  panel: PanelLayout,
  auth: AuthLayout,
  blank: BlankLayout,
}
const route = useRoute()
const layout = computed(() => LAYOUTS[route.meta.layout ?? 'storefront'])
</script>

<template>
  <component :is="layout">
    <RouterView />
  </component>
  <Toast />
  <ConfirmDialog />
</template>
