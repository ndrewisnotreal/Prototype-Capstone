<script setup lang="ts">
import { computed, reactive, ref, watch } from 'vue'
import {
  LockClosedIcon,
  PencilSquareIcon,
  PlusIcon,
  TrashIcon,
  XMarkIcon,
} from '@heroicons/vue/24/outline'
import {
  FULFILLMENT_LABELS,
  type FaqDto,
  type Fulfillment,
  type OwnerBankAccountDto,
} from '@ssb/shared'
import { rules } from '@/modules/auth'
import { useConfirmAction, useNotify, useRequest } from '@/shared/composables'
import { ApiRequestError } from '@/shared/lib'
import { AppButton, FormField } from '@/shared/ui'
import { ownerAdminApi, type StoreSettingsInput } from '../api/admin.api'

// Layar O-Pengaturan: rekening resmi (password owner), kontak, alamat + jam buka, batas bayar, cara ambil, FAQ chatbot.
const DEADLINES = [12, 24, 48]
const notify = useNotify()
const confirm = useConfirmAction()
const errorMessage = (e: unknown, fallback: string) => {
  if (!(e instanceof ApiRequestError)) return fallback
  const details = (e.details?.errors as string[] | undefined)?.join(' ')
  return details || e.message
}

// ---------- pengaturan (satu form, disimpan sekaligus) ----------
const settings = useRequest(() => ownerAdminApi.settings())
const form = reactive<StoreSettingsInput>({
  whatsapp: '',
  instagram: null,
  tiktok: null,
  address: '',
  openingHours: [],
  paymentDeadlineHours: 24,
  fulfillmentMethods: [],
})
const snapshot = ref('')
function reset() {
  const s = settings.data.value
  if (!s) return
  // field input saja: updatedAt tidak boleh ikut dikirim (api menolak field tak dikenal)
  const { whatsapp, instagram, tiktok, address, openingHours, paymentDeadlineHours } = s
  Object.assign(
    form,
    structuredClone({ whatsapp, instagram, tiktok, address, openingHours, paymentDeadlineHours }),
    { fulfillmentMethods: [...s.fulfillmentMethods] },
  )
  snapshot.value = JSON.stringify(form)
}
watch(() => settings.data.value, reset)
const dirty = computed(() => !!snapshot.value && JSON.stringify(form) !== snapshot.value)
const deadlines = computed(() =>
  [...new Set([...DEADLINES, form.paymentDeadlineHours])].sort((a, b) => a - b),
)

const errors = reactive({ whatsapp: '', address: '', methods: '' })
const saving = ref(false)
async function save() {
  errors.whatsapp = rules.phone(form.whatsapp)
  errors.address = form.address.trim().length < 10 ? 'Alamat toko minimal 10 karakter' : ''
  errors.methods = form.fulfillmentMethods.length ? '' : 'Aktifkan minimal satu cara ambil sepatu'
  if (errors.whatsapp || errors.address || errors.methods) return
  saving.value = true
  try {
    settings.data.value = await ownerAdminApi.saveSettings({
      ...form,
      openingHours: form.openingHours.filter((h) => h.days.trim() || h.hours.trim()),
    })
    notify.success('Pengaturan disimpan. Kanal resmi sudah memakai data baru.')
  } catch (e) {
    notify.error(errorMessage(e, 'Gagal menyimpan pengaturan.'))
  } finally {
    saving.value = false
  }
}
function toggleMethod(m: Fulfillment, on: boolean) {
  form.fulfillmentMethods = on
    ? [...new Set([...form.fulfillmentMethods, m])]
    : form.fulfillmentMethods.filter((x) => x !== m)
}

