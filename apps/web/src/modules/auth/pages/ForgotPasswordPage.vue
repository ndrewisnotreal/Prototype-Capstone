<script setup lang="ts">
import { reactive, ref } from 'vue'
import { ArrowLeftIcon, EnvelopeIcon, XCircleIcon } from '@heroicons/vue/24/outline'
import { ApiRequestError } from '@/shared/lib'
import { AppButton, FormField } from '@/shared/ui'
import { authApi } from '../api/auth.api'
import { rules, validate } from '../validation'

const form = reactive({ email: '' })
const errors = reactive({ email: '' })
const alert = ref('')
const sentTo = ref('')
const submitting = ref(false)

async function submit() {
  alert.value = ''
  if (!validate(form, { email: rules.email }, errors)) return
  submitting.value = true
  try {
    await authApi.forgotPassword(form.email.trim())
    sentTo.value = form.email.trim()
  } catch (e) {
    alert.value = e instanceof ApiRequestError ? e.message : 'Gagal mengirim. Coba lagi.'
  } finally {
    submitting.value = false
  }
}
</script>

<template>
  <!-- Server selalu menjawab sukses (email tidak bisa ditebak), jadi layar "Cek emailmu" tampil untuk email apa pun -->
  <div v-if="sentTo" class="flex flex-col items-start gap-4" role="status">
    <span class="flex size-14 items-center justify-center rounded-card bg-brand-50 text-brand-600">
      <EnvelopeIcon class="size-7" aria-hidden="true" />
    </span>
    <h1 class="text-[28px] font-extrabold">Cek emailmu</h1>
    <p class="text-[15px] leading-relaxed text-gray-600">
      Tautan reset dikirim ke <strong class="text-gray-900">{{ sentTo }}</strong> dan berlaku 30
      menit. Cek folder spam kalau tidak ada.
    </p>
    <RouterLink
      to="/masuk"
      class="inline-flex min-h-11 items-center gap-2 text-sm font-bold text-brand-700"
    >
      <ArrowLeftIcon class="size-5" aria-hidden="true" />Kembali ke Masuk
    </RouterLink>
  </div>

  <form v-else class="flex flex-col gap-4.5" novalidate @submit.prevent="submit">
    <RouterLink
      to="/masuk"
      class="inline-flex min-h-11 items-center gap-2 self-start text-sm font-bold text-brand-700"
    >
      <ArrowLeftIcon class="size-5" aria-hidden="true" />Kembali ke Masuk
    </RouterLink>
    <div>
      <h1 class="text-3xl font-extrabold">Lupa password</h1>
      <p class="mt-1.5 text-[15px] leading-relaxed text-gray-600">
        Masukkan email akunmu. Kami kirim tautan untuk membuat password baru.
      </p>
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
        type="email"
        autocomplete="email"
        class="h-12"
        fluid
      />
    </FormField>
    <AppButton type="submit" size="lg" label="Kirim tautan" :loading="submitting" class="w-full" />
  </form>
</template>
