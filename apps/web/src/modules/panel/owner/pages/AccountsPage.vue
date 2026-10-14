<script setup lang="ts">
import { reactive, ref, shallowRef, watch } from 'vue'
import { MagnifyingGlassIcon, UserPlusIcon } from '@heroicons/vue/24/outline'
import { ROLE_LABELS, type OwnerUserDto } from '@ssb/shared'
import { rules, validate } from '@/modules/auth'
import { useNotify } from '@/shared/composables'
import { ApiRequestError, formatDate, formatDateTime } from '@/shared/lib'
import { AppButton, AppDataTable, FormField } from '@/shared/ui'
import { ownerAdminApi } from '../api/admin.api'

// Layar O-Akun: tab pegawai/customer, aktif/nonaktif, reset password, undang pegawai baru.
type Tab = 'STAFF' | 'CUSTOMER'
const LIMIT = 20
const notify = useNotify()
const errorMessage = (e: unknown, fallback: string) =>
  e instanceof ApiRequestError ? e.message : fallback

const tab = ref<Tab>('STAFF')
const search = ref('')
const query = ref('')
const page = ref(1)
const rows = shallowRef<OwnerUserDto[]>([])
const total = ref(0)
const loading = ref(true)
const error = ref('')
let requestId = 0
async function load() {
  const id = ++requestId
  loading.value = true
  error.value = ''
  try {
    const res = await ownerAdminApi.users({
      role: tab.value,
      q: query.value,
      page: page.value,
      limit: LIMIT,
    })
    if (id !== requestId) return
    rows.value = res.data
    total.value = res.meta.total
  } catch (e) {
    if (id === requestId) error.value = errorMessage(e, 'Gagal memuat akun.')
  } finally {
    if (id === requestId) loading.value = false
  }
}
watch([tab, query], () => {
  page.value = 1
  void load()
})
watch(page, () => void load(), { immediate: true })
let timer: ReturnType<typeof setTimeout> | undefined
watch(search, (v) => {
  clearTimeout(timer)
  timer = setTimeout(() => (query.value = v.trim()), 300)
})

const busyId = ref<number | null>(null)
async function toggleActive(u: OwnerUserDto, isActive: boolean) {
  busyId.value = u.id
  try {
    await ownerAdminApi.setActive(u.id, isActive)
    rows.value = rows.value.map((r) => (r.id === u.id ? { ...r, isActive } : r))
    notify.success(
      isActive ? `${u.name} diaktifkan.` : `${u.name} dinonaktifkan, tidak bisa masuk lagi.`,
    )
  } catch (e) {
    notify.error(errorMessage(e, 'Gagal mengubah status akun.'))
  } finally {
    busyId.value = null
  }
}
async function sendReset(u: OwnerUserDto) {
  busyId.value = u.id
  try {
    await ownerAdminApi.sendReset(u.id)
    notify.success(`Tautan reset password dikirim ke ${u.email}.`)
  } catch (e) {
    notify.error(errorMessage(e, 'Gagal mengirim tautan reset.'))
  } finally {
    busyId.value = null
  }
}

// ---------- undang pegawai ----------
const inviteOpen = ref(false)
const invite = reactive({ name: '', email: '', phone: '' })
const inviteErrors = reactive({ name: '', email: '', phone: '' })
const inviting = ref(false)
function openInvite() {
  Object.assign(invite, { name: '', email: '', phone: '' })
  Object.assign(inviteErrors, { name: '', email: '', phone: '' })
  inviteOpen.value = true
}
async function sendInvite() {
  if (!validate(invite, { name: rules.name, email: rules.email, phone: rules.phone }, inviteErrors))
    return
  inviting.value = true
  try {
    const staff = await ownerAdminApi.createStaff({
      name: invite.name.trim(),
      email: invite.email.trim(),
      phone: invite.phone.replace(/[\s-]/g, ''),
    })
    inviteOpen.value = false
    notify.success(`Undangan dikirim ke ${staff.email}.`)
    tab.value = 'STAFF'
    void load()
  } catch (e) {
    if (e instanceof ApiRequestError && e.code === 'EMAIL_TAKEN') inviteErrors.email = e.message
    else if (e instanceof ApiRequestError && e.code === 'INVITE_MAIL_FAILED') {
      // akun sudah dibuat: tutup dialog dan tampilkan di daftar supaya bisa dikirim ulang
      inviteOpen.value = false
      notify.error(e.message)
      tab.value = 'STAFF'
      void load()
    } else notify.error(errorMessage(e, 'Gagal mengirim undangan.'))
  } finally {
    inviting.value = false
  }
}

const initials = (name: string) =>
  name
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase())
    .join('')
</script>

