<script setup lang="ts">
import { computed, ref, shallowRef, watch } from 'vue'
import type { ActivityLogDto } from '@ssb/shared'
import { useRequest } from '@/shared/composables'
import { ApiRequestError, formatTime, isOffline } from '@/shared/lib'
import { AppButton, FormField, OfflineState } from '@/shared/ui'
import { ACTION_LABELS, activityKind, describeActivity, groupByDay } from '../activity'
import { ownerAdminApi } from '../api/admin.api'
import { toDateParam } from '../reports'

// Layar O-Log: filter pengguna, jenis aksi, tanggal; log dikelompokkan per hari (WIB), muat lebih banyak.
const ALL = 0 // nilai "semua" (Select PrimeVue menampilkan label kosong untuk null)
const staff = useRequest(() => ownerAdminApi.users({ role: 'STAFF', page: 1, limit: 50 }))
const actorOptions = computed(() => [
  { value: ALL, label: 'Semua pengguna' },
  ...(staff.data.value?.data.map((u) => ({
    value: u.id,
    label: u.role === 'OWNER' ? `${u.name} (owner)` : u.name,
  })) ?? []),
])
const actionOptions = [
  { value: 'ALL', label: 'Semua aksi' },
  ...Object.entries(ACTION_LABELS).map(([value, label]) => ({ value, label })),
]

const actorId = ref(ALL)
const action = ref('ALL')
const date = ref<Date | null>(null)

const logs = shallowRef<ActivityLogDto[]>([])
const total = ref(0)
const page = ref(1)
const loading = ref(false)
const error = ref('')
let requestId = 0
async function load(next = false) {
  const id = ++requestId
  loading.value = true
  error.value = ''
  const day = date.value ? toDateParam(date.value) : undefined
  try {
    const res = await ownerAdminApi.activityLogs({
      actorId: actorId.value || undefined,
      action: action.value === 'ALL' ? undefined : action.value,
      from: day,
      to: day,
      page: next ? page.value + 1 : 1,
    })
    if (id !== requestId) return
    logs.value = next ? [...logs.value, ...res.data] : res.data
    page.value = res.meta.page
    total.value = res.meta.total
  } catch (e) {
    if (id === requestId)
      error.value = e instanceof ApiRequestError ? e.message : 'Gagal memuat log.'
  } finally {
    if (id === requestId) loading.value = false
  }
}
watch([actorId, action, date], () => void load(), { immediate: true })

const days = computed(() => groupByDay(logs.value))
const initials = (name: string | null) =>
  (name ?? 'Sistem')
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase())
    .join('')
</script>

<template>
  <h1 class="text-[28px] font-extrabold tracking-tight">Log aktivitas</h1>

  <form
    class="flex flex-wrap items-end gap-3.5 rounded-card border border-gray-200 bg-white px-5 py-4"
    @submit.prevent
  >
    <FormField v-slot="f" label="Pengguna">
      <Select
        v-model="actorId"
        :label-id="f.id"
        :options="actorOptions"
        option-label="label"
        option-value="value"
        class="w-56"
      />
    </FormField>
    <FormField v-slot="f" label="Jenis aksi">
      <Select
        v-model="action"
        :label-id="f.id"
        :options="actionOptions"
        option-label="label"
        option-value="value"
        class="w-56"
      />
    </FormField>
    <FormField v-slot="f" label="Tanggal">
      <DatePicker
        v-model="date"
        :input-id="f.id"
        date-format="dd/mm/yy"
        :max-date="new Date()"
        placeholder="Semua tanggal"
        show-clear
        show-icon
        icon-display="input"
      />
    </FormField>
  </form>

  <OfflineState v-if="error && isOffline && !logs.length" auto-retry @retry="load()" />
  <div
    v-else-if="error && !logs.length"
    role="alert"
    class="flex flex-col items-center gap-3 rounded-card border border-gray-200 bg-white px-6 py-14 text-center"
  >
    <p class="text-lg font-extrabold">Log gagal dimuat</p>
    <p class="text-sm text-gray-600">{{ error }}</p>
    <AppButton variant="secondary" label="Coba lagi" @click="load()" />
  </div>

  <div v-else-if="loading && !logs.length" class="flex flex-col gap-3" aria-busy="true">
    <Skeleton v-for="n in 4" :key="n" height="64px" border-radius="12px" />
  </div>

  <p
    v-else-if="!logs.length"
    class="rounded-card border border-gray-200 bg-white px-6 py-12 text-center text-sm text-gray-600"
  >
    Tidak ada aktivitas untuk filter ini.
  </p>

  <template v-else>
    <section
      v-for="d in days"
      :key="d.key"
      class="flex flex-col gap-2 rounded-card border border-gray-200 bg-white p-5"
      :aria-label="d.label"
    >
      <h2 class="text-[15px] font-extrabold">{{ d.label }}</h2>
      <ol class="flex flex-col">
        <li
          v-for="e in d.items"
          :key="e.id"
          class="flex items-start gap-3 border-t border-gray-100 py-3 text-sm first:border-t-0"
        >
          <span class="w-11 flex-none pt-1.5 text-xs text-gray-600 tabular-nums">{{
            formatTime(e.createdAt)
          }}</span>
          <span
            aria-hidden="true"
            class="flex size-8 flex-none items-center justify-center rounded-full text-[11px] font-extrabold"
            :class="e.actorName ? 'bg-brand-100 text-brand-700' : 'bg-gray-200 text-gray-700'"
            >{{ initials(e.actorName) }}</span
          >
          <span class="min-w-0 flex-1 pt-1 leading-normal"
            ><strong>{{ e.actorName ?? 'Sistem' }}</strong> {{ describeActivity(e) }}</span
          >
          <span
            class="mt-1 flex-none rounded-full bg-gray-100 px-2.5 py-0.5 text-xs font-bold text-gray-700"
            >{{ activityKind(e) }}</span
          >
        </li>
      </ol>
    </section>
    <AppButton
      v-if="logs.length < total"
      variant="secondary"
      class="self-center"
      :label="`Muat lebih banyak (${total - logs.length} lagi)`"
      :loading="loading"
      @click="load(true)"
    />
  </template>
</template>