// ---------- rekening (dialog, wajib password owner) ----------
const banks = useRequest(() => ownerAdminApi.bankAccounts())
type BankMode = 'create' | 'edit' | 'delete'
const bankDialog = reactive({
  open: false,
  mode: 'create' as BankMode,
  id: 0,
  bankName: '',
  accountNumber: '',
  accountName: '',
  isActive: true,
  password: '',
  error: '',
})
const bankSaving = ref(false)
function openBank(mode: BankMode, b?: OwnerBankAccountDto) {
  Object.assign(bankDialog, {
    open: true,
    mode,
    id: b?.id ?? 0,
    bankName: b?.bankName ?? '',
    accountNumber: b?.accountNumber ?? '',
    accountName: b?.accountName ?? '',
    isActive: b?.isActive ?? true,
    password: '',
    error: '',
  })
}
async function submitBank() {
  bankDialog.error = bankDialog.password ? '' : 'Masukkan password owner untuk konfirmasi.'
  if (bankDialog.error) return
  const data = {
    bankName: bankDialog.bankName.trim(),
    accountNumber: bankDialog.accountNumber.trim(),
    accountName: bankDialog.accountName.trim(),
    isActive: bankDialog.isActive,
  }
  bankSaving.value = true
  try {
    banks.data.value =
      bankDialog.mode === 'create'
        ? await ownerAdminApi.createBankAccount(data, bankDialog.password)
        : bankDialog.mode === 'edit'
          ? await ownerAdminApi.updateBankAccount(bankDialog.id, data, bankDialog.password)
          : await ownerAdminApi.deleteBankAccount(bankDialog.id, bankDialog.password)
    bankDialog.open = false
    notify.success(
      {
        create: 'Rekening ditambahkan.',
        edit: 'Rekening diperbarui.',
        delete: 'Rekening dihapus.',
      }[bankDialog.mode],
    )
  } catch (e) {
    bankDialog.error = errorMessage(e, 'Gagal menyimpan rekening.')
  } finally {
    bankSaving.value = false
  }
}

// ---------- FAQ (disimpan per pertanyaan) ----------
const faqs = useRequest(() => ownerAdminApi.faqs())
type FaqDraft = Omit<FaqDto, 'id'> & { id: number | null }
const drafts = ref<FaqDraft[]>([])
watch(
  () => faqs.data.value,
  (list) => (drafts.value = structuredClone(list ?? [])),
)
const faqBusy = ref<number | null>(null)
function addFaq() {
  drafts.value.unshift({ id: null, question: '', answer: '', sortOrder: 0, isActive: true })
}
async function saveFaq(d: FaqDraft, index: number) {
  if (d.question.trim().length < 5 || d.answer.trim().length < 5) {
    notify.error('Pertanyaan dan jawaban minimal 5 karakter.')
    return
  }
  faqBusy.value = index
  const data = { question: d.question.trim(), answer: d.answer.trim(), isActive: d.isActive }
  try {
    faqs.data.value = d.id
      ? await ownerAdminApi.updateFaq(d.id, data)
      : await ownerAdminApi.createFaq(data)
    notify.success('FAQ disimpan.')
  } catch (e) {
    notify.error(errorMessage(e, 'Gagal menyimpan FAQ.'))
  } finally {
    faqBusy.value = null
  }
}
async function removeFaq(d: FaqDraft, index: number) {
  if (!d.id) {
    drafts.value.splice(index, 1)
    return
  }
  const ok = await confirm({
    title: 'Hapus FAQ?',
    message: `"${d.question}" tidak lagi dipakai asisten AI.`,
    acceptLabel: 'Ya, hapus',
    danger: true,
  })
  if (!ok) return
  faqBusy.value = index
  try {
    faqs.data.value = await ownerAdminApi.deleteFaq(d.id)
  } catch (e) {
    notify.error(errorMessage(e, 'Gagal menghapus FAQ.'))
  } finally {
    faqBusy.value = null
  }
}
</script>

