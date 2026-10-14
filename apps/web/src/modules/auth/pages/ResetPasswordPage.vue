<script setup lang="ts">
import { computed, reactive, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { XCircleIcon } from '@heroicons/vue/24/outline'
import { ApiRequestError } from '@/shared/lib'
import { useNotify } from '@/shared/composables'
import { AppButton, FormField } from '@/shared/ui'
import { authApi } from '../api/auth.api'
import { passwordStrength, rules, validate } from '../validation'

const route = useRoute()
const router = useRouter()
const notify = useNotify()
const token = computed(() => (typeof route.query.token === 'string' ? route.query.token : ''))

const form = reactive({ password: '', confirm: '' })
const errors = reactive({ password: '', confirm: '' })
const alert = ref('')
const submitting = ref(false)
const strength = computed(() => passwordStrength(form.password))

async function submit() {
  alert.value = ''
  const ok = validate(
    form,
    {
      password: rules.password,
      confirm: (v) => (v === form.password ? '' : 'Password belum sama.'),
    },
    errors,
  )
  if (!ok) return
  submitting.value = true
  try {
    await authApi.resetPassword(token.value, form.password)
    notify.success('Password berhasil diubah. Silakan masuk.')
    await router.replace('/masuk')
  } catch (e) {
    alert.value = e instanceof ApiRequestError ? e.message : 'Gagal menyimpan. Coba lagi.'
  } finally {
    submitting.value = false
  }
}
</script>

<template>
  <div v-if="!token" class="flex flex-col items-start gap-4" role="alert">
    <h1 class="text-[28px] font-extrabold">Tautan tidak lengkap</h1>
    <p class="text-[15px] leading-relaxed text-gray-600">
      Buka tautan dari email persis seperti yang dikirim, atau minta tautan baru.
    </p>
    <AppButton label="Minta tautan baru" @click="router.push('/lupa-password')" />
  </div>

  <form v-else class="flex flex-col gap-4.5" novalidate @submit.prevent="submit">
    <div>
      <h1 class="text-3xl font-extrabold">Buat password baru</h1>
      <p class="mt-1.5 text-[15px] text-gray-600">
        Setelah disimpan, masuk dengan password baru ini.
      </p>
    </div>
    <div
      v-if="alert"
      role="alert"
      class="flex flex-wrap gap-2.5 rounded-control bg-danger-bg px-3.5 py-3 text-sm font-semibold text-danger-fg"
    >
      <XCircleIcon class="size-5 shrink-0" aria-hidden="true" />{{ alert }}
      <RouterLink to="/lupa-password" class="underline">Minta tautan baru</RouterLink>
    </div>
    <FormField v-slot="f" label="Password baru" :error="errors.password">
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
      <template v-if="form.password && !errors.password">
        <span aria-hidden="true" class="grid grid-cols-4 gap-1">
          <span
            v-for="i in 4"
            :key="i"
            class="h-1 rounded"
            :class="
              i <= strength.score
                ? strength.score >= 3
                  ? 'bg-brand-600'
                  : 'bg-accent-500'
                : 'bg-gray-200'
            "
          />
        </span>
        <span
          class="text-xs font-semibold"
          :class="strength.score >= 3 ? 'text-success-fg' : 'text-warning-fg'"
          aria-live="polite"
          >{{ strength.label }}</span
        >
      </template>
    </FormField>
    <FormField v-slot="f" label="Ulangi password" :error="errors.confirm">
      <Password
        v-model="form.confirm"
        :input-id="f.id"
        :invalid="f.invalid"
        :feedback="false"
        toggle-mask
        input-class="h-12"
        autocomplete="new-password"
        fluid
      />
    </FormField>
    <AppButton
      type="submit"
      size="lg"
      label="Simpan password"
      :loading="submitting"
      class="w-full"
    />
  </form>
</template>
