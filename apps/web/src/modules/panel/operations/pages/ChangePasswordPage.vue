<script setup lang="ts">
import { reactive, ref } from 'vue'
import { rules, useAuthStore, validate } from '@/modules/auth'
import { useNotify } from '@/shared/composables'
import { ApiRequestError } from '@/shared/lib'
import { AppButton, FormField } from '@/shared/ui'
import { accountApi } from '../api/account.api'

// Ganti password pegawai/owner. Belum ada layar desain panel; kartu "Ganti password" diambil dari layar Profil.
const auth = useAuthStore()
const notify = useNotify()

const pw = reactive({ current: '', next: '', repeat: '' })
const errors = reactive({ current: '', next: '', repeat: '' })
const saving = ref(false)

async function submit() {
  const ok = validate(
    pw,
    {
      current: (v) => (v ? '' : 'Password sekarang wajib diisi'),
      next: rules.password,
      repeat: (v) => (v === pw.next ? '' : 'Password baru belum sama'),
    },
    errors,
  )
  if (!ok) return
  saving.value = true
  try {
    await accountApi.changePassword({ currentPassword: pw.current, newPassword: pw.next })
    Object.assign(pw, { current: '', next: '', repeat: '' })
    notify.success('Password diganti.')
  } catch (e) {
    if (e instanceof ApiRequestError && e.code === 'WRONG_PASSWORD') errors.current = e.message
    else
      notify.error(
        e instanceof ApiRequestError ? e.message : 'Gagal mengganti password. Coba lagi.',
      )
  } finally {
    saving.value = false
  }
}
</script>

<template>
  <header>
    <h1 class="text-[28px] font-extrabold tracking-tight">Ganti password</h1>
    <p class="mt-1 text-sm text-gray-600">{{ auth.user?.email }}</p>
  </header>

  <form
    aria-labelledby="pw-h"
    class="flex max-w-3xl flex-col gap-4 rounded-card border border-gray-200 bg-white p-4 sm:p-5.5"
    novalidate
    @submit.prevent="submit"
  >
    <h2 id="pw-h" class="sr-only">Ganti password</h2>
    <div class="grid gap-4 sm:grid-cols-[repeat(auto-fit,minmax(220px,1fr))]">
      <FormField v-slot="f" label="Password sekarang" :error="errors.current">
        <Password
          v-model="pw.current"
          :input-id="f.id"
          :invalid="f.invalid"
          :feedback="false"
          toggle-mask
          autocomplete="current-password"
          fluid
        />
      </FormField>
      <FormField v-slot="f" label="Password baru" :error="errors.next" hint="Minimal 8 karakter.">
        <Password
          v-model="pw.next"
          :input-id="f.id"
          :invalid="f.invalid"
          :feedback="false"
          toggle-mask
          autocomplete="new-password"
          fluid
        />
      </FormField>
      <FormField v-slot="f" label="Ulangi password baru" :error="errors.repeat">
        <Password
          v-model="pw.repeat"
          :input-id="f.id"
          :invalid="f.invalid"
          :feedback="false"
          toggle-mask
          autocomplete="new-password"
          fluid
        />
      </FormField>
    </div>
    <AppButton
      type="submit"
      class="self-start font-extrabold"
      label="Ganti password"
      :loading="saving"
    />
  </form>
</template>