<template>
  <header>
    <h1 class="text-[28px] font-extrabold tracking-tight">Pengaturan toko</h1>
    <p class="mt-1 max-w-[70ch] text-sm text-gray-600">
      Rekening, WhatsApp, dan alamat di sini langsung tampil di halaman Kanal Resmi dan instruksi
      pembayaran. Setiap perubahan tercatat di log.
    </p>
  </header>

  <!-- Rekening resmi -->
  <section
    aria-labelledby="rek-h"
    class="flex flex-col gap-3.5 rounded-card border border-gray-200 bg-white p-5"
  >
    <div class="flex flex-wrap items-center justify-between gap-2">
      <h2 id="rek-h" class="text-[17px] font-extrabold">Rekening resmi</h2>
      <AppButton
        variant="secondary"
        size="sm"
        :icon="PlusIcon"
        label="Tambah rekening"
        @click="openBank('create')"
      />
    </div>
    <Skeleton v-if="banks.loading.value && !banks.data.value" height="64px" border-radius="12px" />
    <p v-else-if="banks.error.value" role="alert" class="text-sm text-danger-fg">
      {{ banks.error.value }}
    </p>
    <p v-else-if="!banks.data.value?.length" class="text-sm text-gray-600">
      Belum ada rekening. Customer tidak akan melihat tujuan transfer sampai rekening ditambahkan.
    </p>
    <ul v-else class="flex flex-col gap-2.5">
      <li
        v-for="b in banks.data.value"
        :key="b.id"
        class="flex flex-wrap items-center gap-3 rounded-control border border-gray-200 px-4 py-3"
        :class="!b.isActive && 'opacity-60'"
      >
        <span class="flex min-w-0 flex-1 flex-col">
          <strong>{{ b.bankName }}</strong>
          <span class="text-sm tabular-nums">{{ b.accountNumber }}</span>
          <span class="text-xs text-gray-600">a.n. {{ b.accountName }}</span>
        </span>
        <span
          class="rounded-full px-2.5 py-0.5 text-xs font-bold"
          :class="b.isActive ? 'bg-success-bg text-success-fg' : 'bg-gray-100 text-gray-700'"
          >{{ b.isActive ? 'Tampil di kanal resmi' : 'Disembunyikan' }}</span
        >
        <AppButton
          variant="ghost"
          size="sm"
          :icon="PencilSquareIcon"
          label="Ubah"
          :aria-label="`Ubah rekening ${b.bankName}`"
          @click="openBank('edit', b)"
        />
        <AppButton
          variant="ghost"
          size="sm"
          class="text-danger-fg!"
          :icon="TrashIcon"
          label="Hapus"
          :aria-label="`Hapus rekening ${b.bankName}`"
          @click="openBank('delete', b)"
        />
      </li>
    </ul>
    <p
      class="flex items-center gap-2 rounded-control bg-gray-50 px-3.5 py-2.5 text-[13px] text-gray-700"
    >
      <LockClosedIcon class="size-4.5 flex-none" aria-hidden="true" />Mengubah rekening meminta
      konfirmasi password owner, supaya tidak bisa diganti diam-diam.
    </p>
  </section>

  <!-- Pengaturan -->
  <div
    v-if="settings.error.value && !settings.data.value"
    role="alert"
    class="flex flex-col items-start gap-2 rounded-card border border-gray-200 bg-white p-5 text-sm"
  >
    <span class="text-danger-fg">{{ settings.error.value }}</span>
    <AppButton variant="secondary" size="sm" label="Coba lagi" @click="settings.run()" />
  </div>
  <div v-else-if="!settings.data.value" class="grid gap-5 lg:grid-cols-3" aria-busy="true">
    <Skeleton v-for="n in 3" :key="n" height="240px" border-radius="16px" />
  </div>
  <form
    v-else
    id="settings-form"
    class="grid gap-5 lg:grid-cols-3"
    novalidate
    @submit.prevent="save"
  >
    <section
      aria-labelledby="wa-h"
      class="flex flex-col gap-3.5 rounded-card border border-gray-200 bg-white p-5"
    >
      <h2 id="wa-h" class="text-[17px] font-extrabold">Kontak resmi</h2>
      <FormField v-slot="f" label="WhatsApp resmi" :error="errors.whatsapp">
        <InputText v-model="form.whatsapp" v-bind="f.input" type="tel" fluid />
      </FormField>
      <FormField v-slot="f" label="Instagram" hint="Kosongkan bila tidak ada.">
        <InputText v-model="form.instagram" v-bind="f.input" placeholder="@akun_resmi" fluid />
      </FormField>
      <FormField v-slot="f" label="TikTok" hint="Kosongkan bila tidak ada.">
        <InputText v-model="form.tiktok" v-bind="f.input" placeholder="@akun_resmi" fluid />
      </FormField>
    </section>

    <section
      aria-labelledby="ad-h"
      class="flex flex-col gap-3.5 rounded-card border border-gray-200 bg-white p-5"
    >
      <h2 id="ad-h" class="text-[17px] font-extrabold">Alamat dan jam buka</h2>
      <FormField v-slot="f" label="Alamat toko" :error="errors.address">
        <Textarea v-model="form.address" v-bind="f.input" rows="2" fluid />
      </FormField>
      <fieldset class="flex flex-col gap-2">
        <legend class="mb-1 text-sm font-semibold">Jam buka</legend>
        <div
          v-for="(h, i) in form.openingHours"
          :key="i"
          class="grid grid-cols-[minmax(0,1fr)_6.5rem_auto] items-center gap-2"
        >
          <InputText
            v-model="h.days"
            :aria-label="`Hari baris ${i + 1}`"
            placeholder="Senin sampai Sabtu"
            class="min-w-0"
          />
          <InputText
            v-model="h.hours"
            :aria-label="`Jam baris ${i + 1}`"
            placeholder="10.00 - 21.00"
            class="min-w-0"
          />
          <AppButton
            variant="ghost"
            size="sm"
            class="w-9 px-0!"
            :icon="XMarkIcon"
            :aria-label="`Hapus baris jam ${i + 1}`"
            @click="form.openingHours.splice(i, 1)"
          />
        </div>
        <AppButton
          v-if="form.openingHours.length < 7"
          variant="ghost"
          size="sm"
          class="self-start"
          :icon="PlusIcon"
          label="Tambah baris"
          @click="form.openingHours.push({ days: '', hours: '' })"
        />
      </fieldset>
    </section>

    <section
      aria-labelledby="dl-h"
      class="flex flex-col gap-3.5 rounded-card border border-gray-200 bg-white p-5"
    >
      <h2 id="dl-h" class="text-[17px] font-extrabold">Batas waktu pembayaran</h2>
      <div role="radiogroup" aria-label="Batas waktu" class="grid grid-cols-3 gap-2">
        <button
          v-for="h in deadlines"
          :key="h"
          type="button"
          role="radio"
          :aria-checked="form.paymentDeadlineHours === h"
          class="h-12 rounded-control border-2 text-sm font-bold"
          :class="
            form.paymentDeadlineHours === h
              ? 'border-brand-600 bg-brand-50/50'
              : 'border-gray-200 bg-white'
          "
          @click="form.paymentDeadlineHours = h"
        >
          {{ h }} jam
        </button>
      </div>
      <span class="text-[13px] text-gray-600"
        >Lewat batas ini, pesanan batal otomatis dan sepatu kembali Tersedia.</span
      >
      <fieldset class="mt-1 flex flex-col gap-2 border-t border-gray-100 pt-3">
        <legend class="mb-1 text-sm font-semibold">Cara ambil sepatu</legend>
        <label
          v-for="m in ['PICKUP', 'SHIPPING'] as Fulfillment[]"
          :key="m"
          class="flex items-center gap-2.5 text-sm"
        >
          <Checkbox
            :model-value="form.fulfillmentMethods.includes(m)"
            binary
            :input-id="`method-${m}`"
            @update:model-value="(v: boolean) => toggleMethod(m, v)"
          />
          {{ FULFILLMENT_LABELS[m] }}
        </label>
        <span v-if="errors.methods" role="alert" class="text-xs font-semibold text-danger-fg">{{
          errors.methods
        }}</span>
      </fieldset>
    </section>
  </form>

  <!-- FAQ -->
  <section
    aria-labelledby="faq-h"
    class="flex flex-col gap-3 rounded-card border border-gray-200 bg-white p-5"
  >
    <div class="flex flex-wrap items-center justify-between gap-2">
      <div>
        <h2 id="faq-h" class="text-[17px] font-extrabold">FAQ chatbot</h2>
        <span class="text-[13px] text-gray-600"
          >Dipakai asisten AI, dan jadi menu cadangan saat AI tidak tersedia.</span
        >
      </div>
      <AppButton
        variant="secondary"
        size="sm"
        :icon="PlusIcon"
        label="Tambah FAQ"
        @click="addFaq"
      />
    </div>
    <Skeleton v-if="faqs.loading.value && !faqs.data.value" height="56px" border-radius="12px" />
    <p v-else-if="!drafts.length" class="text-sm text-gray-600">Belum ada FAQ.</p>
    <details
      v-for="(d, i) in drafts"
      :key="d.id ?? `baru-${i}`"
      class="rounded-control border border-gray-200 px-4 py-3"
      :open="d.id === null"
    >
      <summary class="min-h-8 cursor-pointer font-bold" :class="!d.isActive && 'text-gray-500'">
        {{ d.question || 'Pertanyaan baru'
        }}<span v-if="!d.isActive" class="ml-2 text-xs font-semibold">(disembunyikan)</span>
      </summary>
      <div class="mt-3 flex flex-col gap-3">
        <FormField v-slot="f" label="Pertanyaan">
          <InputText v-model="d.question" v-bind="f.input" fluid />
        </FormField>
        <FormField v-slot="f" label="Jawaban">
          <Textarea v-model="d.answer" v-bind="f.input" rows="2" fluid />
        </FormField>
        <div class="flex flex-wrap items-center gap-2.5">
          <label class="mr-auto flex items-center gap-2 text-sm">
            <ToggleSwitch v-model="d.isActive" :aria-label="`FAQ ${d.question} aktif`" />Dipakai
            chatbot
          </label>
          <AppButton
            variant="ghost"
            size="sm"
            class="text-danger-fg!"
            label="Hapus"
            :disabled="faqBusy === i"
            @click="removeFaq(d, i)"
          />
          <AppButton size="sm" label="Simpan FAQ" :loading="faqBusy === i" @click="saveFaq(d, i)" />
        </div>
      </div>
    </details>
  </section>

  <!-- Bar simpan pengaturan -->
  <div
    v-if="dirty"
    class="sticky bottom-4 z-20 flex flex-wrap items-center gap-3 rounded-card border border-gray-200 bg-white px-5 py-3 shadow-[0_12px_32px_rgb(17_24_39/0.12)]"
  >
    <span class="mr-auto text-sm font-bold">Ada perubahan belum disimpan</span>
    <AppButton variant="secondary" label="Batalkan" :disabled="saving" @click="reset" />
    <AppButton type="submit" form="settings-form" label="Simpan pengaturan" :loading="saving" />
  </div>

  <!-- Dialog rekening -->
  <Dialog
    v-model:visible="bankDialog.open"
    modal
    :header="
      { create: 'Tambah rekening', edit: 'Ubah rekening', delete: 'Hapus rekening' }[
        bankDialog.mode
      ]
    "
    class="w-[min(460px,calc(100vw-32px))]"
  >
    <form id="bank-form" class="flex flex-col gap-4" novalidate @submit.prevent="submitBank">
      <template v-if="bankDialog.mode !== 'delete'">
        <FormField v-slot="f" label="Bank atau e-wallet">
          <InputText v-model="bankDialog.bankName" v-bind="f.input" fluid />
        </FormField>
        <FormField v-slot="f" label="Nomor rekening">
          <InputText
            v-model="bankDialog.accountNumber"
            v-bind="f.input"
            inputmode="numeric"
            fluid
          />
        </FormField>
        <FormField v-slot="f" label="Atas nama">
          <InputText v-model="bankDialog.accountName" v-bind="f.input" fluid />
        </FormField>
        <label class="flex items-center gap-2.5 text-sm">
          <ToggleSwitch
            v-model="bankDialog.isActive"
            aria-label="Tampilkan di kanal resmi"
          />Tampilkan di kanal resmi dan instruksi bayar
        </label>
      </template>
      <p v-else class="text-sm">
        Rekening <strong>{{ bankDialog.bankName }} {{ bankDialog.accountNumber }}</strong> akan
        dihapus dari kanal resmi.
      </p>
      <FormField v-slot="f" label="Password owner" :error="bankDialog.error">
        <Password
          v-model="bankDialog.password"
          :input-id="f.id"
          :invalid="f.invalid"
          :feedback="false"
          toggle-mask
          autocomplete="current-password"
          fluid
        />
      </FormField>
    </form>
    <template #footer>
      <AppButton variant="secondary" label="Batal" @click="bankDialog.open = false" />
      <AppButton
        type="submit"
        form="bank-form"
        :variant="bankDialog.mode === 'delete' ? 'danger' : 'primary'"
        :label="bankDialog.mode === 'delete' ? 'Hapus rekening' : 'Simpan rekening'"
        :loading="bankSaving"
      />
    </template>
  </Dialog>
</template>
