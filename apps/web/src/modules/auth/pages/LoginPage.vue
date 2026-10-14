<script setup lang="ts">
import { reactive, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { XCircleIcon } from '@heroicons/vue/24/outline'
import { ApiRequestError } from '@/shared/lib'
import { AppButton, FormField } from '@/shared/ui'
import AuthTabs from '../components/AuthTabs.vue'
import { landingFor } from '../access'
import { useAuthStore } from '../stores/auth.store'
import { required, rules, validate } from '../validation'

const auth = useAuthStore()
const route = useRoute()
const router = useRouter()

const form = reactive({ email: '', password: '' })
const errors = reactive({ email: '', password: '' })
// Datang dari sesi yang berakhir (router/guards.ts): beri tahu kenapa harus masuk lagi
const alert = ref(
  route.query.sesi === 'habis' ? 'Sesi kamu sudah berakhir. Silakan masuk lagi.' : '',
)
const submitting = ref(false)

async function submit() {
  alert.value = ''
  if (!validate(form, { email: rules.email, password: required('Password') }, errors)) return
  submitting.value = true
  try {
    const user = await auth.login(form.email, form.password)
    await router.replace(landingFor(user, route.query.redirect, (p) => router.resolve(p).meta))
  } catch (e) {
    // INVALID_CREDENTIALS, ACCOUNT_INACTIVE, NETWORK_ERROR: pesan dari server sudah siap tampil
    alert.value = e instanceof ApiRequestError ? e.message : 'Gagal masuk. Coba lagi.'
  } finally {
    submitting.value = false
  }
}
</script>

<template>
  <div class="flex flex-col gap-6">
    <AuthTabs />
    <form class="flex flex-col gap-4.5" novalidate @submit.prevent="submit">
      <div>
        <h1 class="text-3xl font-extrabold">Masuk</h1>
        <p class="mt-1.5 text-[15px] text-gray-600">Selamat datang lagi.</p>
      </div>
      <div
        v-if="alert"
        role="alert"
        class="flex gap-2.5 rounded-control bg-danger-bg px-3.5 py-3 text-sm font-semibold text-danger-fg"
      >
        <XCircleIcon class="size-5 shrink-0" aria-hidden="true" />{{ alert }}
      </div>
      <FormField v-slot="f" label="Email" :error="errors.email">
        <InputText
          v-model="form.email"
          v-bind="f.input"
          :invalid="f.invalid || !!alert"
          type="email"
          autocomplete="email"
          class="h-12"
          fluid
        />
      </FormField>
      <div class="flex flex-col gap-2">
        <FormField v-slot="f" label="Password" :error="errors.password">
          <Password
            v-model="form.password"
            :input-id="f.id"
            :invalid="f.invalid || !!alert"
            :feedback="false"
            toggle-mask
            input-class="h-12"
            autocomplete="current-password"
            fluid
          />
        </FormField>
        <RouterLink
          to="/lupa-password"
          class="-my-3 inline-flex min-h-11 items-center self-end text-[13px] font-bold text-brand-700 hover:text-brand-900"
          >Lupa password?</RouterLink
        >
      </div>
      <AppButton type="submit" size="lg" label="Masuk" :loading="submitting" class="w-full" />
    </form>
  </div>
</template>
