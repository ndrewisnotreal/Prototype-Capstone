<script setup lang="ts">
import { reactive, ref } from 'vue'
import { CheckCircleIcon, PlusIcon } from '@heroicons/vue/24/outline'
import type { AddressDto } from '@ssb/shared'
import { rules, useAuthStore, validate } from '@/modules/auth'
import { useConfirmAction, useNotify, useRequest } from '@/shared/composables'
import { ApiRequestError } from '@/shared/lib'
import { AppButton, FormField } from '@/shared/ui'
import { profileApi, type AddressInput } from '../api/profile.api'
import AccountNav from '../components/AccountNav.vue'

// Layar Profil: data diri, alamat pengiriman (dialog tambah/ubah), ganti password.
const auth = useAuthStore()
const notify = useNotify()
const confirm = useConfirmAction()
const errorMessage = (e: unknown, fallback: string) =>
  e instanceof ApiRequestError ? e.message : fallback

// ---------- data diri ----------
const profile = reactive({ name: auth.user?.name ?? '', phone: auth.user?.phone ?? '' })
const profileErrors = reactive({ name: '', phone: '' })
const savingProfile = ref(false)
const saved = ref(false)
async function saveProfile() {
  saved.value = false
  if (!validate(profile, { name: rules.name, phone: rules.phone }, profileErrors)) return
  savingProfile.value = true
  try {
    const { user } = await profileApi.update({
      name: profile.name.trim(),
      phone: profile.phone.replace(/[\s-]/g, ''),
    })
    auth.user = user // nama di header ikut berubah
    saved.value = true
  } catch (e) {
    notify.error(errorMessage(e, 'Gagal menyimpan profil. Coba lagi.'))
  } finally {
    savingProfile.value = false
  }
}

// ---------- alamat ----------
const addresses = useRequest(() => profileApi.addresses())
const dialogOpen = ref(false)
const editingId = ref<number | null>(null)
const addressForm = reactive<AddressInput>({ label: '', line: '', city: '', postalCode: '' })
const addressErrors = reactive({ label: '', line: '', city: '', postalCode: '' })
const savingAddress = ref(false)
const busyId = ref<number | null>(null)

function openAddress(a?: AddressDto) {
  editingId.value = a?.id ?? null
  Object.assign(addressForm, {
    label: a?.label ?? '',
    line: a?.line ?? '',
    city: a?.city ?? '',
    postalCode: a?.postalCode ?? '',
  })
  Object.assign(addressErrors, { label: '', line: '', city: '', postalCode: '' })
  dialogOpen.value = true
}
async function saveAddress() {
  const ok = validate(
    addressForm,
    {
      label: (v) => (v.trim().length < 2 ? 'Label minimal 2 karakter, mis. Rumah atau Kos' : ''),
      line: (v) => (v.trim().length < 10 ? 'Tulis alamat lengkap (jalan, nomor, kelurahan)' : ''),
      city: (v) => (v.trim().length < 2 ? 'Kota wajib diisi' : ''),
      postalCode: (v) => (/^\d{5}$/.test(v.trim()) ? '' : 'Kode pos harus 5 angka'),
    },
    addressErrors,
  )
  if (!ok) return
  savingAddress.value = true
  try {
    const data = {
      label: addressForm.label.trim(),
      line: addressForm.line.trim(),
      city: addressForm.city.trim(),
      postalCode: addressForm.postalCode.trim(),
    }
    addresses.data.value = editingId.value
      ? await profileApi.updateAddress(editingId.value, data)
      : await profileApi.createAddress(data)
    dialogOpen.value = false
    notify.success('Alamat disimpan.')
  } catch (e) {
    notify.error(errorMessage(e, 'Gagal menyimpan alamat. Coba lagi.'))
  } finally {
    savingAddress.value = false
  }
}
async function makePrimary(a: AddressDto) {
  busyId.value = a.id
  try {
    addresses.data.value = await profileApi.updateAddress(a.id, { isPrimary: true })
  } catch (e) {
    notify.error(errorMessage(e, 'Gagal mengubah alamat utama. Coba lagi.'))
  } finally {
    busyId.value = null
  }
}
async function removeAddress(a: AddressDto) {
  const ok = await confirm({
    title: 'Hapus alamat?',
    message: `Alamat "${a.label}" akan dihapus dari akunmu.`,
    acceptLabel: 'Ya, hapus',
    danger: true,
  })
  if (!ok) return
  busyId.value = a.id
  try {
    addresses.data.value = await profileApi.deleteAddress(a.id)
  } catch (e) {
    notify.error(errorMessage(e, 'Gagal menghapus alamat. Coba lagi.'))
  } finally {
    busyId.value = null
  }
}