<template>
  <header class="flex flex-wrap items-center justify-between gap-3">
    <h1 class="text-[28px] font-extrabold tracking-tight">Manajemen akun</h1>
    <AppButton :icon="UserPlusIcon" label="Tambah pegawai" @click="openInvite" />
  </header>

  <div class="flex flex-wrap items-center justify-between gap-3">
    <div role="tablist" aria-label="Jenis akun" class="flex gap-1 rounded-control bg-gray-200 p-1">
      <button
        v-for="t in [
          { value: 'STAFF' as Tab, label: 'Pegawai' },
          { value: 'CUSTOMER' as Tab, label: 'Customer' },
        ]"
        :key="t.value"
        type="button"
        role="tab"
        :aria-selected="tab === t.value"
        class="h-9 rounded-[10px] px-4 text-[13px] text-gray-900"
        :class="
          tab === t.value
            ? 'bg-white font-extrabold shadow-[0_1px_3px_rgb(17_24_39/0.12)]'
            : 'font-semibold'
        "
        @click="tab = t.value"
      >
        {{ t.label }}
      </button>
    </div>
    <label
      class="focus-within:outline-3 focus-within:outline-offset-2 focus-within:outline-brand-600/45 flex h-11 w-[300px] max-w-full items-center gap-2 rounded-control border border-gray-200 bg-white px-3 text-gray-600 focus-within:border-brand-600"
    >
      <MagnifyingGlassIcon class="size-5" aria-hidden="true" />
      <span class="sr-only">Cari akun</span>
      <input
        v-model="search"
        type="search"
        placeholder="Nama, email, atau nomor HP"
        class="min-w-0 flex-1 bg-transparent text-sm text-gray-900 outline-none"
      />
    </label>
  </div>

  <AppDataTable
    v-model:page="page"
    :rows="rows"
    :total="total"
    :limit="LIMIT"
    :loading="loading"
    :error="error"
    noun="akun"
    :empty-title="tab === 'STAFF' ? 'Belum ada pegawai' : 'Belum ada customer'"
    :empty-text="query ? 'Coba kata kunci lain.' : undefined"
    @retry="load"
  >
    <Column header="Nama" :pt="{ headerCell: { class: 'pl-5' }, bodyCell: { class: 'pl-5' } }">
      <template #body="{ data }: { data: OwnerUserDto }">
        <span class="flex items-center gap-2.5" :class="!data.isActive && 'opacity-60'">
          <span
            aria-hidden="true"
            class="flex size-9 flex-none items-center justify-center rounded-full bg-brand-100 text-xs font-extrabold text-brand-700"
            >{{ initials(data.name) }}</span
          >
          <strong>{{ data.name }}</strong>
        </span>
      </template>
    </Column>
    <Column v-if="tab === 'STAFF'" header="Kontak">
      <template #body="{ data }: { data: OwnerUserDto }"
        ><span class="text-[13px] text-gray-700"
          >{{ data.email }}<br />{{ data.phone ?? '-' }}</span
        ></template
      >
    </Column>
    <Column v-if="tab === 'STAFF'" header="Role">
      <template #body="{ data }: { data: OwnerUserDto }">{{ ROLE_LABELS[data.role] }}</template>
    </Column>
    <Column v-if="tab === 'CUSTOMER'" field="email" header="Email" />
    <Column v-if="tab === 'CUSTOMER'" header="No. HP">
      <template #body="{ data }: { data: OwnerUserDto }">{{ data.phone ?? '-' }}</template>
    </Column>
    <Column v-if="tab === 'CUSTOMER'" header="Daftar">
      <template #body="{ data }: { data: OwnerUserDto }">{{ formatDate(data.createdAt) }}</template>
    </Column>
    <Column v-if="tab === 'CUSTOMER'" header="Pesanan">
      <template #body="{ data }: { data: OwnerUserDto }"
        ><span class="tabular-nums">{{ data.orderCount }}</span></template
      >
    </Column>
    <Column header="Status">
      <template #body="{ data }: { data: OwnerUserDto }">
        <span v-if="data.role === 'OWNER'" class="text-[13px] font-semibold text-gray-600"
          >Aktif</span
        >
        <label v-else class="flex items-center gap-2 text-[13px] font-semibold">
          <ToggleSwitch
            :model-value="data.isActive"
            :disabled="busyId === data.id"
            :aria-label="`Akun ${data.name} aktif`"
            @update:model-value="(v: boolean) => toggleActive(data, v)"
          />
          {{ data.isActive ? 'Aktif' : 'Nonaktif' }}
        </label>
      </template>
    </Column>
    <Column v-if="tab === 'STAFF'" header="Terakhir masuk">
      <template #body="{ data }: { data: OwnerUserDto }"
        ><span class="text-[13px] text-gray-700">{{
          data.lastLoginAt ? formatDateTime(data.lastLoginAt) : 'Belum pernah'
        }}</span></template
      >
    </Column>
    <Column header="Aksi" :pt="{ headerCell: { class: 'pr-5' }, bodyCell: { class: 'pr-5' } }">
      <template #body="{ data }: { data: OwnerUserDto }">
        <AppButton
          v-if="data.role !== 'OWNER'"
          variant="secondary"
          size="sm"
          label="Reset password"
          :aria-label="`Kirim tautan reset password ke ${data.name}`"
          :disabled="!data.isActive || busyId === data.id"
          @click="sendReset(data)"
        />
      </template>
    </Column>
  </AppDataTable>

  <Dialog
    v-model:visible="inviteOpen"
    modal
    header="Tambah akun pegawai"
    class="w-[min(460px,calc(100vw-32px))]"
  >
    <form id="invite-form" class="flex flex-col gap-4" novalidate @submit.prevent="sendInvite">
      <FormField v-slot="f" label="Nama lengkap" :error="inviteErrors.name">
        <InputText v-model="invite.name" v-bind="f.input" autocomplete="off" fluid />
      </FormField>
      <FormField v-slot="f" label="Email" :error="inviteErrors.email">
        <InputText v-model="invite.email" v-bind="f.input" type="email" autocomplete="off" fluid />
      </FormField>
      <FormField v-slot="f" label="No. WhatsApp" :error="inviteErrors.phone">
        <InputText v-model="invite.phone" v-bind="f.input" type="tel" autocomplete="off" fluid />
      </FormField>
      <p class="text-[13px] text-gray-600">
        Pegawai menerima email untuk membuat password sendiri.
      </p>
    </form>
    <template #footer>
      <AppButton variant="secondary" label="Batal" @click="inviteOpen = false" />
      <AppButton type="submit" form="invite-form" label="Kirim undangan" :loading="inviting" />
    </template>
  </Dialog>
</template>
