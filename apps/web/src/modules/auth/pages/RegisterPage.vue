<script setup lang="ts">
import { reactive, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { XCircleIcon } from '@heroicons/vue/24/outline'
import { ApiRequestError } from '@/shared/lib'
import { AppButton, FormField } from '@/shared/ui'
import AuthTabs from '../components/AuthTabs.vue'
import { landingFor } from '../access'
import { useAuthStore } from '../stores/auth.store'
import { rules, validate } from '../validation'

const auth = useAuthStore()
const route = useRoute()
const router = useRouter()

const form = reactive({ name: '', email: '', phone: '', password: '' })
const errors = reactive({ name: '', email: '', phone: '', password: '' })
const alert = ref('')
const submitting = ref(false)

async function submit() {
  alert.value = ''
  if (!validate(form, rules, errors)) return
  submitting.value = true
  try {
    const user = await auth.register({ ...form, phone: form.phone.replace(/[\s-]/g, '') })
    await router.replace(landingFor(user, route.query.redirect, (p) => router.resolve(p).meta))
  } catch (e) {
    if (e instanceof ApiRequestError && e.code === 'EMAIL_TAKEN') errors.email = e.message
    else alert.value = e instanceof ApiRequestError ? e.message : 'Gagal mendaftar. Coba lagi.'
  } finally {
    submitting.value = false
  }
}
</script>

<template>
  <div class="flex flex-col gap-6">
    <AuthTabs />
    <form class="flex flex-col gap-4" novalidate @submit.prevent="submit">
      <div>
        <h1 class="text-3xl font-extrabold">Buat akun</h1>
        <p class="mt-1.5 text-[15px] text-gray-600">Gratis, cuma butuh semenit.</p>
      </div>
      <div
        v-if="alert"
        role="alert"
        class="flex gap-2.5 rounded-control bg-danger-bg px-3.5 py-3 text-sm font-semibold text-danger-fg"
      >
        <XCircleIcon class="size-5 shrink-0" aria-hidden="true" />{{ alert }}
      </div>
      <FormField v-slot="f" label="Nama lengkap" :error="errors.name">
        <InputText v-model="form.name" v-bind="f.input" autocomplete="name" class="h-12" fluid />
      </FormField>
      <FormField v-slot="f" label="Email" :error="errors.email">
        <InputText
          v-model="form.email"
          v-bind="f.input"
          type="email"
          autocomplete="email"
          class="h-12"
          fluid
        />
      </FormField>
      <FormField v-slot="f" label="No. WhatsApp" :error="errors.phone">
        <InputText
          v-model="form.phone"
          v-bind="f.input"
          type="tel"
          autocomplete="tel"
          class="h-12"
          fluid
        />
      </FormField>
      <FormField v-slot="f" label="Password" :error="errors.password" hint="Minimal 8 karakter.">
        <Password
          v-model="form.password"
          :input-id="f.id"
          :invalid="f.invalid"
          :feedback="false"
          toggle-mask
          input-class="h-12"
          autocomplete="new-password"
          fluid
        />
      </FormField>
      <AppButton type="submit" size="lg" label="Daftar" :loading="submitting" class="w-full" />
      <p class="text-center text-xs leading-normal text-gray-600">
        Dengan mendaftar kamu setuju dengan syarat belanja dan kebijakan privasi toko.
      </p>
    </form>
  </div>
</template>