// ---------- password ----------
const pw = reactive({ current: '', next: '', repeat: '' })
const pwErrors = reactive({ current: '', next: '', repeat: '' })
const savingPw = ref(false)
async function changePassword() {
  const ok = validate(
    pw,
    {
      current: (v) => (v ? '' : 'Password sekarang wajib diisi'),
      next: rules.password,
      repeat: (v) => (v === pw.next ? '' : 'Password baru belum sama'),
    },
    pwErrors,
  )
  if (!ok) return
  savingPw.value = true
  try {
    await profileApi.changePassword({ currentPassword: pw.current, newPassword: pw.next })
    Object.assign(pw, { current: '', next: '', repeat: '' })
    notify.success('Password diganti.')
  } catch (e) {
    if (e instanceof ApiRequestError && e.code === 'WRONG_PASSWORD') pwErrors.current = e.message
    else notify.error(errorMessage(e, 'Gagal mengganti password. Coba lagi.'))
  } finally {
    savingPw.value = false
  }
}
</script>

<template>
  <div
    class="mx-auto flex max-w-[1180px] flex-wrap items-start gap-7 px-4 pt-5 pb-10 sm:px-6 lg:pt-8 lg:pb-20"
  >
    <AccountNav class="hidden flex-[1_1_220px] lg:flex" />

    <div class="flex min-w-0 flex-[999_1_640px] flex-col gap-5">
      <h1 class="hidden text-[34px] font-extrabold tracking-tight lg:block">Profil dan alamat</h1>

      <form
        aria-labelledby="dd-h"
        class="flex flex-col gap-4 rounded-card border border-gray-200 bg-white p-4 sm:p-5.5"
        novalidate
        @submit.prevent="saveProfile"
      >
        <h2 id="dd-h" class="text-lg font-extrabold">Data diri</h2>
        <div class="grid gap-4 sm:grid-cols-[repeat(auto-fit,minmax(240px,1fr))]">
          <FormField v-slot="f" label="Nama lengkap" :error="profileErrors.name">
            <InputText v-model="profile.name" v-bind="f.input" autocomplete="name" fluid />
          </FormField>
          <FormField v-slot="f" label="No. WhatsApp" :error="profileErrors.phone">
            <InputText
              v-model="profile.phone"
              v-bind="f.input"
              type="tel"
              autocomplete="tel"
              fluid
            />
          </FormField>
          <FormField
            v-slot="f"
            label="Email"
            hint="Email dipakai untuk masuk dan tidak bisa diubah."
          >
            <InputText
              :model-value="auth.user?.email"
              v-bind="f.input"
              type="email"
              disabled
              fluid
            />
          </FormField>
        </div>
        <div class="flex flex-wrap items-center gap-3.5">
          <AppButton
            type="submit"
            class="font-extrabold"
            label="Simpan perubahan"
            :loading="savingProfile"
          />
          <span
            v-if="saved"
            role="status"
            class="inline-flex items-center gap-1.5 text-sm font-bold text-success-fg"
            ><CheckCircleIcon class="size-5" aria-hidden="true" />Tersimpan</span
          >
        </div>
      </form>

      <section
        aria-labelledby="al-h"
        class="flex flex-col gap-3.5 rounded-card border border-gray-200 bg-white p-4 sm:p-5.5"
      >
        <div class="flex flex-wrap items-center justify-between gap-2.5">
          <h2 id="al-h" class="text-lg font-extrabold">Alamat pengiriman</h2>
          <AppButton
            variant="secondary"
            :icon="PlusIcon"
            label="Tambah alamat"
            @click="openAddress()"
          />
        </div>

        <div
          v-if="addresses.loading.value && !addresses.data.value"
          class="grid gap-3 sm:grid-cols-2"
        >
          <Skeleton v-for="n in 2" :key="n" height="120px" border-radius="12px" />
        </div>
        <div
          v-else-if="addresses.error.value"
          role="alert"
          class="flex flex-wrap items-center gap-3 text-sm text-danger-fg"
        >
          {{ addresses.error.value }}
          <AppButton variant="secondary" size="sm" label="Coba lagi" @click="addresses.run()" />
        </div>
        <p v-else-if="addresses.data.value?.length === 0" class="text-sm text-gray-600">
          Belum ada alamat. Tambahkan alamat supaya pengiriman lebih cepat diproses.
        </p>
        <div v-else class="grid gap-3 sm:grid-cols-[repeat(auto-fit,minmax(260px,1fr))]">
          <div
            v-for="a in addresses.data.value ?? []"
            :key="a.id"
            class="flex flex-col gap-1.5 rounded-control p-4"
            :class="
              a.isPrimary ? 'border-2 border-brand-600 bg-brand-50/50' : 'border border-gray-200'
            "
          >
            <span class="flex items-center justify-between gap-2">
              <span class="font-extrabold">{{ a.label }}</span>
              <span
                v-if="a.isPrimary"
                class="rounded-full bg-brand-600 px-2.5 py-0.5 text-[11px] font-extrabold text-white"
                >Utama</span
              >
            </span>
            <span class="text-sm/normal text-gray-700"
              >{{ a.line }}, {{ a.city }} {{ a.postalCode }}</span
            >
            <span class="mt-1 flex flex-wrap gap-x-1">
              <AppButton
                variant="ghost"
                class="px-1!"
                label="Ubah"
                :aria-label="`Ubah alamat ${a.label}`"
                @click="openAddress(a)"
              />
              <template v-if="!a.isPrimary">
                <AppButton
                  variant="ghost"
                  class="px-1!"
                  label="Jadikan utama"
                  :aria-label="`Jadikan ${a.label} alamat utama`"
                  :loading="busyId === a.id"
                  @click="makePrimary(a)"
                />
                <AppButton
                  variant="ghost"
                  class="px-1! text-danger-fg!"
                  label="Hapus"
                  :aria-label="`Hapus alamat ${a.label}`"
                  :disabled="busyId === a.id"
                  @click="removeAddress(a)"
                />
              </template>
            </span>
          </div>
        </div>
      </section>

      <form
        aria-labelledby="pw-h"
        class="flex flex-col gap-4 rounded-card border border-gray-200 bg-white p-4 sm:p-5.5"
        novalidate
        @submit.prevent="changePassword"
      >
        <h2 id="pw-h" class="text-lg font-extrabold">Ganti password</h2>
        <div class="grid gap-4 sm:grid-cols-[repeat(auto-fit,minmax(220px,1fr))]">
          <FormField v-slot="f" label="Password sekarang" :error="pwErrors.current">
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
          <FormField
            v-slot="f"
            label="Password baru"
            :error="pwErrors.next"
            hint="Minimal 8 karakter."
          >
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
          <FormField v-slot="f" label="Ulangi password baru" :error="pwErrors.repeat">
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
          variant="secondary"
          class="self-start font-extrabold"
          label="Ganti password"
          :loading="savingPw"
        />
      </form>
    </div>

    <Dialog
      v-model:visible="dialogOpen"
      modal
      :header="editingId ? 'Ubah alamat' : 'Tambah alamat'"
      class="w-[min(520px,calc(100vw-32px))]"
    >
      <form id="address-form" class="flex flex-col gap-4" novalidate @submit.prevent="saveAddress">
        <FormField
          v-slot="f"
          label="Label"
          :error="addressErrors.label"
          hint="Mis. Rumah, Kos, Kantor."
        >
          <InputText v-model="addressForm.label" v-bind="f.input" fluid />
        </FormField>
        <FormField v-slot="f" label="Alamat lengkap" :error="addressErrors.line">
          <Textarea
            v-model="addressForm.line"
            v-bind="f.input"
            rows="3"
            auto-resize
            autocomplete="street-address"
            fluid
          />
        </FormField>
        <div class="grid grid-cols-2 gap-4">
          <FormField v-slot="f" label="Kota" :error="addressErrors.city">
            <InputText
              v-model="addressForm.city"
              v-bind="f.input"
              autocomplete="address-level2"
              fluid
            />
          </FormField>
          <FormField v-slot="f" label="Kode pos" :error="addressErrors.postalCode">
            <InputText
              v-model="addressForm.postalCode"
              v-bind="f.input"
              inputmode="numeric"
              maxlength="5"
              autocomplete="postal-code"
              fluid
            />
          </FormField>
        </div>
      </form>
      <template #footer>
        <AppButton variant="secondary" label="Batal" @click="dialogOpen = false" />
        <AppButton
          type="submit"
          form="address-form"
          label="Simpan alamat"
          :loading="savingAddress"
        />
      </template>
    </Dialog>
  </div>
</template>
